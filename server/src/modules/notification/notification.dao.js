/**
 * Notification DAO — 正式持久化层
 */

const { getDb } = require('../../db/sqlite');
const { generateId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');

/**
 * 创建通知
 */
function create(notification) {
  const db = getDb();
  const id = notification.id || generateId();
  const stamp = nowIso();

  db.prepare(`
    INSERT INTO notifications (id, user_id, type, task_id, title, content, is_read, dingtalk_sent, created_at)
    VALUES (@id, @user_id, @type, @task_id, @title, @content, @is_read, @dingtalk_sent, @created_at)
  `).run({
    id,
    user_id: notification.user_id,
    type: notification.type,
    task_id: notification.task_id || null,
    title: notification.title,
    content: notification.content || '',
    is_read: 0,
    dingtalk_sent: 0,
    created_at: stamp,
  });

  return db.prepare('SELECT * FROM notifications WHERE id = ?').get(id);
}

/**
 * 获取用户通知列表 (分页)
 */
function listByUserId(userId, options = {}) {
  const db = getDb();
  const page = Math.max(1, Number(options.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(options.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  const conditions = ['user_id = ?'];
  const params = [userId];

  if (options.isRead !== undefined) {
    conditions.push('is_read = ?');
    params.push(Number(options.isRead));
  }

  const where = conditions.join(' AND ');
  const total = db.prepare(`SELECT COUNT(*) as c FROM notifications WHERE ${where}`).get(...params).c;
  const list = db.prepare(`SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`)
    .all(...params, pageSize, offset);

  return { list, total, page, pageSize };
}

/**
 * 获取未读数量
 */
function getUnreadCount(userId) {
  const db = getDb();
  const r = db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id = ? AND is_read = 0').get(userId);
  return r ? r.c : 0;
}

/**
 * 标记已读
 */
function markAsRead(notificationId, userId) {
  const db = getDb();
  return db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?')
    .run(notificationId, userId).changes;
}

/**
 * 全部标记已读
 */
function markAllAsRead(userId) {
  const db = getDb();
  return db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0')
    .run(userId).changes;
}

/**
 * 获取系统级通知健康摘要
 */
function getSystemHealthStats(options = {}) {
  const db = getDb();
  const { daysAgo } = require('../../utils/datetime');
  const windowStart = options.now
    ? new Date(new Date(options.now).getTime() - 24 * 60 * 60 * 1000).toISOString()
    : daysAgo(1);

  const total24hResult = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE created_at >= ?'
  ).get(windowStart);
  const unreadResult = db.prepare(
    'SELECT COUNT(*) as c FROM notifications WHERE is_read = 0'
  ).get();
  const latestResult = db.prepare(
    'SELECT created_at FROM notifications ORDER BY created_at DESC LIMIT 1'
  ).get();

  return {
    total24h: total24hResult?.c || 0,
    unreadTotal: unreadResult?.c || 0,
    lastCreatedAt: latestResult?.created_at || null,
  };
}

module.exports = {
  create,
  listByUserId,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  getSystemHealthStats,
};
