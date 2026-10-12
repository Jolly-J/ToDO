/**
 * 通知聚合器
 *
 * 负责合并短时间窗口内的任务变更并触发汇总通知事件。
 */
const { getDb } = require('../../db/sqlite');
const { generateId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');
const notificationEvents = require('./notification.events');
const logger = require('../../utils/logger');

const BIZ_TYPE_TASK = 'task';
const WINDOW_SECONDS = 30;
const FLUSH_SCAN_INTERVAL_MS = 1000;

let flushTimer = null;

const FIELD_LABELS = {
  title: '标题',
  description: '描述',
  status: '状态',
  priority: '优先级',
  assignee_id: '负责人',
  participant_ids: '参与人',
  start_date: '开始时间',
  due_date: '截止时间',
  reminder_rule: '一次性提醒',
  periodic_interval_days: '循环周期提醒',
  periodic_time: '提醒时刻',
};

const STATUS_LABELS = {
  in_progress: '进行中',
  delayed_in_progress: '延期进行中',
  done: '已完成',
  delayed_done: '延期完成',
  canceled: '已取消',
};

const PRIORITY_LABELS = {
  urgent: '紧急',
  high: '高',
  medium: '中',
  low: '低',
};

const MAX_SUMMARY_LINES = 6;

function parseJson(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeIdList(value) {
  if (Array.isArray(value)) return value.filter(Boolean).map(String);
  if (!value) return [];
  if (typeof value === 'string') {
    const parsed = parseJson(value, null);
    if (Array.isArray(parsed)) return parsed.filter(Boolean).map(String);
    return value ? [value] : [];
  }
  return [];
}

function getUserNameById(userId) {
  if (!userId) return '未设置';
  const user = getDb().prepare('SELECT name FROM users WHERE id = ?').get(String(userId));
  return user?.name || String(userId);
}

const REMINDER_LABELS = {
  due_15m: '截止前 15 分钟',
  due_30m: '截止前 30 分钟',
  due_1h: '截止前 1 小时',
  due_3h: '截止前 3 小时',
  due_1d: '截止前 1 天',
  due_3d: '截止前 3 天',
  none: '不提醒',
};

function formatValue(field, value) {
  if (field === 'status') {
    return STATUS_LABELS[value] || String(value || '未设置');
  }
  if (field === 'priority') {
    return PRIORITY_LABELS[value] || String(value || '未设置');
  }
  if (field === 'reminder_rule') {
    if (!value || value === 'none') return '不提醒';
    return REMINDER_LABELS[value] || String(value);
  }
  if (field === 'periodic_interval_days') {
    if (!value || Number(value) === 0) return '不重复';
    const INTERVAL_LABELS = { 1: '每天', 2: '每 2 天', 3: '每 3 天', 5: '每 5 天', 7: '每周', 14: '每两周' };
    return INTERVAL_LABELS[Number(value)] || `每 ${value} 天`;
  }
  if (field === 'periodic_time') {
    return value ? String(value) : '未设置';
  }
  if (field === 'assignee_id') {
    return getUserNameById(value);
  }
  if (field === 'start_date' || field === 'due_date') {
    return value ? String(value) : '未设置';
  }
  if (field === 'title') {
    return value ? String(value) : '未命名';
  }
  if (field === 'description') {
    if (!value) return '空';
    const text = String(value).replace(/\s+/g, ' ').trim();
    return text.length > 40 ? `${text.slice(0, 40)}...` : text;
  }
  return value === null || value === undefined ? '未设置' : String(value);
}

function formatFieldChange(item) {
  const field = item.field;
  if (field === 'participant_ids') {
    const before = new Set(normalizeIdList(item.oldValue));
    const after = new Set(normalizeIdList(item.newValue));
    const added = [...after].filter((id) => !before.has(id));
    const removed = [...before].filter((id) => !after.has(id));
    const parts = [];
    if (added.length) {
      parts.push(`新增：${added.map(getUserNameById).join('、')}`);
    }
    if (removed.length) {
      parts.push(`移除：${removed.map(getUserNameById).join('、')}`);
    }
    if (!parts.length) {
      return `${item.label}已更新`;
    }
    return `${item.label}（${parts.join('；')}）`;
  }

  if (field === 'description') {
    return '描述已更新';
  }

  const before = formatValue(field, item.oldValue);
  const after = formatValue(field, item.newValue);
  return `${item.label}：${before} → ${after}`;
}

function isMissingTableError(error) {
  return Boolean(
    error &&
    error.code === 'SQLITE_ERROR' &&
    String(error.message || '').includes('notification_aggregation_sessions')
  );
}

function toDueAtIso(baseTime = Date.now()) {
  const d = new Date(baseTime + WINDOW_SECONDS * 1000);
  return d.toISOString();
}

function normalizeFieldChange(field, oldValue, newValue) {
  return {
    type: 'field_change',
    field,
    label: FIELD_LABELS[field] || field,
    oldValue: oldValue ?? null,
    newValue: newValue ?? null,
  };
}

function mergeChangeItems(existingItems, incomingItems) {
  const merged = new Map();

  for (const item of existingItems || []) {
    const key = item.type === 'field_change'
      ? `${item.type}:${item.field}`
      : item.type;
    merged.set(key, { ...item });
  }

  for (const item of incomingItems || []) {
    if (!item || !item.type) continue;

    const key = item.type === 'field_change'
      ? `${item.type}:${item.field}`
      : item.type;

    if (item.type === 'comment') {
      const prev = merged.get(key);
      const count = Math.max(1, Number(item.count || 1));
      merged.set(key, { type: 'comment', count: Number(prev?.count || 0) + count });
      continue;
    }

    merged.set(key, { ...item });
  }

  return [...merged.values()];
}

function enqueueTaskChanges({ taskId, actorId, changeItems }) {
  if (!taskId || !actorId || !Array.isArray(changeItems) || changeItems.length === 0) {
    return null;
  }

  const MAX_RETRIES = 3;

  try {
    const db = getDb();

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      const stamp = nowIso();
      const dueAt = toDueAtIso();

      const session = db.prepare(`
        SELECT * FROM notification_aggregation_sessions
        WHERE biz_type = ? AND biz_id = ? AND actor_id = ?
        LIMIT 1
      `).get(BIZ_TYPE_TASK, taskId, actorId);

      if (!session) {
        const id = generateId();
        db.prepare(`
          INSERT INTO notification_aggregation_sessions
            (id, biz_type, biz_id, actor_id, change_items, due_at, created_at, updated_at)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          id,
          BIZ_TYPE_TASK,
          taskId,
          actorId,
          JSON.stringify(changeItems),
          dueAt,
          stamp,
          stamp
        );
        const fields = changeItems.filter(i => i.type === 'field_change').map(i => i.field);
        logger.info('聚合入队', {
          action: 'notify.aggregate.enqueue',
          channel: 'notification',
          taskId,
          fields: fields.length > 0 ? fields : undefined,
          itemCount: changeItems.length,
        });
        return id;
      }

      const existingItems = parseJson(session.change_items, []);
      const mergedItems = mergeChangeItems(existingItems, changeItems);

      // 乐观锁：WHERE 条件加上 updated_at，防止并发覆盖
      const updated = db.prepare(`
        UPDATE notification_aggregation_sessions
        SET change_items = ?, due_at = ?, updated_at = ?
        WHERE id = ? AND updated_at = ?
      `).run(
        JSON.stringify(mergedItems),
        dueAt,
        stamp,
        session.id,
        session.updated_at
      );

      if (updated.changes > 0) {
        return session.id;
      }

      // 被并发修改，重新读取后重试
      if (attempt < MAX_RETRIES) {
        logger.warn('聚合会话并发冲突，重试中', {
          action: 'notify.aggregate.conflict',
          channel: 'notification',
          taskId,
          actorId,
          attempt: attempt + 1,
        });
      } else {
        logger.warn('聚合会话并发冲突，已达重试上限', {
          action: 'notify.aggregate.conflict_max',
          channel: 'notification',
          taskId,
          actorId,
        });
        return session.id;
      }
    }

    return null;
  } catch (error) {
    if (isMissingTableError(error)) {
      return null;
    }
    throw error;
  }
}

function loadAndDeleteSessionById(sessionId) {
  if (!sessionId) return null;
  const db = getDb();
  const session = db.prepare('SELECT * FROM notification_aggregation_sessions WHERE id = ?').get(sessionId);
  if (!session) return null;

  const removed = db.prepare('DELETE FROM notification_aggregation_sessions WHERE id = ?').run(sessionId);
  if (removed.changes < 1) return null;
  return session;
}

function buildSummaryText(changeItems) {
  const lines = [];

  for (const item of changeItems) {
    if (item.type === 'field_change') {
      lines.push(formatFieldChange(item));
      continue;
    }
    if (item.type === 'comment') {
      const count = Math.max(1, Number(item.count || 1));
      lines.push(`新增评论 ${count} 条`);
      continue;
    }
    if (item.type === 'attachment_change') {
      lines.push('附件已更新');
      continue;
    }
    if (item.type === 'task_shared') {
      lines.push('任务已分享');
      continue;
    }
    if (item.type === 'task_deleted') {
      lines.push('任务已删除');
      continue;
    }
    if (item.type === 'task_restored') {
      lines.push('任务已恢复');
      continue;
    }
  }

  if (lines.length <= MAX_SUMMARY_LINES) return lines;
  const kept = lines.slice(0, MAX_SUMMARY_LINES);
  kept.push(`...等 ${lines.length - MAX_SUMMARY_LINES} 项变更`);
  return kept;
}

function flushSession(session, options = {}) {
  if (!session) return false;

  const changeItems = parseJson(session.change_items, []);
  if (!Array.isArray(changeItems) || changeItems.length === 0) {
    return false;
  }

  const task = getDb().prepare('SELECT title FROM tasks WHERE id = ?').get(session.biz_id);
  const summaryLines = buildSummaryText(changeItems);

  notificationEvents.emit('task.activity_aggregated', {
    bizType: BIZ_TYPE_TASK,
    bizId: session.biz_id,
    actorId: session.actor_id,
    reqId: options.reqId,
    data: {
      title: task?.title || '',
      summaryLines,
      changeItems,
      sessionId: session.id,
    },
  });

  logger.info('聚合发送', {
    action: 'notify.aggregate.flush',
    channel: 'notification',
    taskId: session.biz_id,
    itemCount: changeItems.length,
  });

  return true;
}

function flushByTaskActor(taskId, actorId, options = {}) {
  if (!taskId || !actorId) return { flushed: false };
  let session = null;
  try {
    session = getDb().prepare(`
      SELECT id FROM notification_aggregation_sessions
      WHERE biz_type = ? AND biz_id = ? AND actor_id = ?
      LIMIT 1
    `).get(BIZ_TYPE_TASK, taskId, actorId);
  } catch (error) {
    if (isMissingTableError(error)) return { flushed: false };
    throw error;
  }

  if (!session?.id) return { flushed: false };

  const loaded = loadAndDeleteSessionById(session.id);
  if (!loaded) return { flushed: false };

  return { flushed: flushSession(loaded, options) };
}

function flushDueSessions() {
  const now = nowIso();
  let dueRows = [];
  try {
    dueRows = getDb().prepare(`
      SELECT id
      FROM notification_aggregation_sessions
      WHERE due_at <= ?
      ORDER BY due_at ASC
      LIMIT 100
    `).all(now);
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }

  for (const row of dueRows) {
    const loaded = loadAndDeleteSessionById(row.id);
    if (!loaded) continue;

    try {
      flushSession(loaded);
    } catch (error) {
      logger.error('聚合通知 flush 失败', {
        action: 'notify.aggregate.flush.error',
        channel: 'notification',
        sessionId: row.id,
        error: error.message,
      });
    }
  }
}

function start() {
  if (flushTimer) return;

  flushTimer = setInterval(() => {
    try {
      flushDueSessions();
    } catch (error) {
      logger.error('聚合通知扫描失败', {
        action: 'notify.aggregate.scan.error',
        channel: 'notification',
        error: error.message,
      });
    }
  }, FLUSH_SCAN_INTERVAL_MS);

  if (typeof flushTimer.unref === 'function') {
    flushTimer.unref();
  }
}

function stop() {
  if (!flushTimer) return;
  clearInterval(flushTimer);
  flushTimer = null;
}

module.exports = {
  enqueueTaskChanges,
  flushByTaskActor,
  normalizeFieldChange,
  start,
  stop,
  flushDueSessions,
};
