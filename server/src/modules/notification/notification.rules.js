/**
 * 通知规则配置
 *
 * 定义每种业务事件的接收人解析策略和渠道分配。
 * 规则来源：docs/2026-04-02-通知系统整体规划.md §3.4-3.6
 */

const { getDb } = require('../../db/sqlite');
const { stakeholderCache } = require('./notification.cache');

// ──────────────────────────────────────────
// 辅助：查询任务相关人（短时自动过期缓存，避免同一事件处理周期内重复查库且防止脏数据）
// ──────────────────────────────────────────

function getTaskStakeholders(taskId) {
  const cached = stakeholderCache.get(taskId);
  if (cached) {
    return cached;
  }

  const task = getDb().prepare('SELECT creator_id, assignee_id, participant_ids, team_id FROM tasks WHERE id = ?').get(taskId);
  if (!task) {
    // 不缓存空结果：任务可能刚被创建，缓存会导致 60 秒内通知漏发
    return { creatorId: null, assigneeId: null, participantIds: [], teamId: null };
  }

  let participantIds = [];
  try {
    participantIds = task.participant_ids ? JSON.parse(task.participant_ids) : [];
  } catch { /* ignore */ }

  const result = {
    creatorId: task.creator_id,
    assigneeId: task.assignee_id,
    participantIds: participantIds.filter(Boolean),
    teamId: task.team_id || null,
  };
  stakeholderCache.set(taskId, result);
  return result;
}

function allTaskRelated(taskId) {
  const { creatorId, assigneeId, participantIds, teamId } = getTaskStakeholders(taskId);
  const adminIds = teamId ? getTeamAdmins(teamId) : [];
  return [...new Set([creatorId, assigneeId, ...participantIds, ...adminIds].filter(Boolean))];
}

function normalizeUserIds(userIds) {
  if (!Array.isArray(userIds)) return [];
  const seen = new Set();
  const result = [];
  for (const rawId of userIds) {
    const userId = String(rawId || '').trim();
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    result.push(userId);
  }
  return result;
}

function mentionedUserIds(payload) {
  return normalizeUserIds(payload.data?.mentionedUserIds);
}

function commentBroadcastRecipients(payload) {
  const mentioned = new Set(mentionedUserIds(payload));
  return allTaskRelated(payload.bizId).filter((userId) => !mentioned.has(userId));
}

function getTeamMembers(teamId) {
  const rows = getDb().prepare('SELECT user_id FROM team_members WHERE team_id = ?').all(teamId);
  return rows.map(r => r.user_id);
}

function getTeamAdmins(teamId) {
  if (!teamId) return [];
  const rows = getDb().prepare(
    "SELECT user_id FROM team_members WHERE team_id = ? AND role_id IN ('owner', 'admin')"
  ).all(teamId);
  return rows.map(r => r.user_id);
}

function getGlobalAdmins() {
  const rows = getDb().prepare(
    "SELECT ugr.user_id FROM user_global_roles ugr JOIN global_roles gr ON ugr.role_id = gr.id WHERE gr.code = 'super_admin'"
  ).all();
  return rows.map(r => r.user_id);
}

// ──────────────────────────────────────────
// 规则定义
// ──────────────────────────────────────────

const RULES = {
  // ── 任务域 ──

  'task.created': {
    recipients: (payload) => {
      const { assigneeId, participantIds, teamId } = getTaskStakeholders(payload.bizId);
      const adminIds = teamId ? getTeamAdmins(teamId) : [];
      return [...new Set([assigneeId, ...participantIds, ...adminIds].filter(Boolean))];
    },
    channels: (payload, recipientId) => {
      const { assigneeId } = getTaskStakeholders(payload.bizId);
      return recipientId === assigneeId ? ['todo', 'robot'] : ['robot'];
    },
    templateCode: 'task_assign_v2',
  },

  'task.assigned': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: (payload, recipientId) => {
      const targetUserId = payload.data?.targetUserId;
      return recipientId === targetUserId ? ['todo', 'robot'] : ['robot'];
    },
    templateCode: 'task_assign_v2',
  },

  'task.reassigned': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: (payload, recipientId) => {
      const targetUserId = payload.data?.targetUserId;
      return recipientId === targetUserId ? ['todo', 'robot'] : ['robot'];
    },
    templateCode: 'task_assign_v2',
  },

  'task.participant_added': {
    recipients: (payload) => {
      const { assigneeId, creatorId } = getTaskStakeholders(payload.bizId);
      const added = payload.data?.addedUserIds || [];
      return [...new Set([...added, assigneeId, creatorId].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.participant_removed': {
    recipients: (payload) => {
      const { assigneeId, creatorId } = getTaskStakeholders(payload.bizId);
      const removed = payload.data?.removedUserIds || [];
      return [...new Set([...removed, assigneeId, creatorId].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.priority_changed': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.status_changed': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.due_date_changed': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.commented': {
    recipients: (payload) => commentBroadcastRecipients(payload),
    channels: () => ['robot'],
    templateCode: 'task_comment_v2',
  },

  'task.progress_commented': {
    recipients: (payload) => commentBroadcastRecipients(payload),
    channels: () => ['robot'],
    templateCode: 'task_comment_v2',
  },

  'task.comment_mentioned': {
    recipients: (payload) => mentionedUserIds(payload),
    channels: () => ['robot'],
    templateCode: 'task_comment_mention_v2',
  },

  'task.deleted': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.restored': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'task_activity_v2',
  },

  'task.shared': {
    recipients: (payload) => payload.data?.targetUserIds || [],
    channels: () => ['robot'],
    templateCode: 'task_share_v2',
  },

  'task.activity_aggregated': {
    recipients: (payload) => allTaskRelated(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'task_aggregated_v2',
  },

  'task.due_soon': {
    recipients: (payload) => {
      const { assigneeId, creatorId, teamId } = getTaskStakeholders(payload.bizId);
      const adminIds = teamId ? getTeamAdmins(teamId) : [];
      return [...new Set([assigneeId, creatorId, ...adminIds].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'task_urgency_v2',
  },

  'task.overdue': {
    recipients: (payload) => {
      const { assigneeId, creatorId, teamId } = getTaskStakeholders(payload.bizId);
      const adminIds = teamId ? getTeamAdmins(teamId) : [];
      return [...new Set([assigneeId, creatorId, ...adminIds].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'task_urgency_v2',
  },

  'task.reminder': {
    recipients: (payload) => {
      const { assigneeId, creatorId } = getTaskStakeholders(payload.bizId);
      return [...new Set([assigneeId, creatorId].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'task_urgency_v2',
  },

  'task.periodic_reminder': {
    recipients: (payload) => {
      const { assigneeId, creatorId } = getTaskStakeholders(payload.bizId);
      return [...new Set([assigneeId, creatorId].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'task_urgency_v2',
  },

  'task.progress_audited': {
    recipients: (payload) => {
      // Send to the submitter (who is often the assignee, but maybe another participant)
      const targetUserId = payload.data?.targetUserId;
      return targetUserId ? [targetUserId] : [];
    },
    channels: () => ['robot'],
    templateCode: 'task_comment_v2', // or reuse a suitable template
  },

  // ── 团队域 ──

  'team.created': {
    recipients: (payload) => getTeamMembers(payload.bizId),
    channels: () => ['robot'],
    templateCode: 'team_broadcast_v2',
  },

  'team.admin_changed': {
    recipients: (payload) => {
      const changed = payload.data?.changedUserId;
      // 只通知被变更的人，不打扰其他管理员
      return changed ? [changed] : [];
    },
    channels: () => ['robot'],
    templateCode: 'team_broadcast_v2',
  },

  'team.dissolved': {
    recipients: (payload) => payload.data?.memberIds || [],
    channels: () => ['robot'],
    templateCode: 'team_broadcast_v2',
  },

  // ── 管理域 ──

  'admin.permission_granted': {
    recipients: (payload) => {
      const admins = getGlobalAdmins();
      const target = payload.data?.targetUserId;
      return [...new Set([...admins, target].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'admin_alert_v2',
  },

  'admin.permission_revoked': {
    recipients: (payload) => {
      const admins = getGlobalAdmins();
      const target = payload.data?.targetUserId;
      return [...new Set([...admins, target].filter(Boolean))];
    },
    channels: () => ['robot'],
    templateCode: 'admin_alert_v2',
  },

  'admin.sync_failed': {
    recipients: () => getGlobalAdmins(),
    channels: () => ['robot'],
    templateCode: 'admin_alert_v2',
  },
};

/**
 * 获取事件对应的通知规则
 * @param {string} eventType
 * @returns {object|null}
 */
function getRule(eventType) {
  return RULES[eventType] || null;
}

/**
 * 获取所有已注册的事件类型
 * @returns {string[]}
 */
function getAllEventTypes() {
  return Object.keys(RULES);
}

module.exports = {
  getRule,
  getAllEventTypes,
};
