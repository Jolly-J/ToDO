const crypto = require('node:crypto');

function escapeMarkdownTableCell(value) {
  return String(value ?? '')
    .replace(/\r?\n/g, ' ')
    .replace(/\|/g, '\\|')
    .trim();
}

function formatDueDate(value) {
  const raw = String(value || '').trim();
  if (!raw) {
    return '未设置';
  }

  const dateOnly = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (dateOnly) {
    return `${dateOnly[1]}/${dateOnly[2]}/${dateOnly[3]}`;
  }

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) {
    return escapeMarkdownTableCell(raw);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}/${month}/${day}`;
}

function buildGroupTaskReminderTextPayload({ heading, tasks }) {
  const title = '任务提醒';
  const safeHeading = String(heading || '请各位负责人关注未完成任务：').trim() || '请各位负责人关注未完成任务：';
  const lines = [`### ${safeHeading}`, '', '| 任务名称 | 责任人 | 截止日期 |', '| --- | --- | --- |'];

  for (const task of tasks || []) {
    const dingtalkUserId = String(task.dingtalkUserId || '').trim();
    const assigneeName = String(task.assigneeName || '').trim();
    const ownerText = assigneeName || dingtalkUserId || '未指定';

    lines.push(
      `| ${escapeMarkdownTableCell(task.title || '未命名任务')} | ${escapeMarkdownTableCell(
        ownerText
      )} | ${formatDueDate(task.dueDate || task.due_date)} |`
    );
  }

  return {
    msgtype: 'markdown',
    markdown: {
      title,
      text: lines.join('\n'),
    },
    at: {
      atUserIds: [],
      isAtAll: false,
    },
  };
}

function buildGroupTaskReminderMentionTextPayload({ tasks }) {
  const atUserIds = [];

  for (const task of tasks || []) {
    const dingtalkUserId = String(task.dingtalkUserId || '').trim();
    if (dingtalkUserId && !atUserIds.includes(dingtalkUserId)) {
      atUserIds.push(dingtalkUserId);
    }
  }

  if (atUserIds.length === 0) {
    return null;
  }

  return {
    msgtype: 'text',
    text: {
      content: `请以上负责人关注：${atUserIds.map((userId) => `@${userId}`).join(' ')}`,
    },
    at: {
      atUserIds,
      isAtAll: false,
    },
  };
}

function createSignedWebhookUrl({ webhookUrl, secret, timestamp = Date.now() }) {
  if (!secret) {
    return webhookUrl;
  }

  const signSource = `${timestamp}\n${secret}`;
  const sign = crypto.createHmac('sha256', secret).update(signSource).digest('base64');
  const url = new URL(webhookUrl);
  url.searchParams.set('timestamp', String(timestamp));
  url.searchParams.set('sign', sign);
  return url.toString();
}

async function sendText({ webhookUrl, secret, payload, text, heading, tasks }) {
  const messagePayload = payload || (text
    ? {
        msgtype: 'text',
        text: { content: text },
        at: {
          atUserIds: [...new Set((tasks || []).map((task) => String(task.dingtalkUserId || '').trim()).filter(Boolean))],
          isAtAll: false,
        },
      }
    : buildGroupTaskReminderTextPayload({ heading, tasks }));

  const response = await fetch(createSignedWebhookUrl({ webhookUrl, secret }), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(messagePayload),
  });

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  if (!response.ok || (data && data.errcode && data.errcode !== 0)) {
    return {
      success: false,
      status: response.status,
      error: data?.errmsg || response.statusText || '群机器人发送失败',
      data,
    };
  }

  return {
    success: true,
    status: response.status,
    providerMessageId: data?.processQueryKey || data?.messageId || '',
    data,
  };
}

module.exports = {
  buildGroupTaskReminderMentionTextPayload,
  buildGroupTaskReminderTextPayload,
  createSignedWebhookUrl,
  sendText,
};
