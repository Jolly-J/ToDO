/**
 * 管理后台审计流服务
 *
 * 负责将业务事件转换为管理端审计时间线数据。
 */
const ACTION_LABELS = require('../../utils/actionLabels');
const { loadBusinessEvents, toIsoTime } = require('./admin.health.service');

const ACTION_TITLES = {
  'auth.login.qr': '扫码登录',
  'auth.login.auto': '免登登录',
  'org.sync': '组织同步',
  'org.sync.summary': '组织同步汇总',
  'notify.task': '任务通知',
};

function normalizeResult(entry) {
  if (entry.result === 'failed' || entry.level === 'error') return 'failed';
  if (entry.result === 'skipped') return 'skipped';
  if (entry.result === 'partial' || entry.level === 'warn') return 'warning';
  return 'success';
}

function getTone(result) {
  if (result === 'failed') {
    return 'error';
  }
  if (result === 'skipped' || result === 'warning') {
    return 'warning';
  }
  return 'success';
}

function buildEventDetail(entry) {
  if (entry.action === 'org.sync.summary') {
    return `部门 ${entry.departmentsSynced || 0}，用户 ${entry.usersSynced || 0}，失活 ${entry.usersDisabled || 0}`;
  }

  if (entry.action === 'org.sync') {
    return entry.result === 'success'
      ? `同步完成，耗时 ${entry.durationMs || 0}ms`
      : `同步失败：${entry.errorMessage || entry.errorCode || '未知错误'}`;
  }

  if (entry.action === 'auth.login.qr' || entry.action === 'auth.login.auto') {
    return entry.result === 'success'
      ? `登录完成，耗时 ${entry.durationMs || 0}ms`
      : `登录失败：${entry.errorMessage || entry.errorCode || '未知错误'}`;
  }

  if (entry.action === 'notify.task') {
    return entry.notificationTitle
      ? `${entry.notificationTitle}，接收人 ${entry.targetUserId || '-'}`
      : `事件 ${entry.eventType || 'unknown'}，接收人 ${entry.targetUserId || '-'}`;
  }

  const errorMessage = entry.errorMessage || entry.error?.message;
  if (errorMessage) return String(errorMessage);

  const subjects = [
    entry.taskId ? `任务 ${entry.taskId}` : null,
    entry.commentId ? `评论 ${entry.commentId}` : null,
    entry.operatorId ? `操作人 ${entry.operatorId}` : null,
    entry.userId ? `用户 ${entry.userId}` : null,
  ].filter(Boolean);

  return subjects.join('，') || entry.message || entry.reqId || '事件已记录';
}

function matchesFilters(entry, filters = {}) {
  if (filters.action && entry.action !== filters.action) {
    return false;
  }

  if (filters.result && normalizeResult(entry) !== filters.result) {
    return false;
  }

  if (!filters.keyword) {
    return true;
  }

  const keyword = String(filters.keyword).trim().toLowerCase();
  if (!keyword) {
    return true;
  }

  const haystack = [
    entry.action,
    ACTION_TITLES[entry.action],
    buildEventDetail(entry),
    normalizeResult(entry),
    entry.errorMessage,
    entry.targetUserId,
    entry.operatorId,
    entry.reqId,
    entry.eventType,
    entry.notificationTitle,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(keyword);
}

function formatAuditItem(entry, index) {
  const result = normalizeResult(entry);
  const tone = getTone(result);
  return {
    id: `${entry.action}-${entry.time}-${index}`,
    action: entry.action,
    title: ACTION_TITLES[entry.action] || ACTION_LABELS[entry.action] || entry.actionLabel || entry.action,
    detail: buildEventDetail(entry),
    result,
    tone,
    label: result === 'failed' ? '失败' : result === 'skipped' ? '跳过' : result === 'warning' ? '关注' : '成功',
    time: toIsoTime(entry.time),
    reqId: entry.reqId || null,
    durationMs: entry.durationMs || 0,
    raw: entry,
  };
}

function buildAdminAuditFeed({ events = [], filters = {} }) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const filtered = events.filter((entry) => matchesFilters(entry, filters));
  const total = filtered.length;
  const list = filtered
    .slice((page - 1) * pageSize, page * pageSize)
    .map(formatAuditItem);

  return {
    list,
    total,
    page,
    pageSize,
    summary: {
      successCount: filtered.filter((entry) => normalizeResult(entry) === 'success').length,
      failedCount: filtered.filter((entry) => normalizeResult(entry) === 'failed').length,
      skippedCount: filtered.filter((entry) => normalizeResult(entry) === 'skipped').length,
      warningCount: filtered.filter((entry) => normalizeResult(entry) === 'warning').length,
    },
    facets: {
      actions: [...new Set(events.map((entry) => entry.action).filter(Boolean))].sort(),
      results: [...new Set(events.map(normalizeResult))],
    },
  };
}

function getAdminAuditFeed(filters = {}) {
  const events = loadBusinessEvents(filters.filePaths || filters.filePath);
  return buildAdminAuditFeed({ events, filters });
}

module.exports = {
  buildAdminAuditFeed,
  getAdminAuditFeed,
};
