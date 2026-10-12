/**
 * Task DAO — 正式持久化层 (替代内存 Map)
 *
 * 核心原则：所有读写以 SQLite 为唯一真相源
 * 保持对外 API 完全兼容旧 taskDao
 */

const { getDb } = require('./sqlite');
const { generateId } = require('../utils/uuid');
const { nowIso, todayDate, isOverdue } = require('../utils/datetime');
const userDao = require('./userDao');
const { stakeholderCache } = require('../modules/notification/notification.cache');
const notificationAggregation = require('../modules/notification/notification.aggregation');
const notificationEvents = require('../modules/notification/notification.events');
const todoLifecycle = require('../modules/notification/notification.todoLifecycle');
const { normalizeAttachmentRecord } = require('../modules/attachment/attachment.filename');
const { buildTaskScopeFilter } = require('../utils/dataScope');
const {
  TASK_STATUS,
  normalizeTaskStatus,
  isCompletedTaskStatus,
  isTerminalTaskStatus,
  isDelayedTaskStatus,
  LEGACY_TODO_STATUS,
} = require('../constants/taskStatus');

// ──────────────────────────────────────────
// 提醒规则 → 偏移毫秒映射
// ──────────────────────────────────────────

const REMINDER_OFFSETS = {
  due_15m: 15 * 60 * 1000,
  due_30m: 30 * 60 * 1000,
  due_1h:  60 * 60 * 1000,
  due_3h:  3 * 60 * 60 * 1000,
  due_1d:  24 * 60 * 60 * 1000,
  due_3d:  3 * 24 * 60 * 60 * 1000,
};

/**
 * 根据截止时间和提醒规则计算 reminder_at
 * @returns {string|null} ISO 时间字符串（UTC），若规则无效或无截止时间则返回 null
 */
function computeReminderAt(dueDate, reminderRule, reminderTime) {
  if (!dueDate || !reminderRule || reminderRule === 'none') return null;
  const offset = REMINDER_OFFSETS[reminderRule];
  if (!offset) return null;

  // 使用传入的提醒时间或默认 09:00:00
  const timeStr = reminderTime || '09:00:00';
  const [hh = 9, mm = 0, ss = 0] = timeStr.includes(':') ? timeStr.split(':').map(Number) : [9, 0, 0];
  const hhStr = String(hh).padStart(2, '0');
  const mmStr = String(mm).padStart(2, '0');
  const ssStr = String(ss).padStart(2, '0');

  // due_date 是 yyyy-MM-dd 格式，结合 +08:00 时区解析为绝对时间戳
  const dueMs = new Date(`${dueDate}T${hhStr}:${mmStr}:${ssStr}+08:00`).getTime();
  if (Number.isNaN(dueMs)) return null;

  // 减去提前量后直接输出 UTC ISO，scanner 用 nowIso()（UTC）比较
  return new Date(dueMs - offset).toISOString();
}

/**
 * 根据周期天数和具体的时分计算下一次触发的 UTC ISO 时戳
 * @param {number} intervalDays 例如 1, 2
 * @param {string} timeStr 例如 '09:00'
 * @param {Date} [baseDate] 计算基准，默认现在
 */
function computeNextPeriodicReminderAt(intervalDays, timeStr, baseDate = new Date()) {
  if (!intervalDays || !timeStr) return null;
  const [hh, mm] = timeStr.split(':').map(Number);
  if (isNaN(hh) || isNaN(mm)) return null;

  // 用 UTC+8 的日期部分来构造，避免本地时区隐式转换
  const baseUtc8 = new Date(baseDate.getTime() + 8 * 60 * 60 * 1000);
  const year = baseUtc8.getUTCFullYear();
  const month = baseUtc8.getUTCMonth();
  const day = baseUtc8.getUTCDate();

  // 构造"今天 hh:mm 北京时间"对应的 UTC 时间戳
  const todayTargetUtc = Date.UTC(year, month, day, hh - 8, mm, 0, 0);

  let nextMs = todayTargetUtc;
  // 如果今天的目标时刻已过，跳到下一个周期
  if (nextMs <= Date.now()) {
    nextMs += intervalDays * 24 * 60 * 60 * 1000;
    // 防御性补救：极端停机场景
    while (nextMs <= Date.now()) {
      nextMs += 24 * 60 * 60 * 1000;
    }
  }

  return new Date(nextMs).toISOString();
}

// ──────────────────────────────────────────
// 辅助函数
// ──────────────────────────────────────────

function uniqueIds(ids) {
  if (!ids) return [];
  const arr = typeof ids === 'string' ? JSON.parse(ids || '[]') : ids;
  return [...new Set(arr.filter(Boolean))];
}

function isTaskDeleted(task) {
  return Boolean(task && (task.is_deleted === 1 || task.is_deleted === true));
}

function closeTodoWhenTaskEntersTerminalStatus(task, nextStatus) {
  if (!task || task.status === nextStatus) return;
  if (!isTerminalTaskStatus(nextStatus)) return;
  if (!task.assignee_id) return;

  todoLifecycle.closeTaskTodosForAssigneeInBackground({
    taskId: task.id,
    assigneeId: task.assignee_id,
    reason: `status:${nextStatus}`,
  });
}

function buildMemberProfile(userId) {
  const user = userDao.getUserProfile(userId);
  return user || null;
}

function buildMyTaskRelationKeys(task, userId) {
  if (!userId) return undefined;
  const pIds = uniqueIds(task.participant_ids);
  return [
    task.creator_id === userId ? 'created' : null,
    task.assignee_id === userId ? 'assigned' : null,
    pIds.includes(userId) && task.creator_id !== userId && task.assignee_id !== userId ? 'participating' : null,
  ].filter(Boolean);
}

function buildRoleLabels(task, userId) {
  const relationKeys = buildMyTaskRelationKeys(task, userId) || [];

  return relationKeys.map((key) => {
    if (key === 'created') return '发起人';
    if (key === 'assigned') return '负责人';
    return '协作者';
  });
}

function isTaskRelated(task, userId) {
  if (!task || !userId) return false;
  return task.creator_id === userId ||
    task.assignee_id === userId ||
    uniqueIds(task.participant_ids).includes(userId);
}

function getTeamMemberTaskVisibilityScope(userId, teamId) {
  if (!userId || !teamId) return 'all';

  const db = getDb();
  const row = db.prepare(`
    SELECT
      t.owner_id,
      tm.role_id,
      tm.task_visibility_scope
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
    WHERE t.id = ?
    LIMIT 1
  `).get(userId, teamId);

  if (!row) return 'all';
  if (row.owner_id === userId || row.role_id === 'owner' || row.role_id === 'admin') return 'all';
  return row.task_visibility_scope === 'self' ? 'self' : 'all';
}

function buildTaskSelfVisibilityFilter(userId) {
  return {
    condition: '(creator_id = ? OR assignee_id = ? OR participant_ids LIKE ?)',
    params: [userId, userId, `%"${userId}"%`],
  };
}

function getTeamName(teamId) {
  if (!teamId) return '';
  const db = getDb();
  const team = db.prepare('SELECT name FROM teams WHERE id = ?').get(teamId);
  return team ? team.name : '';
}

function canUserViewTeamMembers(userId, teamId) {
  if (!userId || !teamId) return false;

  const db = getDb();
  const team = db
    .prepare('SELECT owner_id FROM teams WHERE id = ? AND is_archived = 0 LIMIT 1')
    .get(teamId);
  if (!team) return false;
  if (team.owner_id === userId) return true;

  const roleDao = require('./roleDao');
  return roleDao.isTeamMember(userId, teamId);
}

function getCommentCount(taskId) {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) as c FROM comments WHERE task_id = ? AND deleted_at IS NULL').get(taskId);
  return r ? r.c : 0;
}

function getAttachmentCount(taskId) {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) as c FROM task_attachments WHERE task_id = ?').get(taskId);
  return r ? r.c : 0;
}

function getAttachments(taskId) {
  const db = getDb();
  return db.prepare(`
    SELECT id, task_id, user_id, filename, original_name, file_size, mime_type, created_at
    FROM task_attachments
    WHERE task_id = ?
    ORDER BY created_at ASC
  `).all(taskId).map(normalizeAttachmentRecord);
}

function assertNoCircularDependency(taskId, newParentId) {
  if (!newParentId) return;
  if (taskId && taskId === newParentId) {
    const error = new Error('不能将任务自身设为父任务');
    error.status = 400;
    throw error;
  }
  const db = getDb();
  let currentId = newParentId;
  const visited = new Set(taskId ? [taskId] : []);

  while (currentId) {
    if (visited.has(currentId)) {
      const error = new Error('检测到循环任务关联，无法设置该父任务');
      error.status = 400;
      throw error;
    }
    visited.add(currentId);
    const parent = db.prepare('SELECT parent_id FROM tasks WHERE id = ?').get(currentId);
    currentId = parent ? parent.parent_id : null;
  }
}

function getTaskBreadcrumbs(taskId) {
  if (!taskId) return [];
  const db = getDb();
  const breadcrumbs = [];
  let current = db.prepare('SELECT id, title, parent_id FROM tasks WHERE id = ?').get(taskId);
  while (current && current.parent_id) {
    const parent = db.prepare('SELECT id, title, parent_id FROM tasks WHERE id = ?').get(current.parent_id);
    if (!parent) break;
    breadcrumbs.unshift({ id: parent.id, title: parent.title });
    current = parent;
  }
  return breadcrumbs;
}

function getSubtaskStats(taskId) {
  const db = getDb();
  const r = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status IN ('done', 'delayed_done') THEN 1 ELSE 0 END) as done
    FROM tasks
    WHERE parent_id = ? AND is_deleted = 0
  `).get(taskId);
  return {
    subtask_count: r ? Number(r.total || 0) : 0,
    subtask_done_count: r ? Number(r.done || 0) : 0,
  };
}

function listSubtasks(parentTaskId, options = {}) {
  const db = getDb();
  const rows = db.prepare(`
    SELECT * FROM tasks
    WHERE parent_id = ? AND is_deleted = 0
    ORDER BY sort_order ASC, created_at ASC
  `).all(parentTaskId);
  return rows.map((row) => enrichTask(row, options));
}

/**
 * 丰富任务信息 (兼容旧 enrichTask)
 */
function enrichTask(task, options = {}) {
  const creator = buildMemberProfile(task.creator_id);
  const deletedBy = task.deleted_by ? buildMemberProfile(task.deleted_by) : null;
  const assignee = task.assignee_id ? buildMemberProfile(task.assignee_id) : null;
  const pIds = uniqueIds(task.participant_ids);
  const participants = pIds.map(buildMemberProfile).filter(Boolean);
  const subtaskStats = getSubtaskStats(task.id);

  return {
    ...task,
    parent_id: task.parent_id || null,
    subtask_count: subtaskStats.subtask_count,
    subtask_done_count: subtaskStats.subtask_done_count,
    breadcrumbs: getTaskBreadcrumbs(task.id),
    participant_ids: pIds,
    is_deleted: isTaskDeleted(task),
    creator_name: creator?.name,
    creator_avatar: creator?.avatar,
    team_name: getTeamName(task.team_id),
    assignee_name: assignee?.name,
    assignee_avatar: assignee?.avatar,
    participants,
    deleted_by_name: deletedBy?.name,
    attachment_count: getAttachmentCount(task.id),
    comment_count: getCommentCount(task.id),
    my_relation_keys: buildMyTaskRelationKeys(task, options.userId),
    my_role_labels: buildRoleLabels(task, options.userId),
    can_view_team_members: task.team_id ? canUserViewTeamMembers(options.userId, task.team_id) : true,
    is_team_admin: options.userId ? (
      task.team_id
        ? (require('../services/permissionCache').isSuperAdmin(options.userId) || require('../services/permissionCache').hasTeamPermission(options.userId, task.team_id, 'team:task:edit_all'))
        : (task.creator_id === options.userId || require('../services/permissionCache').isSuperAdmin(options.userId))
    ) : false,
    ...(options.includeAttachments ? { attachments: getAttachments(task.id) } : {}),
    ...(options.includeSubtasks ? { subtasks: listSubtasks(task.id, options) } : {}),
  };
}

// ──────────────────────────────────────────
// 核心 CRUD
// ──────────────────────────────────────────

function findById(taskId, options = {}) {
  const db = getDb();
  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
  if (!task) return null;
  if (!options.includeDeleted && isTaskDeleted(task)) return null;
  return options.enrich ? enrichTask(task, options) : task;
}

function upsert(task) {
  const db = getDb();
  const stamp = nowIso();
  const id = task.id || generateId();
  const status = normalizeTaskStatus(task.status);
  const statusUpdatedAt = task.status_updated_at || task.updated_at || stamp;
  const delayedAt = task.delayed_at || (isDelayedTaskStatus(status) ? stamp : null);
  const completedAt = task.completed_at || (isCompletedTaskStatus(status) ? stamp : null);
  const pIds = typeof task.participant_ids === 'string'
    ? task.participant_ids
    : JSON.stringify(task.participant_ids || []);
  const parentId = task.parent_id && String(task.parent_id).trim() ? String(task.parent_id).trim() : null;
  if (parentId) {
    assertNoCircularDependency(id, parentId);
  }

  const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);

  if (existing) {
    db.prepare(`
      UPDATE tasks SET
        title = @title, description = @description, status = @status, priority = @priority,
        team_id = @team_id, parent_id = @parent_id, creator_id = @creator_id, assignee_id = @assignee_id,
        participant_ids = @participant_ids, start_date = @start_date, due_date = @due_date,
        completed_at = @completed_at, sort_order = @sort_order, is_deleted = @is_deleted,
        deleted_at = @deleted_at, deleted_by = @deleted_by, updated_at = @updated_at,
        reminder_rule = @reminder_rule, reminder_at = @reminder_at, reminder_sent = @reminder_sent,
        status_updated_at = @status_updated_at, delayed_at = @delayed_at,
        periodic_interval_days = @periodic_interval_days, periodic_time = @periodic_time, next_periodic_at = @next_periodic_at
      WHERE id = @id
    `).run({
      id,
      title: task.title || '',
      description: task.description || '',
      status,
      priority: task.priority || 'medium',
      team_id: task.team_id && String(task.team_id).trim() ? String(task.team_id).trim() : null,
      parent_id: parentId,
      creator_id: task.creator_id || '',
      assignee_id: task.assignee_id || '',
      participant_ids: pIds,
      start_date: task.start_date || null,
      due_date: task.due_date || null,
      completed_at: completedAt,
      sort_order: task.sort_order ?? 1,
      is_deleted: task.is_deleted ? 1 : 0,
      deleted_at: task.deleted_at || null,
      deleted_by: task.deleted_by || null,
      updated_at: task.updated_at || stamp,
      reminder_rule: (task.reminder_rule && task.reminder_rule !== 'none') ? task.reminder_rule : null,
      reminder_at: computeReminderAt(task.due_date, task.reminder_rule, task.periodic_time),
      reminder_sent: 0,
      status_updated_at: statusUpdatedAt,
      delayed_at: delayedAt,
      periodic_interval_days: task.periodic_interval_days || null,
      periodic_time: task.periodic_time || null,
      next_periodic_at: task.next_periodic_at || computeNextPeriodicReminderAt(task.periodic_interval_days, task.periodic_time),
    });
    logActivity(id, task.creator_id, 'task.update_full', null, null);
  } else {
    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, team_id, parent_id, creator_id, assignee_id,
        participant_ids, start_date, due_date, completed_at, sort_order, is_deleted,
        deleted_at, deleted_by, created_at, updated_at,
        reminder_rule, reminder_at, reminder_sent, status_updated_at, delayed_at,
        periodic_interval_days, periodic_time, next_periodic_at)
      VALUES (@id, @title, @description, @status, @priority, @team_id, @parent_id, @creator_id, @assignee_id,
        @participant_ids, @start_date, @due_date, @completed_at, @sort_order, @is_deleted,
        @deleted_at, @deleted_by, @created_at, @updated_at,
        @reminder_rule, @reminder_at, @reminder_sent, @status_updated_at, @delayed_at,
        @periodic_interval_days, @periodic_time, @next_periodic_at)
    `).run({
      id,
      title: task.title || '',
      description: task.description || '',
      status,
      priority: task.priority || 'medium',
      team_id: task.team_id && String(task.team_id).trim() ? String(task.team_id).trim() : null,
      parent_id: parentId,
      creator_id: task.creator_id || '',
      assignee_id: task.assignee_id || '',
      participant_ids: pIds,
      start_date: task.start_date || null,
      due_date: task.due_date || null,
      completed_at: completedAt,
      sort_order: task.sort_order ?? 1,
      is_deleted: task.is_deleted ? 1 : 0,
      deleted_at: task.deleted_at || null,
      deleted_by: task.deleted_by || null,
      created_at: task.created_at || stamp,
      updated_at: task.updated_at || stamp,
      reminder_rule: (task.reminder_rule && task.reminder_rule !== 'none') ? task.reminder_rule : null,
      reminder_at: computeReminderAt(task.due_date, task.reminder_rule, task.periodic_time),
      reminder_sent: 0,
      status_updated_at: statusUpdatedAt,
      delayed_at: delayedAt,
      periodic_interval_days: task.periodic_interval_days || null,
      periodic_time: task.periodic_time || null,
      next_periodic_at: task.next_periodic_at || computeNextPeriodicReminderAt(task.periodic_interval_days, task.periodic_time),
    });
    logActivity(id, task.creator_id, 'task.create', null, null);

    // 触发 task.created 事件（新任务创建）
    const createdTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
    const createdPIds = uniqueIds(createdTask?.participant_ids);
    if (createdTask && (createdTask.assignee_id || createdPIds.length > 0)) {
      notificationEvents.emit('task.created', {
        bizType: 'task',
        bizId: id,
        actorId: task.creator_id,
        data: {
          title: createdTask.title,
          targetUserId: createdTask.assignee_id,
        },
      });
    }
  }

  stakeholderCache.invalidate(id);
  return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
}

function update(taskId, patch, operatorId = 'system') {
  const task = findById(taskId);
  if (!task) return null;

  const stamp = nowIso();
  const nextPatch = { ...patch };
  if (nextPatch.status !== undefined) {
    nextPatch.status = normalizeTaskStatus(nextPatch.status, task.status || TASK_STATUS.IN_PROGRESS);
  }
  const fields = [];
  const params = { id: taskId };

  const allowedFields = [
    'title', 'description', 'status', 'priority', 'assignee_id',
    'participant_ids', 'start_date', 'due_date', 'sort_order',
    'reminder_rule', 'periodic_interval_days', 'periodic_time',
    'team_id', 'parent_id'
  ];

  for (const field of allowedFields) {
    if (nextPatch[field] !== undefined) {
      if (field === 'participant_ids') {
        const val = typeof nextPatch[field] === 'string' ? nextPatch[field] : JSON.stringify(nextPatch[field]);
        fields.push(`${field} = @${field}`);
        params[field] = val;
      } else if (field === 'team_id' || field === 'parent_id') {
        const val = nextPatch[field] && String(nextPatch[field]).trim() ? String(nextPatch[field]).trim() : null;
        if (field === 'parent_id') {
          assertNoCircularDependency(taskId, val);
        }
        fields.push(`${field} = @${field}`);
        params[field] = val;
      } else {
        fields.push(`${field} = @${field}`);
        params[field] = nextPatch[field];
      }
    }
  }

  if (nextPatch.status !== undefined && nextPatch.status !== task.status) {
    fields.push('status_updated_at = @status_updated_at');
    params.status_updated_at = stamp;
    if (isDelayedTaskStatus(nextPatch.status) && !task.delayed_at) {
      fields.push('delayed_at = @delayed_at');
      params.delayed_at = stamp;
    }
  }

  if (isCompletedTaskStatus(nextPatch.status) && !task.completed_at) {
    fields.push('completed_at = @completed_at');
    params.completed_at = stamp;
  }

  if (nextPatch.status && !isCompletedTaskStatus(nextPatch.status) && task.completed_at) {
    fields.push('completed_at = @completed_at');
    params.completed_at = null;
  }

  // ── 提醒字段联动计算 ──
  const effectiveDueDate = nextPatch.due_date !== undefined ? nextPatch.due_date : task.due_date;
  const effectiveRule = nextPatch.reminder_rule !== undefined ? nextPatch.reminder_rule : task.reminder_rule;
  const effectiveTime = nextPatch.periodic_time !== undefined ? nextPatch.periodic_time : task.periodic_time;

  if (nextPatch.reminder_rule !== undefined || nextPatch.due_date !== undefined || nextPatch.periodic_time !== undefined) {
    const nextRule = effectiveRule === 'none' ? null : effectiveRule;
    const nextAt = computeReminderAt(effectiveDueDate, nextRule, effectiveTime);

    fields.push('reminder_rule = @reminder_rule');
    params.reminder_rule = nextRule || null;
    fields.push('reminder_at = @reminder_at');
    params.reminder_at = nextAt;
    fields.push('reminder_sent = @reminder_sent');
    params.reminder_sent = nextAt ? 0 : 0;
  }

  // ── 周期提醒逻辑计算 ──
  if (nextPatch.periodic_interval_days !== undefined || nextPatch.periodic_time !== undefined) {
    const nextInterval = nextPatch.periodic_interval_days !== undefined ? nextPatch.periodic_interval_days : task.periodic_interval_days;
    const nextTime = nextPatch.periodic_time !== undefined ? nextPatch.periodic_time : task.periodic_time;
    const nextPeriodicAt = computeNextPeriodicReminderAt(nextInterval, nextTime);
    fields.push('next_periodic_at = @next_periodic_at');
    params.next_periodic_at = nextPeriodicAt;
  }

  // due_date 被清除时，同步清除提醒
  if (nextPatch.due_date === null && task.reminder_rule) {
    fields.push('reminder_rule = @reminder_rule');
    params.reminder_rule = null;
    fields.push('reminder_at = @reminder_at');
    params.reminder_at = null;
    fields.push('reminder_sent = @reminder_sent');
    params.reminder_sent = 0;
  }

  fields.push('updated_at = @updated_at');
  params.updated_at = stamp;

  if (fields.length > 0) {
    getDb().prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = @id`).run(params);

    // Log modifications
    const updatedFields = Object.keys(nextPatch).filter(k => allowedFields.includes(k) && nextPatch[k] !== task[k]);
    for (const config of updatedFields) {
      logActivity(taskId, operatorId, `update.${config}`, JSON.stringify(task[config]), JSON.stringify(nextPatch[config]));
    }

    if (updatedFields.length > 0) {
      if (updatedFields.includes('status')) {
        closeTodoWhenTaskEntersTerminalStatus(task, nextPatch.status);
      }

      // 已触发即时事件的字段不再进入聚合通知，避免重复
      const immediateFields = new Set(['assignee_id', 'participant_ids']);
      const aggregateFields = updatedFields.filter(f => !immediateFields.has(f));

      if (aggregateFields.length > 0) {
        const changeItems = aggregateFields.map((field) => (
          notificationAggregation.normalizeFieldChange(field, task[field], nextPatch[field])
        ));

        notificationAggregation.enqueueTaskChanges({
          taskId,
          actorId: operatorId,
          changeItems,
        });
      }

      // 触发即时事件：负责人变更
      if (updatedFields.includes('assignee_id')) {
        const oldAssigneeId = task.assignee_id;
        const newAssigneeId = nextPatch.assignee_id;

        if (oldAssigneeId && newAssigneeId && oldAssigneeId !== newAssigneeId) {
          // 负责人重新分配
          notificationEvents.emit('task.reassigned', {
            bizType: 'task',
            bizId: taskId,
            actorId: operatorId,
            data: {
              title: task.title,
              targetUserId: newAssigneeId,
              oldAssigneeId,
            },
          });
        } else if (!oldAssigneeId && newAssigneeId) {
          // 首次分配负责人
          notificationEvents.emit('task.assigned', {
            bizType: 'task',
            bizId: taskId,
            actorId: operatorId,
            data: {
              title: task.title,
              targetUserId: newAssigneeId,
            },
          });
        }
      }

      // 触发即时事件：参与人变更
      if (updatedFields.includes('participant_ids')) {
        const oldParticipants = new Set(
          typeof task.participant_ids === 'string'
            ? JSON.parse(task.participant_ids || '[]')
            : (task.participant_ids || [])
        );
        const newParticipants = new Set(
          typeof nextPatch.participant_ids === 'string'
            ? JSON.parse(nextPatch.participant_ids || '[]')
            : (nextPatch.participant_ids || [])
        );

        const added = [...newParticipants].filter(id => !oldParticipants.has(id));
        const removed = [...oldParticipants].filter(id => !newParticipants.has(id));

        if (added.length > 0) {
          notificationEvents.emit('task.participant_added', {
            bizType: 'task',
            bizId: taskId,
            actorId: operatorId,
            data: {
              title: task.title,
              addedUserIds: added,
            },
          });
        }

        if (removed.length > 0) {
          notificationEvents.emit('task.participant_removed', {
            bizType: 'task',
            bizId: taskId,
            actorId: operatorId,
            data: {
              title: task.title,
              removedUserIds: removed,
            },
          });
        }
      }
    }
  }

  stakeholderCache.invalidate(taskId);
  return enrichTask(getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId));
}

function updateStatus(taskId, status, sortOrder, operatorId = 'system') {
  const task = findById(taskId);
  if (!task) return null;

  const stamp = nowIso();
  const nextStatus = normalizeTaskStatus(status, task.status || TASK_STATUS.IN_PROGRESS);
  const params = { id: taskId, status: nextStatus, updated_at: stamp };
  let sql = 'UPDATE tasks SET status = @status, updated_at = @updated_at, status_updated_at = @status_updated_at';
  params.status_updated_at = stamp;

  if (sortOrder !== undefined) {
    sql += ', sort_order = @sort_order';
    params.sort_order = sortOrder;
  }

  if (isDelayedTaskStatus(nextStatus) && !task.delayed_at) {
    sql += ', delayed_at = @delayed_at';
    params.delayed_at = stamp;
  }

  if (isCompletedTaskStatus(nextStatus)) {
    sql += ', completed_at = COALESCE(completed_at, @completed_at)';
    params.completed_at = stamp;
  }

  if (!isCompletedTaskStatus(nextStatus) && task.completed_at) {
    sql += ', completed_at = NULL';
  }

  sql += ' WHERE id = @id';
  getDb().prepare(sql).run(params);

  logActivity(taskId, operatorId, 'status.change', task.status, nextStatus);

  if (task.status !== nextStatus) {
    closeTodoWhenTaskEntersTerminalStatus(task, nextStatus);

    notificationAggregation.enqueueTaskChanges({
      taskId,
      actorId: operatorId,
      changeItems: [notificationAggregation.normalizeFieldChange('status', task.status, nextStatus)],
    });
  }

  stakeholderCache.invalidate(taskId);
  return enrichTask(getDb().prepare('SELECT * FROM tasks WHERE id = ?').get(taskId));
}

function softDelete(taskId, userId) {
  const task = findById(taskId);
  if (!task) return null;

  const stamp = nowIso();
  const db = getDb();

  // 递归收集所有后代子任务 ID
  const descendantIds = [];
  const queue = [taskId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND is_deleted = 0').all(currentId);
    for (const child of children) {
      descendantIds.push(child.id);
      queue.push(child.id);
    }
  }

  const allIds = [taskId, ...descendantIds];
  const placeholders = allIds.map(() => '?').join(',');
  db.prepare(`
    UPDATE tasks SET is_deleted = 1, deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id IN (${placeholders})
  `).run(stamp, userId, stamp, ...allIds);
  
  for (const id of allIds) {
    logActivity(id, userId, 'task.delete', null, null);
    notificationAggregation.enqueueTaskChanges({
      taskId: id,
      actorId: userId,
      changeItems: [{ type: 'task_deleted' }],
    });
    stakeholderCache.invalidate(id);
  }

  return enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId), { userId });
}

function restore(taskId, userId) {
  const task = findById(taskId, { includeDeleted: true });
  if (!task || !isTaskDeleted(task) || task.deleted_by !== userId) return null;

  const stamp = nowIso();
  const db = getDb();

  // 递归收集所有被一同删除的后代任务
  const descendantIds = [];
  const queue = [taskId];
  while (queue.length > 0) {
    const currentId = queue.shift();
    const children = db.prepare('SELECT id FROM tasks WHERE parent_id = ? AND is_deleted = 1 AND deleted_by = ?').all(currentId, userId);
    for (const child of children) {
      descendantIds.push(child.id);
      queue.push(child.id);
    }
  }

  const allIds = [taskId, ...descendantIds];
  const placeholders = allIds.map(() => '?').join(',');
  db.prepare(`
    UPDATE tasks SET is_deleted = 0, deleted_at = NULL, deleted_by = NULL, updated_at = ? WHERE id IN (${placeholders})
  `).run(stamp, ...allIds);

  for (const id of allIds) {
    logActivity(id, userId, 'task.restore', null, null);
    notificationAggregation.enqueueTaskChanges({
      taskId: id,
      actorId: userId,
      changeItems: [{ type: 'task_restored' }],
    });
    stakeholderCache.invalidate(id);
  }

  return enrichTask(db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId), { userId });
}

// ──────────────────────────────────────────
// 查询
// ──────────────────────────────────────────

function matchKeyword(keyword) {
  if (!keyword) return { condition: '', params: [] };
  const kw = `%${keyword}%`;
  return { condition: "AND (title LIKE ? OR description LIKE ?)", params: [kw, kw] };
}

function listByTeam(teamId, filters = {}) {
  const db = getDb();
  const conditions = ['team_id = ?', 'is_deleted = 0'];
  const params = [teamId];

  if (filters.status === 'unfinished' || filters.status === LEGACY_TODO_STATUS) {
    conditions.push("status NOT IN ('done', 'delayed_done', 'canceled')");
  } else if (filters.status) {
    conditions.push('status = ?');
    params.push(normalizeTaskStatus(filters.status));
  }
  if (filters.priority) { conditions.push('priority = ?'); params.push(filters.priority); }
  if (filters.assignee_id) { conditions.push('assignee_id = ?'); params.push(filters.assignee_id); }
  if (filters.dueStartDate) { conditions.push('due_date >= ?'); params.push(filters.dueStartDate); }
  if (filters.dueEndDate) { conditions.push('due_date <= ?'); params.push(filters.dueEndDate); }

  if (filters.userId && getTeamMemberTaskVisibilityScope(filters.userId, teamId) === 'self') {
    const scopeFilter = buildTaskSelfVisibilityFilter(filters.userId);
    conditions.push(scopeFilter.condition);
    params.push(...scopeFilter.params);
  }

  // 应用数据范围过滤
  if (filters.userId && filters.dataScope) {
    const scopeFilter = buildTaskScopeFilter({
      userId: filters.userId,
      dataScope: filters.dataScope,
      teamId,
    });
    conditions.push(scopeFilter.condition);
    params.push(...scopeFilter.params);
  }

  const kw = matchKeyword(String(filters.keyword || '').trim());
  const sql = `SELECT * FROM tasks WHERE ${conditions.join(' AND ')} ${kw.condition} ORDER BY sort_order ASC, created_at DESC`;
  const list = db.prepare(sql).all(...params, ...kw.params);

  return {
    list: list.map(t => enrichTask(t, { userId: filters.userId })),
    total: list.length,
  };
}

function listAllVisible() {
  const db = getDb();
  return db.prepare('SELECT * FROM tasks WHERE is_deleted = 0').all();
}

/**
 * 判断用户是否为任务的相关人员（创建者、负责人、参与者）或团队管理员
 */
function isTaskRelatedOrAdmin(task, userId) {
  if (!userId) return false;

  const permissionCache = require('../services/permissionCache');
  // 超管
  if (permissionCache.isSuperAdmin(userId)) return true;

  if (isTaskRelated(task, userId)) {
    return true;
  }

  if (task.team_id && getTeamMemberTaskVisibilityScope(userId, task.team_id) === 'self') {
    return false;
  }

  // 团队管理员
  if (task.team_id && permissionCache.hasTeamPermission(userId, task.team_id, 'team:task:edit_all')) {
    return true;
  }

  return false;
}

function canMentionTaskExternalMember(task, userId) {
  if (!task || !userId) return false;

  const permissionCache = require('../services/permissionCache');
  if (permissionCache.isSuperAdmin(userId)) return true;

  if (task.team_id && permissionCache.hasTeamPermission(userId, task.team_id, 'team:task:edit_all')) {
    return true;
  }

  return task.creator_id === userId || task.assignee_id === userId;
}

function canUserAccessVisibleTask(task, userId) {
  if (!userId) return false;

  // 超管可访问所有任务
  const permissionCache = require('../services/permissionCache');
  if (permissionCache.isSuperAdmin(userId)) return true;

  // 团队成员均可查看本团队任务 (方案 B：基础信息透明)
  const roleDao = require('./roleDao');
  if (task.team_id && roleDao.isTeamMember(userId, task.team_id)) {
    if (getTeamMemberTaskVisibilityScope(userId, task.team_id) === 'self') {
      return isTaskRelated(task, userId);
    }
    return true;
  }

  // 兜底：任务相关人
  return isTaskRelatedOrAdmin(task, userId);
}

function listVisibleForScope(options = {}) {
  const scope = String(options.scope || 'all');
  const userId = options.userId;
  const teamId = options.teamId;
  const db = getDb();

  const conditions = ['is_deleted = 0'];
  const params = [];

  if (teamId) { conditions.push('team_id = ?'); params.push(teamId); }

  let list = db.prepare(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')}`).all(...params);

  if (scope === 'self') {
    const uid = String(userId || '').trim();
    if (!uid) return [];
    list = list.filter(t => canUserAccessVisibleTask(t, uid));
  }

  return list;
}

function filterByMyScope(tasks, userId, scope = 'assigned') {
  return tasks.filter((task) => {
    const relationKeys = buildMyTaskRelationKeys(task, userId) || [];

    if (scope === 'all') {
      return relationKeys.length > 0;
    }

    return relationKeys.includes(scope);
  });
}

function filterByStatus(tasks, status = 'all') {
  if (status === 'all') return tasks;
  if (status === 'overdue') return tasks.filter(t => isOverdue(t));
  if (status === 'unfinished' || status === LEGACY_TODO_STATUS) {
    return tasks.filter(t => !isTerminalTaskStatus(t.status));
  }
  const normalizedStatus = normalizeTaskStatus(status);
  return tasks.filter(t => t.status === normalizedStatus);
}

function sortMyTasks(left, right) {
  const lo = isOverdue(left), ro = isOverdue(right);
  if (lo !== ro) return lo ? -1 : 1;
  if (left.due_date && right.due_date && left.due_date !== right.due_date) return left.due_date.localeCompare(right.due_date);
  if (left.due_date && !right.due_date) return -1;
  if (!left.due_date && right.due_date) return 1;
  return String(right.updated_at).localeCompare(String(left.updated_at));
}

function listMyTasks(userId, filters = {}) {
  const visibleTasks = listAllVisible();
  const summary = {
    all: filterByMyScope(visibleTasks, userId, 'all').length,
    assigned: filterByMyScope(visibleTasks, userId, 'assigned').length,
    participating: filterByMyScope(visibleTasks, userId, 'participating').length,
    created: filterByMyScope(visibleTasks, userId, 'created').length,
    shared: 0,
  };

  let list = filterByMyScope(visibleTasks, userId, filters.scope || 'all');
  list = filterByStatus(list, filters.status || 'all');
  if (filters.priority) list = list.filter(t => t.priority === filters.priority);
  if (filters.keyword) {
    const kw = String(filters.keyword).trim();
    list = list.filter(t => t.title.includes(kw) || String(t.description || '').includes(kw));
  }
  if (filters.dueStartDate) {
    list = list.filter(t => t.due_date && t.due_date >= filters.dueStartDate);
  }
  if (filters.dueEndDate) {
    list = list.filter(t => t.due_date && t.due_date <= filters.dueEndDate);
  }

  list = list.slice().sort(sortMyTasks).map(t => enrichTask(t, { userId }));

  return { list, total: list.length, summary };
}

function listDeletedBy(userId, filters = {}) {
  const db = getDb();
  const kw = matchKeyword(String(filters.keyword || '').trim());
  const sql = `SELECT * FROM tasks WHERE is_deleted = 1 AND deleted_by = ? ${kw.condition} ORDER BY deleted_at DESC`;
  const list = db.prepare(sql).all(userId, ...kw.params);
  return list.map(t => enrichTask(t, { userId }));
}

function findTrashDetail(taskId, userId) {
  const task = findById(taskId, { includeDeleted: true });
  if (!task || !isTaskDeleted(task) || task.deleted_by !== userId) return null;
  return enrichTask(task, { userId, includeAttachments: true });
}

function shareTask(taskId, userId, receiverIds = []) {
  const task = findById(taskId, { includeDeleted: true });
  if (!task || isTaskDeleted(task)) return null;
  if (!canUserAccessVisibleTask(task, userId)) {
    const err = new Error('当前成员没有分享该任务的权限');
    err.code = 'FORBIDDEN';
    throw err;
  }
  notificationAggregation.enqueueTaskChanges({
    taskId,
    actorId: userId,
    changeItems: [{ type: 'task_shared' }],
  });

  return {
    taskId, channel: 'dingtalk-card',
    receiverIds: uniqueIds(receiverIds),
    sharedBy: userId,
    message: '已通过钉钉卡片消息发起分享',
  };
}

// ──────────────────────────────────────────
// 活动日志 (T03.07)
// ──────────────────────────────────────────

function logActivity(taskId, userId, action, oldValue, newValue) {
  const db = getDb();
  db.prepare(`
    INSERT INTO task_activity_log (id, task_id, user_id, action, old_value, new_value, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(generateId(), taskId, userId, action, oldValue || null, newValue || null, nowIso());
}

module.exports = {
  findById,
  findTrashDetail,
  isTaskDeleted,
  listByTeam,
  listDeletedBy,
  listMyTasks,
  listVisibleForScope,
  listAllVisible,
  restore,
  shareTask,
  softDelete,
  update,
  updateStatus,
  upsert,
  enrichTask,
  logActivity,
  assertNoCircularDependency,
  getTaskBreadcrumbs,
  getSubtaskStats,
  listSubtasks,
  canUserAccessVisibleTask,
  canMentionTaskExternalMember,
  isTaskRelatedOrAdmin,
  uniqueIds,
  computeNextPeriodicReminderAt,
};
