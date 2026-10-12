/**
 * Comment DAO — 正式持久化层 (替代内存 Map)
 *
 * 全部以 SQLite 为唯一真相源
 * 保持对外 API 完全兼容
 */

const { getDb } = require('./sqlite');
const { generateId } = require('../utils/uuid');
const { nowIso } = require('../utils/datetime');
const fs = require('fs');
const { normalizeAttachmentRecord, normalizeUploadedOriginalName } = require('../modules/attachment/attachment.filename');

/**
 * enrich 评论数据，添加用户名和头像
 */
function enrichComment(comment) {
  if (!comment) return null;
  const db = getDb();
  const user = db.prepare('SELECT name, avatar FROM users WHERE id = ?').get(comment.user_id);
  return {
    ...comment,
    user_name: user?.name || null,
    user_avatar: user?.avatar || null,
  };
}

/**
 * 评论附件 DAO
 */
const commentAttachmentDao = {
  findById(attachmentId) {
    const db = getDb();
    const attachment = db.prepare('SELECT * FROM comment_attachments WHERE id = ?').get(attachmentId);
    return attachment ? normalizeAttachmentRecord(attachment) : null;
  },

  /**
   * 创建评论附件（暂不关联评论，保留物理文件）
   */
  createPending(file, taskId, userId) {
    const db = getDb();
    const id = `catt-${generateId()}`;
    const now = nowIso();
    const originalName = normalizeUploadedOriginalName(file.originalname);

    db.prepare(`
      INSERT INTO comment_attachments (id, task_id, comment_id, user_id, filename, original_name, file_size, mime_type, physical_path, created_at)
      VALUES (@id, @task_id, @comment_id, @user_id, @filename, @original_name, @file_size, @mime_type, @physical_path, @created_at)
    `).run({
      id,
      task_id: taskId,
      comment_id: null,
      user_id: userId,
      filename: file.filename,
      original_name: originalName,
      file_size: file.size,
      mime_type: file.mimetype || 'application/octet-stream',
      physical_path: file.path, // 保留物理文件路径，修复评论附件无法下载问题
      created_at: now,
    });

    return normalizeAttachmentRecord(db.prepare('SELECT * FROM comment_attachments WHERE id = ?').get(id));
  },

  /**
   * 关联附件到评论
   */
  attachToComment(attachmentIds, commentId) {
    if (!attachmentIds?.length) return;
    const db = getDb();
    const placeholders = attachmentIds.map(() => '?').join(',');
    db.prepare(`UPDATE comment_attachments SET comment_id = ? WHERE id IN (${placeholders})`)
      .run(commentId, ...attachmentIds);
  },

  /**
   * 获取评论的附件列表
   */
  listByCommentId(commentId) {
    const db = getDb();
    return db.prepare('SELECT * FROM comment_attachments WHERE comment_id = ?').all(commentId).map(normalizeAttachmentRecord);
  },

  /**
   * 解析评论附件下载（鉴权 + 检查物理文件）
   */
  resolveDownload(attachmentId, userId) {
    const db = getDb();
    const attachment = db.prepare('SELECT * FROM comment_attachments WHERE id = ?').get(attachmentId);

    if (!attachment) return null;

    // 鉴权：需要能访问该 task
    const task = require('./taskDao').findById(attachment.task_id, { includeDeleted: true });
    if (!task) return null;

    const canDeletedAccess = require('./taskDao').isTaskDeleted(task) && task.deleted_by === userId;
    const canVisibleAccess = !require('./taskDao').isTaskDeleted(task) && require('./taskDao').canUserAccessVisibleTask(task, userId);

    if (!canDeletedAccess && !canVisibleAccess) return null;

    // 检查物理文件是否存在
    if (!attachment.physical_path || !fs.existsSync(attachment.physical_path)) {
      return null;
    }

    return normalizeAttachmentRecord(attachment);
  },

  /**
   * 删除未关联的附件（清理孤立附件）
   */
  deletePending(attachmentId, userId) {
    const db = getDb();
    const attachment = db.prepare('SELECT * FROM comment_attachments WHERE id = ? AND user_id = ? AND comment_id IS NULL')
      .get(attachmentId, userId);

    if (!attachment) return false;

    // 删除物理文件
    if (attachment.physical_path && fs.existsSync(attachment.physical_path)) {
      try {
        fs.unlinkSync(attachment.physical_path);
      } catch (e) {
        console.error('评论附件物理文件删除失败:', e);
      }
    }

    // 删除数据库记录
    db.prepare('DELETE FROM comment_attachments WHERE id = ?').run(attachmentId);
    return true;
  },

  /**
   * 清理超过指定时间的孤立附件
   */
  cleanupOrphaned(thresholdHours = 24) {
    const db = getDb();
    const { daysAgo } = require('../utils/datetime');
    const threshold = daysAgo(thresholdHours / 24);
    const orphaned = db.prepare('SELECT * FROM comment_attachments WHERE comment_id IS NULL AND created_at < ?').all(threshold);

    for (const attachment of orphaned) {
      if (attachment.physical_path && fs.existsSync(attachment.physical_path)) {
        try {
          fs.unlinkSync(attachment.physical_path);
        } catch (e) {
          console.error('孤立附件物理文件删除失败:', e);
        }
      }
    }

    db.prepare('DELETE FROM comment_attachments WHERE comment_id IS NULL AND created_at < ?').run(threshold);
    return orphaned.length;
  },
};

function listByTaskId(taskId, options = {}) {
  const db = getDb();
  const comments = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ? AND c.deleted_at IS NULL
    ORDER BY c.created_at ASC
  `).all(taskId);

  // 为每个评论加载附件
  return attachMentionedUsers(attachReadStates(comments.map(comment => ({
    ...comment,
    attachments: commentAttachmentDao.listByCommentId(comment.id),
  })), options.currentUserId || null));
}

function buildReadRecipients(task) {
  if (!task) return [];
  const taskDao = require('./taskDao');
  const seen = new Set();
  const recipients = [];

  const add = (userId, role) => {
    if (!userId || seen.has(userId)) return;
    seen.add(userId);
    recipients.push({ userId, role });
  };

  add(task.creator_id, 'creator');
  add(task.assignee_id, 'assignee');

  for (const userId of taskDao.uniqueIds(task.participant_ids)) {
    add(userId, 'participant');
  }

  return recipients;
}

function insertRecipients(db, commentId, taskId, recipients, createdAt) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO comment_recipients (comment_id, task_id, user_id, role, created_at)
    VALUES (@comment_id, @task_id, @user_id, @role, @created_at)
  `);

  for (const recipient of recipients) {
    stmt.run({
      comment_id: commentId,
      task_id: taskId,
      user_id: recipient.userId,
      role: recipient.role,
      created_at: createdAt,
    });
  }
}

function markReadForRecipient(db, commentId, userId, readAt) {
  if (!commentId || !userId) return 0;
  return db.prepare(`
    INSERT OR IGNORE INTO comment_reads (comment_id, user_id, read_at)
    SELECT comment_id, user_id, @read_at
    FROM comment_recipients
    WHERE comment_id = @comment_id AND user_id = @user_id
  `).run({
    comment_id: commentId,
    user_id: userId,
    read_at: readAt,
  }).changes;
}

function getReadStateMap(commentIds, currentUserId) {
  const ids = [...new Set((commentIds || []).filter(Boolean))];
  const result = new Map();
  for (const id of ids) {
    result.set(id, {
      recipient_count: 0,
      read_count: 0,
      unread_count: 0,
      has_read: false,
    });
  }
  if (ids.length === 0) return result;

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');

  const recipientRows = db.prepare(`
    SELECT comment_id, COUNT(*) AS count
    FROM comment_recipients
    WHERE comment_id IN (${placeholders})
    GROUP BY comment_id
  `).all(...ids);

  const readRows = db.prepare(`
    SELECT comment_id, COUNT(*) AS count
    FROM comment_reads
    WHERE comment_id IN (${placeholders})
    GROUP BY comment_id
  `).all(...ids);

  for (const row of recipientRows) {
    const state = result.get(row.comment_id);
    if (state) state.recipient_count = row.count;
  }

  for (const row of readRows) {
    const state = result.get(row.comment_id);
    if (state) state.read_count = row.count;
  }

  if (currentUserId) {
    const myReadRows = db.prepare(`
      SELECT comment_id
      FROM comment_reads
      WHERE user_id = ? AND comment_id IN (${placeholders})
    `).all(currentUserId, ...ids);

    for (const row of myReadRows) {
      const state = result.get(row.comment_id);
      if (state) state.has_read = true;
    }
  }

  for (const state of result.values()) {
    state.unread_count = Math.max(state.recipient_count - state.read_count, 0);
  }

  return result;
}

function attachReadStates(comments, currentUserId = null) {
  const readStateMap = getReadStateMap(comments.map((comment) => comment.id), currentUserId);
  return comments.map((comment) => ({
    ...comment,
    read_state: readStateMap.get(comment.id) || {
      recipient_count: 0,
      read_count: 0,
      unread_count: 0,
      has_read: false,
    },
  }));
}

function normalizeUserIds(userIds, excludedUserId = null) {
  const seen = new Set();
  const result = [];

  for (const rawId of Array.isArray(userIds) ? userIds : []) {
    const userId = String(rawId || '').trim();
    if (!userId || (excludedUserId && userId === excludedUserId) || seen.has(userId)) {
      continue;
    }
    seen.add(userId);
    result.push(userId);
  }

  return result;
}

function listMentionableUserIds(teamId, userIds) {
  const ids = normalizeUserIds(userIds);
  if (!teamId || ids.length === 0) return [];

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT tm.user_id
    FROM team_members tm
    JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
      AND tm.user_id IN (${placeholders})
      AND u.status = 1
  `).all(teamId, ...ids);
  const validSet = new Set(rows.map((row) => String(row.user_id)));

  return ids.filter((userId) => validSet.has(userId));
}

function listMentionedUsers(commentId) {
  if (!commentId) return [];

  const db = getDb();
  return db.prepare(`
    SELECT
      u.id,
      u.name,
      u.avatar,
      u.department_name,
      cm.auto_added_to_task
    FROM comment_mentions cm
    JOIN users u ON u.id = cm.mentioned_user_id
    WHERE cm.comment_id = ?
    ORDER BY cm.created_at ASC, cm.mentioned_user_id ASC
  `).all(commentId).map((row) => ({
    ...row,
    auto_added_to_task: Boolean(row.auto_added_to_task),
  }));
}

function attachMentionedUsers(comments) {
  return comments.map((comment) => ({
    ...comment,
    mentioned_users: listMentionedUsers(comment.id),
  }));
}

function insertMentions(db, commentId, taskId, mentionedUserIds, createdBy, autoAddedUserIds, createdAt) {
  const ids = normalizeUserIds(mentionedUserIds, createdBy);
  if (ids.length === 0) return;

  const autoAddedSet = new Set(autoAddedUserIds || []);
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO comment_mentions
      (comment_id, task_id, mentioned_user_id, created_by, auto_added_to_task, created_at)
    VALUES
      (@comment_id, @task_id, @mentioned_user_id, @created_by, @auto_added_to_task, @created_at)
  `);

  for (const userId of ids) {
    stmt.run({
      comment_id: commentId,
      task_id: taskId,
      mentioned_user_id: userId,
      created_by: createdBy,
      auto_added_to_task: autoAddedSet.has(userId) ? 1 : 0,
      created_at: createdAt,
    });
  }
}

function create(comment, attachmentIds, options = {}) {
  const db = getDb();
  const id = comment.id || generateId();
  const stamp = nowIso();
  const createdAt = comment.created_at || stamp;
  const updatedAt = comment.updated_at || stamp;
  const mentionedUserIds = normalizeUserIds(options.mentionedUserIds || [], comment.user_id);
  let autoAddedMentionUserIds = [];

  const writeComment = db.transaction(() => {
    const taskDao = require('./taskDao');
    const task = taskDao.findById(comment.task_id, { includeDeleted: true });
    const currentParticipantIds = taskDao.uniqueIds(task?.participant_ids);
    const relatedBefore = new Set([
      task?.creator_id,
      task?.assignee_id,
      ...currentParticipantIds,
    ].filter(Boolean));

    autoAddedMentionUserIds = mentionedUserIds.filter((userId) => !relatedBefore.has(userId));
    const nextParticipantIds = [...new Set([...currentParticipantIds, ...autoAddedMentionUserIds])];

    if (autoAddedMentionUserIds.length > 0) {
      db.prepare('UPDATE tasks SET participant_ids = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(nextParticipantIds), createdAt, comment.task_id);
      require('../modules/notification/notification.cache').stakeholderCache.invalidate(comment.task_id);
    }

    db.prepare(`
      INSERT INTO comments (id, task_id, user_id, content, message_type, parent_id, request_id, created_at, updated_at, audit_status)
      VALUES (@id, @task_id, @user_id, @content, @message_type, @parent_id, @request_id, @created_at, @updated_at, @audit_status)
    `).run({
      id,
      task_id: comment.task_id,
      user_id: comment.user_id,
      content: comment.content || '',
      message_type: comment.message_type || 'message',
      parent_id: comment.parent_id || null,
      request_id: comment.request_id || null,
      created_at: createdAt,
      updated_at: updatedAt,
      audit_status: (comment.message_type || 'message') === 'progress' ? 'pending' : null,
    });

    const recipients = buildReadRecipients(
      autoAddedMentionUserIds.length > 0
        ? { ...task, participant_ids: nextParticipantIds }
        : task
    );
    insertRecipients(db, id, comment.task_id, recipients, createdAt);
    markReadForRecipient(db, id, comment.user_id, createdAt);
    insertMentions(db, id, comment.task_id, mentionedUserIds, comment.user_id, autoAddedMentionUserIds, createdAt);

    // 关联附件
    if (attachmentIds?.length) {
      commentAttachmentDao.attachToComment(attachmentIds, id);
    }
  });

  writeComment();

  const result = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);

  return attachReadStates([{
    ...enrichComment(result),
    attachments: commentAttachmentDao.listByCommentId(id),
  }], options.currentUserId || comment.user_id).map((comment) => ({
    ...comment,
    mentioned_users: listMentionedUsers(comment.id),
  }))[0];
}

function findByRequestKey(taskId, userId, requestId, options = {}) {
  if (!requestId) return null;
  const db = getDb();
  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.task_id = ? AND c.user_id = ? AND c.request_id = ? AND c.deleted_at IS NULL
  `).get(taskId, userId, requestId);
  if (!comment) return null;
  return attachReadStates([{
    ...comment,
    attachments: commentAttachmentDao.listByCommentId(comment.id),
  }], options.currentUserId || userId).map((comment) => ({
    ...comment,
    mentioned_users: listMentionedUsers(comment.id),
  }))[0];
}

function findById(commentId, options = {}) {
  const db = getDb();
  const comment = db.prepare(`
    SELECT c.*, u.name as user_name, u.avatar as user_avatar
    FROM comments c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ?
  `).get(commentId);
  if (!comment) return null;
  return attachReadStates([{
    ...comment,
    attachments: commentAttachmentDao.listByCommentId(comment.id),
  }], options.currentUserId || null).map((comment) => ({
    ...comment,
    mentioned_users: listMentionedUsers(comment.id),
  }))[0];
}

function update(commentId, patch, options = {}) {
  const db = getDb();
  const current = findById(commentId);
  if (!current) return null;

  const stamp = nowIso();

  if (patch.content !== undefined) {
    db.prepare('UPDATE comments SET content = ?, updated_at = ? WHERE id = ?')
      .run(patch.content, stamp, commentId);
  }

  return findById(commentId, options);
}

function updateAuditStatus(commentId, status, options = {}) {
  const db = getDb();
  const current = findById(commentId);
  if (!current) return null;

  const stamp = nowIso();
  db.prepare('UPDATE comments SET audit_status = ?, updated_at = ? WHERE id = ?')
    .run(status, stamp, commentId);

  return findById(commentId, options);
}

function remove(commentId) {
  const db = getDb();
  const current = findById(commentId);
  if (!current) return null;

  const stamp = nowIso();
  db.prepare('UPDATE comments SET deleted_at = ?, updated_at = ? WHERE id = ?')
    .run(stamp, stamp, commentId);

  return findById(commentId);
}

function countByTaskId(taskId) {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) as c FROM comments WHERE task_id = ? AND deleted_at IS NULL').get(taskId);
  return r ? r.c : 0;
}

function markByTaskId(taskId, commentIds, userId) {
  const ids = [...new Set((commentIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  if (!taskId || ids.length === 0 || !userId) {
    return { updated: 0 };
  }

  const db = getDb();
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT id
    FROM comments
    WHERE task_id = ? AND deleted_at IS NULL AND id IN (${placeholders})
  `).all(taskId, ...ids);

  const stamp = nowIso();
  let updated = 0;
  const markMany = db.transaction(() => {
    for (const row of rows) {
      updated += markReadForRecipient(db, row.id, userId, stamp);
    }
  });
  markMany();

  return { updated };
}

function getReadStatus(commentId) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT
      cr.user_id AS id,
      cr.role,
      u.name,
      u.avatar,
      u.department_name,
      rd.read_at
    FROM comment_recipients cr
    LEFT JOIN users u ON u.id = cr.user_id
    LEFT JOIN comment_reads rd ON rd.comment_id = cr.comment_id AND rd.user_id = cr.user_id
    WHERE cr.comment_id = ?
    ORDER BY
      CASE cr.role
        WHEN 'creator' THEN 1
        WHEN 'assignee' THEN 2
        ELSE 3
      END,
      cr.created_at ASC,
      cr.user_id ASC
  `).all(commentId);

  return {
    read: rows.filter((row) => Boolean(row.read_at)),
    unread: rows.filter((row) => !row.read_at).map((row) => ({ ...row, read_at: null })),
  };
}

module.exports = {
  listByTaskId,
  create,
  findByRequestKey,
  findById,
  update,
  updateAuditStatus,
  remove,
  countByTaskId,
  markByTaskId,
  getReadStatus,
  normalizeUserIds,
  listMentionableUserIds,
  listMentionedUsers,
  commentAttachmentDao,
};
