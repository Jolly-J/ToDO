/**
 * 钉钉机器人消息适配器
 *
 * 通过企业内部应用机器人向用户发送单聊消息。
 * 支持 markdown 和 action_card 两种消息类型。
 *
 * API: POST /v1.0/robot/oToMessages/batchSend
 * 文档: docs/Dingtalk/钉钉消息通知/单聊机器人/功能实现/批量发送人与机器人会话中机器人消息.md
 */

const { getAccessToken, getDingtalkConfig } = require('./dingtalk.service');
const { auditDingtalkEvent } = require('../../utils/businessLogger');
const logger = require('../../utils/logger');

function resolveRobotCode() {
  const config = getDingtalkConfig();
  return config.robotCode || config.clientId || '';
}

function buildSingleActionCardMessage({ title, markdown, singleTitle, singleURL }) {
  return {
    msgKey: 'sampleActionCard',
    msgParam: JSON.stringify({
      title,
      text: markdown,
      singleTitle,
      singleURL,
    }),
  };
}

/**
 * 批量发送机器人单聊消息
 *
 * @param {object} params
 * @param {string[]} params.userIds - 钉钉 userId 列表（非 unionId），最多 20 个
 * @param {string} params.msgKey - 消息模板 key，如 'sampleMarkdown', 'sampleActionCard6'
 * @param {string} params.msgParam - JSON 字符串，消息模板参数
 * @param {string} [params.reqId] - 请求追踪 ID
 * @returns {Promise<{ success: boolean, processQueryKey?: string, error?: string }>}
 */
async function batchSend({ userIds, msgKey, msgParam, reqId }) {
  const robotCode = resolveRobotCode();

  if (!robotCode) {
    logger.error('机器人 robotCode 未配置', { action: 'dingtalk.robot.config_missing' });
    return { success: false, error: 'robotCode 未配置' };
  }

  try {
    const accessToken = await getAccessToken();

    const response = await fetch('https://api.dingtalk.com/v1.0/robot/oToMessages/batchSend', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': accessToken,
      },
      body: JSON.stringify({
        robotCode,
        userIds,
        msgKey,
        msgParam,
      }),
    });

    const data = await response.json();

    if (data.processQueryKey) {
      const invalidStaffIdList = Array.isArray(data.invalidStaffIdList) ? data.invalidStaffIdList : [];
      const flowControlledStaffIdList = Array.isArray(data.flowControlledStaffIdList) ? data.flowControlledStaffIdList : [];
      auditDingtalkEvent({
        action: 'dingtalk.robot.send',
        result: 'success',
        reqId,
        userCount: userIds.length,
        msgKey,
        processQueryKey: data.processQueryKey,
        invalidUserCount: invalidStaffIdList.length,
        flowControlledCount: flowControlledStaffIdList.length,
      });
      return {
        success: true,
        processQueryKey: data.processQueryKey,
        invalidStaffIdList,
        flowControlledStaffIdList,
      };
    }

    auditDingtalkEvent({
      action: 'dingtalk.robot.send',
      result: 'failed',
      level: 'error',
      reqId,
      userCount: userIds.length,
      msgKey,
      errorCode: data.code,
      errorMessage: data.message,
    });
    return { success: false, error: data.message || '发送失败' };
  } catch (error) {
    auditDingtalkEvent({
      action: 'dingtalk.robot.send',
      result: 'failed',
      level: 'error',
      reqId,
      errorCode: 'ROBOT_SEND_ERROR',
      errorMessage: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * 批量撤回人与机器人单聊消息。
 * 钉钉限制每次最多提交 20 个 processQueryKey，调用方负责分批。
 */
async function batchRecall({ processQueryKeys, reqId }) {
  const robotCode = resolveRobotCode();
  if (!robotCode) {
    logger.error('机器人 robotCode 未配置', { action: 'dingtalk.robot.config_missing' });
    return { success: false, successResult: [], failedResult: {}, error: 'robotCode 未配置' };
  }

  try {
    const accessToken = await getAccessToken();
    const response = await fetch('https://api.dingtalk.com/v1.0/robot/otoMessages/batchRecall', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-acs-dingtalk-access-token': accessToken,
      },
      body: JSON.stringify({ robotCode, processQueryKeys }),
    });
    const data = await response.json();
    const successResult = Array.isArray(data.successResult) ? data.successResult : [];
    const failedResult = data.failedResult && typeof data.failedResult === 'object'
      ? data.failedResult
      : {};
    const success = response.ok && successResult.length > 0;

    auditDingtalkEvent({
      action: 'dingtalk.robot.recall',
      result: success ? 'success' : 'failed',
      level: success ? 'info' : 'error',
      reqId,
      requestedCount: processQueryKeys.length,
      successCount: successResult.length,
      failedCount: Object.keys(failedResult).length,
      errorCode: data.code,
      errorMessage: data.message,
    });

    return {
      success,
      successResult,
      failedResult,
      error: response.ok ? null : (data.message || '撤回失败'),
    };
  } catch (error) {
    auditDingtalkEvent({
      action: 'dingtalk.robot.recall',
      result: 'failed',
      level: 'error',
      reqId,
      requestedCount: processQueryKeys.length,
      errorCode: 'ROBOT_RECALL_ERROR',
      errorMessage: error.message,
    });
    return { success: false, successResult: [], failedResult: {}, error: error.message };
  }
}

/**
 * 发送 Markdown 消息
 *
 * @param {object} params
 * @param {string[]} params.userIds - 钉钉 userId 列表
 * @param {string} params.title - 消息标题
 * @param {string} params.text - Markdown 正文
 * @param {string} [params.reqId]
 */
async function sendMarkdown({ userIds, title, text, reqId }) {
  return batchSend({
    userIds,
    msgKey: 'sampleMarkdown',
    msgParam: JSON.stringify({ title, text }),
    reqId,
  });
}

/**
 * 发送 ActionCard 消息（整体跳转）
 *
 * @param {object} params
 * @param {string[]} params.userIds - 钉钉 userId 列表
 * @param {string} params.title - 卡片标题
 * @param {string} params.markdown - Markdown 正文
 * @param {string} params.singleTitle - 按钮文案
 * @param {string} params.singleURL - 按钮跳转链接
 * @param {string} [params.reqId]
 */
async function sendActionCard({ userIds, title, markdown, singleTitle, singleURL, reqId }) {
  const message = buildSingleActionCardMessage({
    title,
    markdown,
    singleTitle,
    singleURL,
  });

  return batchSend({
    userIds,
    msgKey: message.msgKey,
    msgParam: message.msgParam,
    reqId,
  });
}

module.exports = {
  batchRecall,
  batchSend,
  resolveRobotCode,
  buildSingleActionCardMessage,
  sendMarkdown,
  sendActionCard,
};
