/**
 * 钉钉待办任务适配器
 *
 * 通过钉钉待办 API 创建、更新、删除待办任务。
 * 待办会出现在钉钉客户端"待办"页面。
 *
 * API: POST /v1.0/todo/users/{unionId}/tasks
 * 文档: docs/Dingtalk/钉钉消息通知/钉钉待办任务/创建钉钉待办任务.md
 */

const { getAccessToken } = require('./dingtalk.service');
const { auditDingtalkEvent } = require('../../utils/businessLogger');
const logger = require('../../utils/logger');

/**
 * 创建钉钉待办任务
 *
 * @param {object} params
 * @param {string} params.unionId - 接收人的 unionId（path 参数，待办归属人）
 * @param {string} [params.operatorId] - 操作者的 unionId（query 参数，可选）
 * @param {string} params.subject - 待办标题
 * @param {string} [params.description] - 待办描述
 * @param {number} [params.dueTime] - 截止时间（Unix 毫秒时间戳）
 * @param {string[]} [params.executorIds] - 执行者 unionId 列表
 * @param {string[]} [params.participantIds] - 参与者 unionId 列表
 * @param {object} [params.detailUrl] - 跳转链接 { appUrl, pcUrl }
 * @param {string} [params.sourceId] - 业务唯一标识（用于幂等）
 * @param {number} [params.priority] - 优先级 10/20/30/40
 * @param {string} [params.reqId] - 请求追踪 ID
 * @returns {Promise<{ success: boolean, todoId?: string, error?: string }>}
 */
async function createTodo({
  unionId,
  operatorId,
  subject,
  description,
  dueTime,
  executorIds,
  participantIds,
  detailUrl,
  sourceId,
  priority,
  reqId,
}) {
  if (!unionId) {
    return { success: false, error: 'unionId 不能为空' };
  }

  try {
    const accessToken = await getAccessToken();

    const body = {
      subject,
      creatorId: operatorId || unionId,
      sourceId,
      priority: priority || 20,
      notifyConfigs: {
        dingNotify: '1',
      },
    };

    if (description) body.description = description;
    if (dueTime) body.dueTime = dueTime;
    if (executorIds?.length) body.executorIds = executorIds;
    if (participantIds?.length) body.participantIds = participantIds;
    if (detailUrl) body.detailUrl = detailUrl;

    const query = operatorId ? `?operatorId=${encodeURIComponent(operatorId)}` : '';
    const response = await fetch(
      `https://api.dingtalk.com/v1.0/todo/users/${unionId}/tasks${query}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': accessToken,
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (data.id) {
      auditDingtalkEvent({
        action: 'dingtalk.todo.create',
        result: 'success',
        reqId,
        todoId: data.id,
        subject,
        unionId,
      });
      return { success: true, todoId: data.id };
    }

    auditDingtalkEvent({
      action: 'dingtalk.todo.create',
      result: 'failed',
      level: 'error',
      reqId,
      subject,
      unionId,
      errorCode: data.code,
      errorMessage: data.message,
    });
    return { success: false, error: data.message || '创建待办失败' };
  } catch (error) {
    auditDingtalkEvent({
      action: 'dingtalk.todo.create',
      result: 'failed',
      level: 'error',
      reqId,
      errorCode: 'TODO_CREATE_ERROR',
      errorMessage: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * 更新钉钉待办任务状态（完成/重开）
 *
 * @param {object} params
 * @param {string} params.unionId - 操作者 unionId
 * @param {string} params.todoId - 待办 ID
 * @param {boolean} params.done - 是否完成
 * @param {string} [params.reqId]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function updateTodoStatus({ unionId, todoId, done, reqId }) {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://api.dingtalk.com/v1.0/todo/users/${unionId}/tasks/${todoId}`,
      {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-acs-dingtalk-access-token': accessToken,
        },
        body: JSON.stringify({ done }),
      }
    );

    const data = await response.json();

    const success = data.result === true || Boolean(data.id);

    auditDingtalkEvent({
      action: 'dingtalk.todo.update',
      result: success ? 'success' : 'failed',
      level: success ? 'info' : 'error',
      reqId,
      todoId,
      done,
      errorCode: success ? undefined : data.code,
      errorMessage: success ? undefined : data.message,
    });

    return success ? { success: true } : { success: false, error: data.message || '更新待办失败' };
  } catch (error) {
    auditDingtalkEvent({
      action: 'dingtalk.todo.update',
      result: 'failed',
      level: 'error',
      reqId,
      todoId,
      errorCode: 'TODO_UPDATE_ERROR',
      errorMessage: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * 删除钉钉待办任务
 *
 * @param {object} params
 * @param {string} params.unionId - 操作者 unionId
 * @param {string} params.todoId - 待办 ID
 * @param {string} [params.reqId]
 * @returns {Promise<{ success: boolean, error?: string }>}
 */
async function deleteTodo({ unionId, todoId, reqId }) {
  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://api.dingtalk.com/v1.0/todo/users/${unionId}/tasks/${todoId}`,
      {
        method: 'DELETE',
        headers: {
          'x-acs-dingtalk-access-token': accessToken,
        },
      }
    );

    const data = await response.json();

    auditDingtalkEvent({
      action: 'dingtalk.todo.delete',
      result: data.result ? 'success' : 'failed',
      reqId,
      todoId,
    });

    return data.result ? { success: true } : { success: false, error: data.message || '删除待办失败' };
  } catch (error) {
    auditDingtalkEvent({
      action: 'dingtalk.todo.delete',
      result: 'failed',
      level: 'error',
      reqId,
      todoId,
      errorCode: 'TODO_DELETE_ERROR',
      errorMessage: error.message,
    });
    return { success: false, error: error.message };
  }
}

module.exports = {
  createTodo,
  updateTodoStatus,
  deleteTodo,
};
