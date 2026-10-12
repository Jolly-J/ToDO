/**
 * 钉钉待办生命周期同步
 *
 * 待办关闭不能依赖机器人聚合通知。任务进入终态、转派旧负责人时，
 * 这里直接根据 delivery_logs 中已创建的 todoId 同步钉钉侧状态。
 */

const eventDao = require('./notification.event.dao');
const { getUnionIdByUserId } = require('../dingtalk/dingtalk.identity.dao');
const todoAdapter = require('../dingtalk/dingtalk.todo.adapter');
const logger = require('../../utils/logger');

async function closeTaskTodosForAssignee({ taskId, assigneeId, reqId, reason } = {}) {
  if (!taskId || !assigneeId) {
    return { attempted: 0, closed: 0, failed: 0 };
  }

  const logs = eventDao.findTodoDeliveryLogs(taskId, assigneeId);
  const unionId = getUnionIdByUserId(assigneeId);
  if (!unionId || logs.length === 0) {
    return { attempted: 0, closed: 0, failed: 0 };
  }

  let closed = 0;
  let failed = 0;

  for (const log of logs) {
    const result = await todoAdapter.updateTodoStatus({
      unionId,
      todoId: log.providerMessageId,
      done: true,
      reqId,
    });

    if (result.success) {
      closed += 1;
    } else {
      failed += 1;
      logger.warn('关闭钉钉待办失败', {
        action: 'dingtalk.todo.lifecycle.close_failed',
        channel: 'notification',
        taskId,
        assigneeId,
        todoId: log.providerMessageId,
        reason,
        error: result.error,
        reqId,
      });
    }
  }

  logger[failed > 0 ? 'warn' : 'info']('钉钉待办关闭同步完成', {
    action: 'dingtalk.todo.lifecycle.close',
    channel: 'notification',
    taskId,
    assigneeId,
    reason,
    attempted: logs.length,
    closed,
    failed,
    reqId,
  });

  return { attempted: logs.length, closed, failed };
}

function closeTaskTodosForAssigneeInBackground(params) {
  closeTaskTodosForAssignee(params).catch((error) => {
    logger.warn('钉钉待办关闭同步异常', {
      action: 'dingtalk.todo.lifecycle.close_error',
      channel: 'notification',
      taskId: params?.taskId,
      assigneeId: params?.assigneeId,
      reason: params?.reason,
      error: error.message,
      reqId: params?.reqId,
    });
  });
}

module.exports = {
  closeTaskTodosForAssignee,
  closeTaskTodosForAssigneeInBackground,
};
