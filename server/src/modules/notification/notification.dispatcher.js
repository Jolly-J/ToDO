/**
 * 通知渠道派发器
 *
 * 根据渠道类型调用对应的钉钉适配器发送通知。
 * 发送前将系统 userId 映射为钉钉身份标识。
 */

const { getIdentitiesByUserIds } = require('../dingtalk/dingtalk.identity.dao');
const todoAdapter = require('../dingtalk/dingtalk.todo.adapter');
const robotAdapter = require('../dingtalk/dingtalk.robot.adapter');
const logger = require('../../utils/logger');

/**
 * 向指定渠道发送通知
 *
 * @param {object} params
 * @param {string} params.channel - 'todo' | 'robot'
 * @param {string[]} params.receiverUserIds - 系统 userId 列表
 * @param {object} params.rendered - 模板渲染结果 { todo?, robot? }
 * @param {string} params.jumpUrl - 跳转链接
 * @param {string} params.actorUnionId - 操作者 unionId（待办创建者）
 * @param {string} [params.reqId]
 * @returns {Promise<Map<string, { success: boolean, providerMessageId?: string, error?: string }>>}
 *   key = receiverUserId
 */
async function dispatch({ channel, receiverUserIds, rendered, jumpUrl, actorUnionId, reqId }) {
  const results = new Map();

  if (!receiverUserIds?.length) return results;

  // 映射系统 userId → 钉钉 unionId
  const identityMap = getIdentitiesByUserIds(receiverUserIds);

  // 过滤出有钉钉身份的用户
  const validReceivers = receiverUserIds.filter(uid => identityMap.has(uid));
  const skippedReceivers = receiverUserIds.filter(uid => !identityMap.has(uid));

  for (const uid of skippedReceivers) {
    results.set(uid, { success: false, error: '缺少钉钉身份映射' });
  }

  if (!validReceivers.length) return results;

  try {
    if (channel === 'todo') {
      await dispatchTodo({ validReceivers, identityMap, rendered, jumpUrl, actorUnionId, reqId, results });
    } else if (channel === 'robot') {
      await dispatchRobot({ validReceivers, identityMap, rendered, jumpUrl, reqId, results });
    }
  } catch (error) {
    logger.error('渠道派发异常', {
      action: 'notify.dispatch.error',
      channel: 'notification',
      dispatchChannel: channel,
      error: error.message,
    });
    for (const uid of validReceivers) {
      if (!results.has(uid)) {
        results.set(uid, { success: false, error: error.message });
      }
    }
  }

  return results;
}

async function dispatchTodo({ validReceivers, identityMap, rendered, jumpUrl, actorUnionId, reqId, results }) {
  const todoData = rendered.todo;
  if (!todoData) return;

  for (const uid of validReceivers) {
    const unionId = identityMap.get(uid)?.unionId;
    if (!unionId) {
      results.set(uid, { success: false, error: '缺少钉钉 unionId 映射' });
      continue;
    }
    const result = await todoAdapter.createTodo({
      unionId,
      operatorId: actorUnionId,
      subject: todoData.subject,
      description: todoData.description,
      dueTime: todoData.dueTime,
      executorIds: [unionId],
      detailUrl: jumpUrl ? { appUrl: jumpUrl, pcUrl: jumpUrl } : undefined,
      sourceId: todoData.sourceId,
      priority: todoData.priority,
      reqId,
    });
    results.set(uid, {
      success: result.success,
      providerMessageId: result.todoId,
      error: result.error,
    });
    logger[result.success ? 'info' : 'warn']('待办派发', {
      action: 'notify.dispatch.todo',
      channel: 'notification',
      userId: uid,
      success: result.success,
      todoId: result.todoId,
      error: result.error,
      reqId,
    });
  }
}

async function dispatchRobot({ validReceivers, identityMap, rendered, jumpUrl, reqId, results }) {
  const robotData = rendered.robot;
  if (!robotData) return;

  const dingtalkUserIds = [];
  const uidToDingtalkId = new Map();

  for (const uid of validReceivers) {
    const providerUserId = identityMap.get(uid)?.providerUserId;
    if (!providerUserId) {
      results.set(uid, { success: false, error: '缺少钉钉 userid 映射' });
      continue;
    }
    dingtalkUserIds.push(providerUserId);
    uidToDingtalkId.set(uid, providerUserId);
  }

  if (!dingtalkUserIds.length) return;

  // 批量发送（每次最多 20 个）
  for (let i = 0; i < dingtalkUserIds.length; i += 20) {
    const batch = dingtalkUserIds.slice(i, i + 20);
    const result = await robotAdapter.sendActionCard({
      userIds: batch,
      title: robotData.title,
      markdown: robotData.text,
      singleTitle: robotData.singleTitle === undefined ? '查看详情' : robotData.singleTitle,
      singleURL: robotData.singleURL === undefined ? (jumpUrl || '') : robotData.singleURL,
      reqId,
    });

    logger[result.success ? 'info' : 'warn']('机器人派发', {
      action: 'notify.dispatch.robot',
      channel: 'notification',
      batchSize: batch.length,
      success: result.success,
      error: result.error,
      reqId,
    });

    // 将结果映射回系统 userId（注意：钉钉批量接口返回整批状态，无法区分单用户成功/失败）
    for (const uid of validReceivers) {
      const dtId = uidToDingtalkId.get(uid);
      if (dtId && batch.includes(dtId) && !results.has(uid)) {
        results.set(uid, {
          success: result.success,
          providerMessageId: result.processQueryKey,
          error: result.error,
          batchResult: true,
        });
      }
    }
  }
}

module.exports = {
  dispatch,
};
