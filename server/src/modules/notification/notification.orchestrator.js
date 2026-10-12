/**
 * 通知编排层（Orchestrator）
 *
 * 监听 EventBus 领域事件，执行完整通知流程：
 * 1. 查找通知规则（接收人、渠道）
 * 2. 解析接收人列表（排除操作者）
 * 3. 渲染模板
 * 4. 生成 jumpUrl
 * 5. 写入 notification_events（幂等）
 * 6. 对每个接收人 × 每个渠道派发并记录 delivery_logs
 * 7. 任务完成时关闭负责人钉钉待办
 * 8. reassigned 时关闭旧负责人钉钉待办
 * 9. 写入站内 notifications（兼容现有前端）
 */

const eventBus = require('./eventBus');
const { getRule, getAllEventTypes } = require('./notification.rules');
const { renderTemplate } = require('./templates');
const { dispatch } = require('./notification.dispatcher');
const eventDao = require('./notification.event.dao');
const { encryptLinkToken } = require('../../utils/linkCrypto');
const { buildTaskNotificationUrl, buildTeamNotificationUrl } = require('./notification.links');
const { writeInAppNotification } = require('./notification.events');
const { getUnionIdByUserId } = require('../dingtalk/dingtalk.identity.dao');
const todoLifecycle = require('./notification.todoLifecycle');
const { getDb } = require('../../db/sqlite');
const logger = require('../../utils/logger');

function parseParticipantIds(rawValue) {
  if (!rawValue) return [];
  if (Array.isArray(rawValue)) return rawValue.filter(Boolean);
  try {
    const parsed = JSON.parse(rawValue);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function formatDateValue(value) {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }
  return date.toISOString().slice(0, 10);
}

function getTaskSnapshot(taskId) {
  if (!taskId) return null;
  return getDb().prepare(
    'SELECT title, priority, status, due_date, assignee_id, creator_id, participant_ids FROM tasks WHERE id = ?'
  ).get(taskId);
}

function getUserNameMap(userIds) {
  const normalizedIds = [...new Set((userIds || []).filter(Boolean).map((userId) => String(userId)))];
  const result = new Map();
  if (normalizedIds.length === 0) return result;

  const placeholders = normalizedIds.map(() => '?').join(',');
  const rows = getDb().prepare(
    `SELECT id, name FROM users WHERE id IN (${placeholders})`
  ).all(...normalizedIds);

  for (const row of rows) {
    result.set(String(row.id), row.name || String(row.id));
  }

  return result;
}

function resolveUserName(userId, nameMap) {
  if (!userId) return '';
  return nameMap.get(String(userId)) || String(userId);
}

function buildTemplateBaseVariables(payload) {
  const { bizType, bizId, actorId, eventType, data = {} } = payload;
  const task = bizType === 'task' ? getTaskSnapshot(bizId) : null;
  const addedUserIds = Array.isArray(data.addedUserIds) ? data.addedUserIds : [];
  const removedUserIds = Array.isArray(data.removedUserIds) ? data.removedUserIds : [];
  const mentionedUserIds = Array.isArray(data.mentionedUserIds) ? data.mentionedUserIds : [];
  const autoAddedMentionUserIds = Array.isArray(data.autoAddedMentionUserIds) ? data.autoAddedMentionUserIds : [];
  const relatedUserIds = [
    actorId,
    data.targetUserId,
    task?.assignee_id,
    task?.creator_id,
    ...parseParticipantIds(task?.participant_ids),
    ...addedUserIds,
    ...removedUserIds,
    ...mentionedUserIds,
    ...autoAddedMentionUserIds,
  ];
  const nameMap = getUserNameMap(relatedUserIds);
  const dueAt = data.dueAt ?? task?.due_date ?? null;
  const oldDueAt = data.oldDueAt ?? null;

  return {
    ...data,
    actorId,
    bizId,
    eventType,
    title: data.title || task?.title || '',
    priority: data.priority ?? task?.priority,
    oldPriority: data.oldPriority,
    status: data.status ?? task?.status,
    oldStatus: data.oldStatus,
    dueAt,
    oldDueAt,
    dueDate: data.dueDate || formatDateValue(dueAt),
    oldDueDate: data.oldDueDate || formatDateValue(oldDueAt),
    actorName: actorId === 'system' ? '系统' : resolveUserName(actorId, nameMap),
    assigneeId: data.assigneeId || task?.assignee_id || data.targetUserId || null,
    targetUserId: data.targetUserId || null,
    targetUserName: resolveUserName(data.targetUserId, nameMap),
    addedUserNames: addedUserIds.map((userId) => resolveUserName(userId, nameMap)).filter(Boolean),
    removedUserNames: removedUserIds.map((userId) => resolveUserName(userId, nameMap)).filter(Boolean),
    mentionedUserIds,
    autoAddedMentionUserIds,
  };
}

function buildRecipientTemplateVariables(baseVariables, recipientId) {
  const autoAddedMentionUserIds = Array.isArray(baseVariables.autoAddedMentionUserIds)
    ? baseVariables.autoAddedMentionUserIds
    : [];

  return {
    ...baseVariables,
    recipientId,
    isAutoAddedMentionRecipient: autoAddedMentionUserIds.some((userId) => String(userId) === String(recipientId)),
    isTargetRecipient: Boolean(
      recipientId &&
      baseVariables.targetUserId &&
      String(recipientId) === String(baseVariables.targetUserId)
    ),
    isAssignee: Boolean(
      recipientId &&
      baseVariables.assigneeId &&
      String(recipientId) === String(baseVariables.assigneeId)
    ),
  };
}

function buildDeliveryGroups({ recipients, payload, rule, baseVariables }) {
  const groups = new Map();

  for (const recipientId of recipients) {
    const templateVariables = buildRecipientTemplateVariables(baseVariables, recipientId);
    const rendered = renderTemplate(rule.templateCode, templateVariables);
    if (!rendered) continue;

    const channels = rule.channels(payload, recipientId) || [];
    for (const channel of channels) {
      if (!rendered[channel]) continue;

      const channelRendered = { [channel]: rendered[channel] };
      const key = `${channel}:${JSON.stringify(channelRendered[channel])}`;
      if (!groups.has(key)) {
        groups.set(key, {
          channel,
          rendered: channelRendered,
          receiverUserIds: [],
        });
      }
      groups.get(key).receiverUserIds.push(recipientId);
    }
  }

  return [...groups.values()];
}

/**
 * 处理单个领域事件
 */
async function handleEvent(payload) {
  const { eventType, bizType, bizId, actorId, data, reqId } = payload;

  // 1. 查找规则
  const rule = getRule(eventType);
  if (!rule) {
    logger.debug('无匹配通知规则，跳过', { action: 'orchestrator.no_rule', eventType });
    return;
  }

  // 2. 解析接收人（排除操作者）
  const allRecipients = rule.recipients(payload);
  let recipients = allRecipients.filter(uid => uid && uid !== actorId);

  if (!recipients.length) {
    logger.debug('无有效接收人，跳过', { action: 'orchestrator.no_recipients', eventType, bizId, channel: 'notification' });
    return;
  }

  // 开发/测试环境：接收人重定向拦截（测试环境 NODE_ENV === 'test' 时不重定向）
  const redirectReceiver = process.env.DEV_NOTIFICATION_REDIRECT_RECEIVER;
  if (redirectReceiver && process.env.NODE_ENV !== 'test') {
    logger.info('开发环境通知接收人重定向', {
      action: 'orchestrator.redirect_recipients',
      channel: 'notification',
      eventType,
      bizId,
      originalRecipients: recipients,
      redirectedTo: redirectReceiver,
    });
    recipients = [redirectReceiver];
  }



  // 入口日志
  const channelList = [...new Set(recipients.flatMap(uid => rule.channels(payload, uid) || []))];
  logger.info('通知事件接收', {
    action: 'orchestrator.event_received',
    channel: 'notification',
    eventType,
    bizId,
    recipientCount: recipients.length,
    channels: channelList,
    reqId,
  });

  // 3. 补齐模板变量（姓名、任务快照、格式化字段）
  const templateVariables = buildTemplateBaseVariables(payload);

  // 4. 生成 jumpUrl
  let jumpUrl = '';
  try {
    if (bizType === 'task') {
      const task = require('../../db/sqlite').getDb()
        .prepare('SELECT team_id FROM tasks WHERE id = ?').get(bizId);
      const token = encryptLinkToken({ taskId: bizId, teamId: task?.team_id });
      jumpUrl = buildTaskNotificationUrl({ token });

      if (!jumpUrl) {
        logger.warn('通知跳转地址缺失 APP_BASE_URL 配置，已跳过外链生成', {
          action: 'orchestrator.jumpurl_missing_base',
          channel: 'notification',
          bizId,
          eventType,
        });
      }
    } else if (bizType === 'team') {
      jumpUrl = buildTeamNotificationUrl({ teamId: bizId });
    }
  } catch (error) {
    logger.warn('jumpUrl 生成失败', { action: 'orchestrator.jumpurl_failed', channel: 'notification', error: error.message });
  }

  const deliveryGroups = buildDeliveryGroups({
    recipients,
    payload,
    rule,
    baseVariables: templateVariables,
  });

  if (deliveryGroups.length === 0) {
    logger.warn('模板渲染失败', { action: 'orchestrator.template_failed', channel: 'notification', templateCode: rule.templateCode });
    return;
  }

  // 5. 写入 notification_events
  const allChannels = new Set(deliveryGroups.map((group) => group.channel));
  const eventId = eventDao.createEvent({
    id: data?.sessionId || undefined,
    bizType,
    bizId,
    eventType,
    actorId,
    recipientIds: recipients,
    channels: [...allChannels],
    templateCode: rule.templateCode,
    templateVariables,
    jumpUrl,
  });

  // 获取操作者 unionId（待办创建需要）
  const actorUnionId = getUnionIdByUserId(actorId);

  let sentCount = 0;
  let failedCount = 0;

  // 6. 按“渠道 + 渲染内容”分组派发
  for (const { channel, receiverUserIds, rendered } of deliveryGroups) {
    // 创建 pending 状态的 delivery_logs
    const logIds = new Map();
    for (const uid of receiverUserIds) {
      const logId = eventDao.createDeliveryLog({
        eventId,
        channel,
        receiverId: uid,
        status: 'pending',
      });
      logIds.set(uid, logId);
    }

    // 派发
    try {
      const results = await dispatch({
        channel,
        receiverUserIds,
        rendered,
        jumpUrl,
        actorUnionId,
        reqId,
      });

      // 更新 delivery_logs 状态
      for (const [uid, result] of results) {
        const logId = logIds.get(uid);
        if (logId) {
          if (result.success) {
            sentCount += 1;
          } else {
            failedCount += 1;
          }
          eventDao.updateDeliveryStatus(
            logId,
            result.success ? 'sent' : 'failed',
            result.providerMessageId,
            result.error
          );
        }
      }
    } catch (error) {
      logger.error('渠道派发异常', {
        action: 'orchestrator.dispatch.error',
        channel: 'notification',
        dispatchChannel: channel,
        eventType,
        error: error.message,
      });
      for (const [uid, logId] of logIds) {
        failedCount += 1;
        eventDao.updateDeliveryStatus(logId, 'failed', null, error.message);
      }
    }
  }

  // 7. 任务完成或取消时，关闭当前负责人的钉钉待办
  if (eventType === 'task.status_changed' && (data?.status === 'done' || data?.status === 'delayed_done' || data?.status === 'canceled')) {
    const task = getTaskSnapshot(bizId);
    const assigneeId = task?.assignee_id;
    if (assigneeId) {
      try {
        const result = await todoLifecycle.closeTaskTodosForAssignee({
          taskId: bizId,
          assigneeId,
          reqId,
          reason: `status:${data.status}`,
        });
        if (result.attempted > 0) {
          logger.info('任务完成或取消，已关闭负责人钉钉待办', {
            action: 'orchestrator.task_done.close_todo',
            channel: 'notification',
            bizId,
            assigneeId,
            closedCount: result.closed,
            failedCount: result.failed,
          });
        }
      } catch (error) {
        logger.warn('任务完成或取消关闭钉钉待办失败', {
          action: 'orchestrator.task_done.close_todo.error',
          channel: 'notification',
          bizId,
          assigneeId,
          error: error.message,
        });
      }
    }
  }

  // 9. reassigned 时完成旧负责人的钉钉待办
  if (eventType === 'task.reassigned' && data?.oldAssigneeId) {
    try {
      const result = await todoLifecycle.closeTaskTodosForAssignee({
        taskId: bizId,
        assigneeId: data.oldAssigneeId,
        reqId,
        reason: 'reassigned',
      });
      if (result.attempted > 0) {
        logger.info('已完成旧负责人待办', {
          action: 'orchestrator.reassign.close_old_todo',
          channel: 'notification',
          bizId,
          oldAssigneeId: data.oldAssigneeId,
          closedCount: result.closed,
          failedCount: result.failed,
        });
      }
    } catch (error) {
      logger.warn('完成旧负责人待办失败', {
        action: 'orchestrator.reassign.close_old_todo.error',
        channel: 'notification',
        bizId,
        oldAssigneeId: data.oldAssigneeId,
        error: error.message,
      });
    }
  }

  // 10. 写入站内通知（兼容现有前端）
  for (const recipientId of recipients) {
    writeInAppNotification(eventType, payload, recipientId);
  }

  const completionResult = failedCount > 0 ? (sentCount > 0 ? 'partial' : 'failed') : 'success';
  const completionLevel = failedCount > 0 && sentCount === 0 ? 'error' : 'info';
  logger[completionLevel]('通知编排完成', {
    action: 'orchestrator.complete',
    channel: 'notification',
    result: completionResult,
    reqId,
    eventType,
    bizId,
    recipientCount: recipients.length,
    channels: [...allChannels],
    sentCount,
    failedCount,
  });
}

/**
 * 初始化 orchestrator — 注册所有事件监听
 */
function init() {
  const eventTypes = getAllEventTypes();

  eventBus.onMany(eventTypes, (payload) => {
    // 异步处理，不阻塞业务主流程
    handleEvent(payload).catch(error => {
      logger.error('Orchestrator 处理事件失败', {
        action: 'orchestrator.handle.error',
        eventType: payload?.eventType,
        bizId: payload?.bizId,
        error: error.message,
      });
    });
  });

  logger.debug('NotificationOrchestrator 已初始化', {
    action: 'orchestrator.init',
    registeredEvents: eventTypes.length,
  });
}

module.exports = {
  init,
  handleEvent,
};
