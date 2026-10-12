/**
 * 附件 DAO - T03.11 真实的物理与数据库读写
 */

const { getDb } = require('../../db/sqlite');
const { generateId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');
const fs = require('fs');
const taskDao = require('../../db/taskDao');
const { normalizeAttachmentRecord, normalizeUploadedOriginalName } = require('./attachment.filename');

function createAttachment(reqFile, taskId, userId) {
  const db = getDb();
  const id = `att-${generateId()}`;
  const now = nowIso();
  const originalName = normalizeUploadedOriginalName(reqFile.originalname);

  db.prepare(`
    INSERT INTO task_attachments (id, task_id, user_id, original_name, filename, file_size, mime_type, physical_path, created_at)
    VALUES (@id, @task_id, @user_id, @original_name, @filename, @file_size, @mime_type, @physical_path, @created_at)
  `).run({
    id,
    task_id: taskId,
    user_id: userId,
    original_name: originalName,
    filename: reqFile.filename,
    file_size: reqFile.size,
    mime_type: reqFile.mimetype || 'application/octet-stream',
    physical_path: reqFile.path, // Multer 存入的绝对路径
    created_at: now,
  });

  return normalizeAttachmentRecord(db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(id));
}

function resolveDownload(attachmentId, userId) {
  const db = getDb();
  const attachment = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(attachmentId);
  
  if (!attachment) {
    return null;
  }

  // 鉴权：需要能访问该 task
  const task = taskDao.findById(attachment.task_id, { includeDeleted: true });
  if (!task) return null;

  const canDeletedAccess = taskDao.isTaskDeleted(task) && task.deleted_by === userId;
  const canVisibleAccess = !taskDao.isTaskDeleted(task) && taskDao.canUserAccessVisibleTask(task, userId);
  
  if (!canDeletedAccess && !canVisibleAccess) {
    return null;
  }

  if (!fs.existsSync(attachment.physical_path)) {
    return null; // 物理文件丢失
  }

  return normalizeAttachmentRecord(attachment);
}

function deleteAttachment(attachmentId, userId) {
  const db = getDb();
  const attachment = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(attachmentId);

  if (!attachment || attachment.user_id !== userId) {
    // 只有上传者(或其他设定的权限) 可以删除
    const err = new Error('只有附件上传者才可删除');
    err.code = 'FORBIDDEN';
    throw err;
  }

  db.prepare('DELETE FROM task_attachments WHERE id = ?').run(attachmentId);
  
  // 物理删除 (不阻断主流程报错)
  try {
    if (fs.existsSync(attachment.physical_path)) {
      fs.unlinkSync(attachment.physical_path);
    }
  } catch (e) {
    console.error('物理文件删除失败:', e);
  }

  return normalizeAttachmentRecord(attachment);
}

function findAttachmentById(attachmentId) {
  const db = getDb();
  const attachment = db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(attachmentId);
  return attachment ? normalizeAttachmentRecord(attachment) : null;
}

function countByTaskId(taskId) {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM task_attachments WHERE task_id = ?').get(taskId);
  return row ? row.c : 0;
}

/**
 * 创建 pending 任务附件（task_id 暂为 null，等任务创建后关联）
 */
function createPending(reqFile, userId) {
  const db = getDb();
  const id = `att-${generateId()}`;
  const now = nowIso();
  const originalName = normalizeUploadedOriginalName(reqFile.originalname);

  db.prepare(`
    INSERT INTO task_attachments (id, task_id, user_id, original_name, filename, file_size, mime_type, physical_path, created_at)
    VALUES (@id, NULL, @user_id, @original_name, @filename, @file_size, @mime_type, @physical_path, @created_at)
  `).run({
    id,
    user_id: userId,
    original_name: originalName,
    filename: reqFile.filename,
    file_size: reqFile.size,
    mime_type: reqFile.mimetype || 'application/octet-stream',
    physical_path: reqFile.path,
    created_at: now,
  });

  return normalizeAttachmentRecord(db.prepare('SELECT * FROM task_attachments WHERE id = ?').get(id));
}

/**
 * 将 pending 附件批量关联到任务
 */
function attachToTask(attachmentIds, taskId, userId) {
  if (!attachmentIds?.length) return;
  const db = getDb();
  const stmt = db.prepare(
    'UPDATE task_attachments SET task_id = ? WHERE id = ? AND user_id = ? AND task_id IS NULL'
  );
  const updateMany = db.transaction((ids) => {
    for (const id of ids) {
      stmt.run(taskId, id, userId);
    }
  });
  updateMany(attachmentIds);
}

module.exports = {
  createAttachment,
  createPending,
  attachToTask,
  resolveDownload,
  deleteAttachment,
  findAttachmentById,
  countByTaskId,
};
