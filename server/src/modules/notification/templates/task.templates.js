/**
 * 任务域通知模板 V2
 */

const { formatActionCard, formatTodoPayload } = require('./format');

const PRIORITY_MAP = { urgent: '紧急', high: '高', medium: '中', low: '低' };
const STATUS_MAP = {
  in_progress: '进行中',
  delayed_in_progress: '延期进行中',
  done: '已完成',
  delayed_done: '延期完成',
  canceled: '已取消',
};
const URGENCY_SUMMARY = {
  'task.due_soon': '任务即将到期，请尽快处理',
  'task.overdue': '任务已逾期，请立即处理',
  'task.reminder': '任务提醒：请及时填写进展',
  'task.periodic_reminder': '任务提醒：请及时填写进展',
};
const URGENCY_PRIORITY = {
  'task.due_soon': 30,
  'task.overdue': 40,
  'task.reminder': 30,
};
const URGENCY_SOURCE = {
  'task.due_soon': 'task_due_soon',
  'task.overdue': 'task_overdue',
  'task.reminder': 'task_reminder',
};
const RICH_TEXT_IMAGE_HINT = '[图片] 请进入任务查看';
const RICH_TEXT_IMAGE_MARKDOWN_PATTERN = /!\[[^\]]*]\(\s*<?(?:https?:\/\/[^)\s>]+)?\/uploads\/rich-text-images\/[^)\s>]*(?:>?(?:\s+(?:"[^"]*"|'[^']*'))?\s*\))?/g;

function priorityLabel(value) {
  return PRIORITY_MAP[value] || value || '';
}

function statusLabel(value) {
  return STATUS_MAP[value] || value || '';
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

function buildComparison(oldValue, newValue, formatter = (value) => value || '') {
  const before = formatter(oldValue) || '未设置';
  const after = formatter(newValue) || '未设置';
  return `${before} → ${after}`;
}

function valueField(key, value) {
  if (value === undefined || value === null || value === '') return null;
  return { key, value };
}

function isSameUser(left, right) {
  if (!left || !right) return false;
  return String(left) === String(right);
}

function quotedField(text) {
  if (!text) return null;
  return { raw: `> ${String(text).slice(0, 100)}` };
}

function normalizeCommentSnippetForNotification(text) {
  const normalized = String(text || '')
    .replace(RICH_TEXT_IMAGE_MARKDOWN_PATTERN, RICH_TEXT_IMAGE_HINT)
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  return normalized || '';
}

function bulletFields(lines) {
  if (!Array.isArray(lines) || lines.length === 0) {
    return [{ raw: '- 任务信息已更新' }];
  }
  return lines.map((line) => ({ raw: `- ${line}` }));
}

function taskFields(variables) {
  return [
    valueField('优先级', priorityLabel(variables.priority)),
    valueField('截止时间', variables.dueDate || formatDateValue(variables.dueAt)),
  ].filter(Boolean);
}

function buildAssignSummary(variables) {
  const actorName = variables.actorName || '系统';
  const isTarget = variables.isTargetRecipient !== undefined
    ? Boolean(variables.isTargetRecipient)
    : isSameUser(variables.recipientId, variables.targetUserId);

  if (variables.eventType === 'task.created') {
    return isTarget
      ? `${actorName} 指派你为任务负责人，请及时查看`
      : `${actorName} 创建了任务并将你加为参与人`;
  }

  if (variables.eventType === 'task.assigned') {
    return isTarget
      ? `${actorName} 指派你为任务负责人，请及时查看`
      : `${actorName} 指派了任务负责人`;
  }

  if (variables.eventType === 'task.reassigned') {
    return isTarget
      ? `${actorName} 将任务负责人变更为你，请及时查看`
      : `${actorName} 变更了任务负责人`;
  }

  return `${actorName} 更新了任务负责人`;
}

function buildActivitySummary(variables) {
  const actorName = variables.actorName || '系统';
  const eventType = variables.eventType || '';

  if (eventType === 'task.status_changed') return `${actorName} 变更了任务状态`;
  if (eventType === 'task.priority_changed') return `${actorName} 变更了任务优先级`;
  if (eventType === 'task.due_date_changed') return `${actorName} 变更了截止时间`;
  if (eventType === 'task.participant_added') return `${actorName} 添加了新的参与人`;
  if (eventType === 'task.participant_removed') return `${actorName} 移除了参与人`;
  if (eventType === 'task.deleted') return `${actorName} 删除了任务`;
  if (eventType === 'task.restored') return `${actorName} 恢复了任务，请继续跟进`;
  return `${actorName} 更新了任务`;
}

function buildActivityFields(variables) {
  const eventType = variables.eventType || '';

  if (eventType === 'task.status_changed') {
    return [valueField('状态', buildComparison(variables.oldStatus, variables.status, statusLabel))];
  }
  if (eventType === 'task.priority_changed') {
    return [valueField('优先级', buildComparison(variables.oldPriority, variables.priority, priorityLabel))];
  }
  if (eventType === 'task.due_date_changed') {
    return [
      valueField(
        '截止时间',
        buildComparison(variables.oldDueDate || variables.oldDueAt, variables.dueDate || variables.dueAt, formatDateValue)
      ),
    ];
  }
  if (eventType === 'task.participant_added') {
    return [valueField('新增参与人', (variables.addedUserNames || []).join('、'))];
  }
  if (eventType === 'task.participant_removed') {
    return [valueField('移除参与人', (variables.removedUserNames || []).join('、'))];
  }
  if (eventType === 'task.restored') {
    return taskFields(variables);
  }
  return [];
}

function buildMentionCard(variables) {
  const actorName = variables.actorName || '系统';
  const taskTitle = variables.title || '任务';
  const snippet = normalizeCommentSnippetForNotification(variables.commentSnippet) || '有新的评论内容';
  const sourceLabel = variables.isProgressComment ? '进展' : '评论';

  return formatActionCard({
    title: taskTitle,
    summary: `${actorName} 在${sourceLabel}中 @ 了你`,
    fields: [quotedField(snippet)].filter(Boolean),
    buttonText: '查看讨论',
  });
}

module.exports = [
  {
    code: 'task_assign_v2',
    render(variables) {
      const isTarget = variables.isTargetRecipient !== undefined
        ? Boolean(variables.isTargetRecipient)
        : isSameUser(variables.recipientId, variables.targetUserId);
      return {
        todo: isTarget
          ? formatTodoPayload({
              subject: variables.title,
              description: '你被指派为任务负责人，请及时查看',
              dueTime: variables.dueAt ? new Date(variables.dueAt).getTime() : undefined,
              sourceId: `task_assign_${variables.bizId}`,
              priority: 20,
            })
          : undefined,
        robot: formatActionCard({
          title: variables.title,
          summary: buildAssignSummary(variables),
          fields: taskFields(variables),
          buttonText: '查看任务',
        }),
      };
    },
  },

  {
    code: 'task_urgency_v2',
    render(variables) {
      const isAssignee = variables.isAssignee !== undefined
        ? Boolean(variables.isAssignee)
        : isSameUser(variables.recipientId, variables.assigneeId);
      return {
        todo: isAssignee
          ? formatTodoPayload({
              subject: variables.title,
              description: URGENCY_SUMMARY[variables.eventType] || '任务需要处理',
              dueTime: variables.dueAt ? new Date(variables.dueAt).getTime() : undefined,
              sourceId: (variables.eventType === 'task.reminder' || variables.eventType === 'task.periodic_reminder')
                ? `${URGENCY_SOURCE[variables.eventType]}_${variables.bizId}_${Date.now()}`
                : `${URGENCY_SOURCE[variables.eventType] || 'task_urgency'}_${variables.bizId}`,
              priority: URGENCY_PRIORITY[variables.eventType] || 30,
            })
          : undefined,
        robot: formatActionCard({
          title: variables.title,
          summary: URGENCY_SUMMARY[variables.eventType] || '任务需要处理',
          fields: [valueField('截止时间', variables.dueDate || formatDateValue(variables.dueAt))].filter(Boolean),
          buttonText: '查看任务',
        }),
      };
    },
  },

  {
    code: 'task_activity_v2',
    render(variables) {
      const buttonText = variables.eventType === 'task.deleted' ? '' : '查看任务';
      const buttonUrl = variables.eventType === 'task.deleted' ? '' : undefined;
      return {
        robot: formatActionCard({
          title: variables.title,
          summary: buildActivitySummary(variables),
          fields: buildActivityFields(variables).filter(Boolean),
          buttonText,
          buttonUrl,
        }),
      };
    },
  },

  {
    code: 'task_comment_v2',
    render(variables) {
      const summary = variables.eventType === 'task.progress_commented'
        ? `${variables.actorName || '系统'} 更新了进展`
        : `${variables.actorName || '系统'} 发表了评论`;

      return {
        robot: formatActionCard({
          title: variables.title,
          summary,
          fields: [quotedField(normalizeCommentSnippetForNotification(variables.commentSnippet) || '有新的评论内容')].filter(Boolean),
          buttonText: '查看任务',
        }),
      };
    },
  },

  {
    code: 'task_comment_mention_v2',
    render(variables) {
      return {
        robot: buildMentionCard(variables),
      };
    },
  },

  {
    code: 'task_share_v2',
    render(variables) {
      return {
        robot: formatActionCard({
          title: variables.title,
          summary: `${variables.actorName || '系统'} 向你分享了一个任务`,
          fields: [],
          buttonText: '查看任务',
        }),
      };
    },
  },

  {
    code: 'task_aggregated_v2',
    render(variables) {
      return {
        robot: formatActionCard({
          title: variables.title,
          summary: `${variables.actorName || '系统'} 对任务进行了多项变更`,
          fields: bulletFields(variables.summaryLines),
          buttonText: '查看任务',
        }),
      };
    },
  },
];
