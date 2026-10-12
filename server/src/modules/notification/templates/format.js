/**
 * 通知模板格式化工具
 *
 * 负责统一生成 ActionCard 和待办渠道的结构化负载。
 */
function formatActionCard({ title, summary, fields = [], buttonText = '查看详情', buttonUrl }) {
  const lines = [`### ${title || ''}`, '', summary || ''];
  const normalizedFields = Array.isArray(fields) ? fields.filter(Boolean) : [];

  if (normalizedFields.length > 0) {
    lines.push('', '---');
    for (const field of normalizedFields) {
      if (typeof field === 'string') {
        lines.push(field);
        continue;
      }
      if (field.raw) {
        lines.push(field.raw);
        continue;
      }
      if (field.key && field.value !== undefined && field.value !== null && field.value !== '') {
        lines.push(`${field.key}：${field.value}`);
      }
    }
  }

  const card = {
    msgtype: 'action_card',
    title: title || '',
    text: lines.join('\n'),
    singleTitle: buttonText,
  };

  if (buttonUrl !== undefined) {
    card.singleURL = buttonUrl;
  }

  return card;
}

function formatTodoPayload({ subject, description, dueTime, sourceId, priority }) {
  return {
    subject: subject || '',
    description: description || '',
    dueTime,
    sourceId,
    priority: priority ?? 20,
  };
}

module.exports = {
  formatActionCard,
  formatTodoPayload,
};
