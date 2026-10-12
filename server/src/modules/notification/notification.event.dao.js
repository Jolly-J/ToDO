/**
 * 通知事件 DAO
 *
 * 操作 notification_events 和 delivery_logs 两张表。
 * 提供事件写入（幂等）、投递记录写入和状态更新。
 */

const { getDb } = require('../../db/sqlite');
const { generateId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');

/**
 * 创建通知事件
 *
 * @param {object} event
 * @returns {string} 事件 ID
 */
function createEvent(event) {
  const db = getDb();
  const id = event.id || generateId();
  const stamp = nowIso();

  db.prepare(`
    INSERT INTO notification_events
      (id, biz_type, biz_id, event_type, actor_id, recipient_ids, channels, template_code, template_variables, jump_url, created_at)
    VALUES
      (@id, @biz_type, @biz_id, @event_type, @actor_id, @recipient_ids, @channels, @template_code, @template_variables, @jump_url, @created_at)
  `).run({
    id,
    biz_type: event.bizType,
    biz_id: event.bizId,
    event_type: event.eventType,
    actor_id: event.actorId,
    recipient_ids: JSON.stringify(event.recipientIds),
    channels: JSON.stringify(event.channels),
    template_code: event.templateCode,
    template_variables: event.templateVariables ? JSON.stringify(event.templateVariables) : null,
    jump_url: event.jumpUrl,
    created_at: stamp,
  });

  return id;
}

/**
 * 创建投递记录
 *
 * @param {object} log
 * @returns {string} 记录 ID
 */
function createDeliveryLog(log) {
  const db = getDb();
  const id = log.id || generateId();
  const stamp = nowIso();

  db.prepare(`
    INSERT INTO delivery_logs
      (id, event_id, channel, receiver_id, provider_message_id, status, error_message, sent_at, created_at)
    VALUES
      (@id, @event_id, @channel, @receiver_id, @provider_message_id, @status, @error_message, @sent_at, @created_at)
  `).run({
    id,
    event_id: log.eventId,
    channel: log.channel,
    receiver_id: log.receiverId,
    provider_message_id: log.providerMessageId || null,
    status: log.status || 'pending',
    error_message: log.errorMessage || null,
    sent_at: log.sentAt || null,
    created_at: stamp,
  });

  return id;
}

/**
 * 更新投递状态
 *
 * @param {string} logId
 * @param {string} status - 'sent' | 'failed'
 * @param {string} [providerMessageId]
 * @param {string} [errorMessage]
 */
function updateDeliveryStatus(logId, status, providerMessageId, errorMessage) {
  const db = getDb();
  db.prepare(`
    UPDATE delivery_logs
    SET status = @status,
        provider_message_id = COALESCE(@provider_message_id, provider_message_id),
        error_message = @error_message,
        sent_at = CASE WHEN @status = 'sent' THEN @sent_at ELSE sent_at END
    WHERE id = @id
  `).run({
    id: logId,
    status,
    provider_message_id: providerMessageId || null,
    error_message: errorMessage || null,
    sent_at: nowIso(),
  });
}

/**
 * 检查事件是否已存在（用于幂等判断）
 *
 * @param {string} bizId
 * @param {string} eventType
 * @param {string} actorId
 * @param {object} [options]
 * @param {number} [options.withinHours] - 仅检查最近 N 小时内的记录，不传则不限时间
 * @param {boolean} [options.todayOnly] - 仅检查当天（UTC+8 自然日）是否已发过，优先级高于 withinHours
 * @returns {boolean}
 */
function eventExists(bizId, eventType, actorId, options = {}) {
  const db = getDb();
  const { withinHours, todayOnly } = options;

  if (todayOnly) {
    const { todayDate } = require('../../utils/datetime');
    const todayStr = todayDate();
    const since = new Date(`${todayStr}T00:00:00+08:00`).toISOString();
    const row = db.prepare(
      'SELECT 1 FROM notification_events WHERE biz_id = ? AND event_type = ? AND actor_id = ? AND created_at >= ? LIMIT 1'
    ).get(bizId, eventType, actorId, since);
    return Boolean(row);
  }

  if (withinHours && withinHours > 0) {
    const since = new Date(Date.now() - withinHours * 60 * 60 * 1000).toISOString();
    const row = db.prepare(
      'SELECT 1 FROM notification_events WHERE biz_id = ? AND event_type = ? AND actor_id = ? AND created_at >= ? LIMIT 1'
    ).get(bizId, eventType, actorId, since);
    return Boolean(row);
  }

  const row = db.prepare(
    'SELECT 1 FROM notification_events WHERE biz_id = ? AND event_type = ? AND actor_id = ? LIMIT 1'
  ).get(bizId, eventType, actorId);
  return Boolean(row);
}

/**
 * 查找指定任务、接收人的 todo 渠道投递记录（用于待办生命周期管理）
 *
 * @param {string} bizId - 任务 ID
 * @param {string} receiverId - 接收人 userId
 * @returns {Array<{ providerMessageId: string }>}
 */
function findTodoDeliveryLogs(bizId, receiverId) {
  const db = getDb();
  return db.prepare(`
    SELECT dl.provider_message_id AS providerMessageId
    FROM delivery_logs dl
    JOIN notification_events ne ON dl.event_id = ne.id
    WHERE ne.biz_id = ?
      AND dl.receiver_id = ?
      AND dl.channel = 'todo'
      AND dl.status = 'sent'
      AND dl.provider_message_id IS NOT NULL
    ORDER BY dl.created_at DESC
  `).all(bizId, receiverId);
}

module.exports = {
  createEvent,
  createDeliveryLog,
  updateDeliveryStatus,
  eventExists,
  findTodoDeliveryLogs,
};
