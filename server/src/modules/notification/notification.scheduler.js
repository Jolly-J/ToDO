/**
 * 通知定时任务调度器
 *
 * 每天北京时间 08:30 扫描任务表，对临期和逾期任务触发通知事件。
 * 通过查询 notification_events 表按自然日去重避免重复触发。
 */

const cron = require('node-cron');
const { getDb } = require('../../db/sqlite');
const taskDao = require('../../db/taskDao');
const { stakeholderCache } = require('./notification.cache');
const eventBus = require('./eventBus');
const eventDao = require('./notification.event.dao');
const logger = require('../../utils/logger');
const { nowIso } = require('../../utils/datetime');

const SCAN_BATCH_SIZE = 200;

/**
 * 扫描临期任务（截止前 24 小时内，状态非完成/取消）
 */
function scanDueSoon() {
  const db = getDb();
  // due_date 存的是纯日期 'YYYY-MM-DD'，必须用同格式比较，不能用 ISO 时间戳
  const { todayDate } = require('../../utils/datetime');
  const todayStr = todayDate();
  const in1dDate = new Date(Date.now() + 8 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000)
    .toISOString().split('T')[0];

  let offset = 0;
  let emitted = 0;
  let scanned = 0;

  while (true) {
    const tasks = db.prepare(`
      SELECT id, title, due_date, assignee_id, creator_id, team_id
      FROM tasks
      WHERE due_date IS NOT NULL
        AND due_date >= ?
        AND due_date <= ?
        AND status NOT IN ('done', 'delayed_done', 'canceled')
        AND is_deleted = 0
      LIMIT ? OFFSET ?
    `).all(todayStr, in1dDate, SCAN_BATCH_SIZE, offset);

    if (tasks.length === 0) break;
    scanned += tasks.length;

    for (const task of tasks) {
      if (eventDao.eventExists(task.id, 'task.due_soon', 'system', { todayOnly: true })) continue;

      eventBus.emit('task.due_soon', {
        bizType: 'task',
        bizId: task.id,
        eventType: 'task.due_soon',
        actorId: 'system',
        data: {
          title: task.title,
          dueAt: task.due_date,
          assigneeId: task.assignee_id,
          creatorId: task.creator_id,
        },
      });
      emitted++;
    }

    if (tasks.length < SCAN_BATCH_SIZE) break;
    offset += SCAN_BATCH_SIZE;
  }

  if (emitted > 0) {
    logger.info('临期任务扫描完成', {
      action: 'scheduler.due_soon',
      channel: 'notification',
      scanned,
      emitted,
    });
  }
}

/**
 * 扫描逾期任务（截止时间已过，状态非完成/取消）
 */
function scanOverdue() {
  const db = getDb();
  // due_date 存的是纯日期 'YYYY-MM-DD'，用同格式比较
  const { todayDate } = require('../../utils/datetime');
  const todayStr = todayDate();

  let offset = 0;
  let emitted = 0;
  let scanned = 0;

  while (true) {
    const tasks = db.prepare(`
      SELECT id, title, due_date, assignee_id, creator_id, team_id
      FROM tasks
      WHERE due_date IS NOT NULL
        AND due_date < ?
        AND status NOT IN ('done', 'delayed_done', 'canceled')
        AND is_deleted = 0
      LIMIT ? OFFSET ?
    `).all(todayStr, SCAN_BATCH_SIZE, offset);

    if (tasks.length === 0) break;
    scanned += tasks.length;

    for (const task of tasks) {
      if (eventDao.eventExists(task.id, 'task.overdue', 'system', { todayOnly: true })) continue;

      eventBus.emit('task.overdue', {
        bizType: 'task',
        bizId: task.id,
        eventType: 'task.overdue',
        actorId: 'system',
        data: {
          title: task.title,
          dueAt: task.due_date,
          assigneeId: task.assignee_id,
          creatorId: task.creator_id,
        },
      });

      // 原子更新：仅 in_progress → delayed_in_progress，WHERE 前置条件消除 TOCTOU 窗口
      const stamp = nowIso();
      const result = db.prepare(`
        UPDATE tasks
        SET status = 'delayed_in_progress',
            status_updated_at = ?,
            delayed_at = COALESCE(delayed_at, ?),
            updated_at = ?
        WHERE id = ? AND status = 'in_progress' AND is_deleted = 0
      `).run(stamp, stamp, stamp, task.id);

      if (result.changes > 0) {
        taskDao.logActivity(task.id, 'system', 'status.change', 'in_progress', 'delayed_in_progress');
        stakeholderCache.invalidate(task.id);
      }

      emitted++;
    }

    if (tasks.length < SCAN_BATCH_SIZE) break;
    offset += SCAN_BATCH_SIZE;
  }

  if (emitted > 0) {
    logger.info('逾期任务扫描完成', {
      action: 'scheduler.overdue',
      channel: 'notification',
      scanned,
      emitted,
    });
  }
}

/**
 * 启动定时任务
 */
function start() {
  // 每天北京时间 08:30 执行一次临期/逾期扫描
  cron.schedule('30 8 * * *', () => {
    try {
      scanDueSoon();
      scanOverdue();
    } catch (error) {
      logger.error('定时任务执行失败', {
        action: 'scheduler.error',
        channel: 'notification',
        error: error.message,
      });
    }
  }, { timezone: 'Asia/Shanghai' });

  logger.debug('通知定时任务调度器已启动', {
    action: 'scheduler.start',
    interval: 'daily 08:30 CST',
  });
}

module.exports = {
  start,
  scanDueSoon,
  scanOverdue,
};
