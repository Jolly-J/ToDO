/**
 * 钉钉工作通知适配器
 *
 * 以应用名义向员工推送工作通知消息。
 * 首期保留接口但不默认开启。
 *
 * API: POST https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2
 * 文档: docs/Dingtalk/钉钉消息通知/工作通知/发送工作通知.md
 */

const { getAccessToken, getDingtalkConfig } = require('./dingtalk.service');
const { auditDingtalkEvent } = require('../../utils/businessLogger');
const logger = require('../../utils/logger');

/**
 * 发送工作通知（通用）
 *
 * @param {object} params
 * @param {string[]} params.userIdList - 钉钉 userId 列表（逗号分隔传入 API）
 * @param {object} params.msg - 消息体，格式参考钉钉文档
 * @param {string} [params.reqId]
 * @returns {Promise<{ success: boolean, taskId?: number, error?: string }>}
 */
async function send({ userIdList, msg, reqId }) {
  const config = getDingtalkConfig();
  const agentId = config.agentId;

  if (!agentId) {
    logger.error('工作通知 agentId 未配置', { action: 'dingtalk.work.config_missing' });
    return { success: false, error: 'agentId 未配置' };
  }

  try {
    const accessToken = await getAccessToken();

    const response = await fetch(
      `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${accessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: agentId,
          userid_list: userIdList.join(','),
          to_all_user: false,
          msg,
        }),
      }
    );

    const data = await response.json();

    if (data.errcode === 0) {
      auditDingtalkEvent({
        action: 'dingtalk.work.send',
        result: 'success',
        reqId,
        taskId: data.task_id,
        userCount: userIdList.length,
        msgtype: msg.msgtype,
      });
      return { success: true, taskId: data.task_id };
    }

    auditDingtalkEvent({
      action: 'dingtalk.work.send',
      result: 'failed',
      level: 'error',
      reqId,
      userCount: userIdList.length,
      errorCode: String(data.errcode),
      errorMessage: data.errmsg,
    });
    return { success: false, error: data.errmsg || '发送工作通知失败' };
  } catch (error) {
    auditDingtalkEvent({
      action: 'dingtalk.work.send',
      result: 'failed',
      level: 'error',
      reqId,
      errorCode: 'WORK_SEND_ERROR',
      errorMessage: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * 发送 ActionCard 工作通知
 */
async function sendActionCard({ userIdList, title, markdown, singleTitle, singleUrl, reqId }) {
  return send({
    userIdList,
    msg: {
      msgtype: 'action_card',
      action_card: { title, markdown, single_title: singleTitle, single_url: singleUrl },
    },
    reqId,
  });
}

/**
 * 发送 Link 工作通知
 */
async function sendLink({ userIdList, title, text, messageUrl, picUrl, reqId }) {
  return send({
    userIdList,
    msg: {
      msgtype: 'link',
      link: { title, text, messageUrl, picUrl: picUrl || '' },
    },
    reqId,
  });
}

/**
 * 发送 Markdown 工作通知
 */
async function sendMarkdown({ userIdList, title, text, reqId }) {
  return send({
    userIdList,
    msg: {
      msgtype: 'markdown',
      markdown: { title, text },
    },
    reqId,
  });
}

module.exports = {
  send,
  sendActionCard,
  sendLink,
  sendMarkdown,
};
