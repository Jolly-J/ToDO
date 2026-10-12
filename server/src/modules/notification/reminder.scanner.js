/**
 * 任务提醒扫描器
 *
 * 每 60 秒扫描 tasks 表中 reminder_at <= now 且 reminder_sent = 0 的记录，
 * 标记为已发送并触发 task.reminder 通知事件。
 */

const { getDb } = require('../../db/sqlite');
const { nowIso } = require('../../utils/datetime');
const notificationEvents = require('./notification.events');
const logger = require('../../utils/logger');
const { computeNextPeriodicReminderAt } = require('../../db/taskDao');

const SCAN_INTERVAL_MS = 60 * 1000;
const BATCH_LIMIT = 50;

let scanTimer = null;

function scanDueReminders() {
  const now = nowIso();
  let rows = [];

  try {
    rows = getDb().prepare(`
      SELECT id, title, due_date, reminder_rule, reminder_at, creator_id, assignee_id
      FROM tasks
      WHERE reminder_at IS NOT NULL
        AND reminder_at <= ?
        AND reminder_sent = 0
        AND is_deleted = 0
        AND status NOT IN ('done', 'delayed_done', 'canceled')
      ORDER BY reminder_at ASC
      LIMIT ?
    `).all(now, BATCH_LIMIT);
  } catch (error) {
    if (String(error.message || '').includes('no such column')) {
      return;
    }
    throw error;
  }

  for (const task of rows) {
    try {
      getDb().prepare('UPDATE tasks SET reminder_sent = 1 WHERE id = ?').run(task.id);

      notificationEvents.emit('task.reminder', {
        bizType: 'task',
        bizId: task.id,
        actorId: 'system',
        data: {
          title: task.title,
          dueDate: task.due_date,
          reminderRule: task.reminder_rule,
        },
      });

      logger.info('任务一次性提醒已触发', {
        action: 'reminder.fired',
        channel: 'notification',
        taskId: task.id,
        reminderRule: task.reminder_rule,
      });
    } catch (error) {
      logger.error('任务提醒触发失败', {
        action: 'reminder.fire.error',
        channel: 'notification',
        taskId: task.id,
        error: error.message,
      });
    }
  }
}

function scanPeriodicReminders() {
  const now = nowIso();
  let rows = [];

  try {
    rows = getDb().prepare(`
      SELECT id, title, creator_id, assignee_id, periodic_interval_days, periodic_time, next_periodic_at
      FROM tasks
      WHERE next_periodic_at IS NOT NULL
        AND next_periodic_at <= ?
        AND is_deleted = 0
        AND status NOT IN ('done', 'delayed_done', 'canceled')
      ORDER BY next_periodic_at ASC
      LIMIT ?
    `).all(now, BATCH_LIMIT);
  } catch (error) {
    if (String(error.message || '').includes('no such column')) {
      return;
    }
    throw error;
  }

  for (const task of rows) {
    try {
      // 计算下一次循环的时间
      const newNextAt = computeNextPeriodicReminderAt(task.periodic_interval_days, task.periodic_time);
      getDb().prepare('UPDATE tasks SET next_periodic_at = ? WHERE id = ?').run(newNextAt, task.id);

      notificationEvents.emit('task.periodic_reminder', {
        bizType: 'task',
        bizId: task.id,
        actorId: 'system',
        data: {
          title: task.title,
          reminderRule: `每 ${task.periodic_interval_days} 天 ${task.periodic_time}`,
        },
      });

      logger.info('任务周期打卡已触发', {
        action: 'periodic_reminder.fired',
        channel: 'notification',
        taskId: task.id,
        nextPeriodicAt: newNextAt,
      });
    } catch (error) {
      logger.error('任务周期提醒触发失败', {
        action: 'periodic_reminder.fire.error',
        channel: 'notification',
        taskId: task.id,
        error: error.message,
      });
    }
  }
}

function start() {
  if (scanTimer) return;

  scanTimer = setInterval(() => {
    try {
      scanDueReminders();
      scanPeriodicReminders();
    } catch (error) {
      logger.error('提醒扫描异常', {
        action: 'reminder.scan.error',
        channel: 'notification',
        error: error.message,
      });
    }
  }, SCAN_INTERVAL_MS);

  if (typeof scanTimer.unref === 'function') {
    scanTimer.unref();
  }

  logger.debug('ReminderScanner 已启动', { action: 'reminder.scanner.start' });
}

function stop() {
  if (!scanTimer) return;
  clearInterval(scanTimer);
  scanTimer = null;
}

module.exports = { start, stop, scanDueReminders, scanPeriodicReminders };
