/**
 * 通知事件桥接层
 *
 * 保持原有 emit(action, payload) 接口向后兼容，
 * 内部将旧格式 payload 转换为标准化格式后转发到 EventBus。
 * 同时保留站内通知写入（兼容现有前端）。
 */

const notificationDao = require('./notification.dao');
const eventBus = require('./eventBus');
const { auditDingtalkEvent } = require('../../utils/businessLogger');
const logger = require('../../utils/logger');

// ──────────────────────────────────────────
// 站内通知模板（保留原有站内通知写入逻辑）
// ──────────────────────────────────────────

const IN_APP_TEMPLATES = {
  'task.assigned': (payload) => ({
    title: '新任务分配',
    content: `你被指派为任务 "${payload.data.title}" 的负责人`,
  }),
  'task.reassigned': (payload) => ({
    title: '任务负责人变更',
    content: `任务 "${payload.data.title}" 的负责人已变更为你`,
  }),
  'task.status_changed': (payload) => ({
    title: '任务状态变更',
    content: `任务 "${payload.data.title}" 的状态变更为: ${payload.data.status}`,
  }),
  'task.commented': (payload) => ({
    title: '任务新评论',
    content: `任务 "${payload.data.title}" 有了新评论`,
  }),
  'task.progress_commented': (payload) => ({
    title: '任务新进展',
    content: `任务 "${payload.data.title}" 有了新进展更新`,
  }),
  'task.comment_mentioned': (payload) => {
    const actorName = payload.data?.actorName || '有人';
    const title = payload.data?.title || '';
    const sourceLabel = payload.data?.isProgressComment ? '进展' : '评论';
    const commentSnippet = payload.data?.commentSnippet || '';

    return {
      title: title || '任务',
      content: `${actorName} 在${sourceLabel}中 @ 了你${commentSnippet ? `\n> ${commentSnippet}` : ''}`,
    };
  },
  'task.due_soon': (payload) => ({
    title: '任务即将超期',
    content: `你的任务 "${payload.data.title}" 即将超期，请尽快处理`,
  }),
  'task.overdue': (payload) => ({
    title: '任务已逾期',
    content: `你的任务 "${payload.data.title}" 已逾期`,
  }),
  'task.priority_changed': (payload) => ({
    title: '任务优先级变更',
    content: `任务 "${payload.data.title}" 的优先级已变更为: ${payload.data.priority}`,
  }),
  'task.deleted': (payload) => ({
    title: '任务已删除',
    content: `任务 "${payload.data.title}" 已被删除`,
  }),
  'task.restored': (payload) => ({
    title: '任务已恢复',
    content: `任务 "${payload.data.title}" 已被恢复`,
  }),
  'task.shared': (payload) => ({
    title: '任务分享',
    content: `有人向你分享了任务 "${payload.data.title}"`,
  }),
  'task.participant_added': (payload) => ({
    title: '加入任务协作',
    content: `你已被添加为任务 "${payload.data.title}" 的参与人`,
  }),
  'task.participant_removed': (payload) => ({
    title: '移出任务协作',
    content: `你已被移出任务 "${payload.data.title}" 的参与人`,
  }),
  'task.due_date_changed': (payload) => ({
    title: '任务截止时间变更',
    content: `任务 "${payload.data.title}" 的截止时间已变更`,
  }),
  'task.activity_aggregated': (payload) => ({
    title: '任务动态汇总',
    content: Array.isArray(payload.data?.summaryLines) && payload.data.summaryLines.length
      ? payload.data.summaryLines.join('；')
      : `任务 "${payload.data?.title || ''}" 有新的动态`,
  }),
  'task.reminder': (payload) => ({
    title: '任务提醒',
    content: `任务 "${payload.data?.title || ''}" 将于 ${payload.data?.dueDate || '未知日期'} 截止，请及时处理`,
  }),
};

/**
 * 写入站内通知（兼容现有前端 /notifications 页面）
 */
function writeInAppNotification(eventType, payload, targetUserId) {
  const templateFn = IN_APP_TEMPLATES[eventType];
  if (!templateFn) return;

  try {
    const { title, content } = templateFn(payload, targetUserId);
    notificationDao.create({
      user_id: targetUserId,
      task_id: payload.bizId,
      type: eventType,
      title,
      content,
    });
  } catch (error) {
    logger.error('站内通知写入失败', {
      action: 'notify.in_app.error',
      channel: 'notification',
      eventType,
      bizId: payload.bizId,
      targetUserId,
      error: error.message,
    });
  }
}

// ──────────────────────────────────────────
// 旧格式 → 新格式转换（向后兼容）
// ──────────────────────────────────────────

/**
 * 将旧版 emit 调用转换为标准化 payload 并转发到 EventBus
 *
 * 旧格式: emit('task.assigned', { taskId, title, operatorId, targetUserId, details })
 * 新格式: eventBus.emit('task.assigned', { bizType, bizId, actorId, data, reqId })
 */
function emitLegacy(action, legacyPayload) {
  const { taskId, title, operatorId, targetUserId, details, reqId } = legacyPayload;

  // 转换为标准化 payload
  const standardPayload = {
    bizType: 'task',
    bizId: taskId,
    actorId: operatorId,
    data: {
      title,
      targetUserId,
      ...details,
    },
    reqId,
  };

  // 转发到 EventBus（orchestrator 会处理钉钉渠道派发）
  eventBus.emit(action, standardPayload);

  // 站内通知统一由 orchestrator 写入，避免 legacy 双写。
  if (targetUserId && targetUserId !== operatorId) {
    auditDingtalkEvent({
      action: 'notify.task',
      result: 'success',
      reqId,
      eventType: action,
      taskId,
      targetUserId,
      operatorId,
      notifyChannel: 'event_bus',
    });
  }
}

/**
 * 标准化 emit — 新代码应使用此方法
 *
 * @param {string} eventType - 事件类型
 * @param {object} payload - 标准化载荷 { bizType, bizId, actorId, data, reqId }
 */
function emit(eventType, payload) {
  try {
    eventBus.emit(eventType, payload);
  } catch (error) {
    logger.error('通知事件发布失败', {
      action: 'notify.emit.error',
      channel: 'notification',
      eventType,
      bizId: payload?.bizId,
      error: error.message,
    });
  }
}

module.exports = {
  emit,
  emitLegacy,
  writeInAppNotification,
};
