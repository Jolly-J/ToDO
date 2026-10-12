/**
 * 通知跳转链接构建器
 *
 * 负责生成任务和团队通知使用的钉钉 applink 地址。
 */
const { createConfig } = require('../../config');

function buildTaskNotificationUrl({
  appBaseUrl = createConfig().appBaseUrl,
  token,
  source = 'notification',
  channel = 'dingtalk',
}) {
  if (!appBaseUrl || !token) {
    return '';
  }

  const baseUrl = String(appBaseUrl).replace(/\/+$/, '');
  const params = new URLSearchParams({ token, source, channel });
  const rawUrl = `${baseUrl}/tasks?${params.toString()}`;

  return `https://applink.dingtalk.com/page/link?url=${encodeURIComponent(rawUrl)}&target=fullScreen&targetDesktop=workbench`;
}

function buildTeamNotificationUrl({
  appBaseUrl = createConfig().appBaseUrl,
  teamId,
}) {
  if (!appBaseUrl || !teamId) {
    return '';
  }

  const baseUrl = String(appBaseUrl).replace(/\/+$/, '');
  const rawUrl = `${baseUrl}/teams/${teamId}`;

  return `https://applink.dingtalk.com/page/link?url=${encodeURIComponent(rawUrl)}&target=fullScreen&targetDesktop=workbench`;
}

module.exports = {
  buildTaskNotificationUrl,
  buildTeamNotificationUrl,
};
