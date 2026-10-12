/**
 * 管理后台健康总览服务
 *
 * 负责聚合日志和通知统计，生成管理后台健康概览数据。
 */
const fs = require('node:fs');
const path = require('node:path');
const notificationDao = require('../notification/notification.dao');

const LOG_DIR = path.resolve(__dirname, '../../../..', 'logs');
const MAIN_LOG_FILE = path.join(LOG_DIR, 'taskflow.log');
const NOTIFICATION_LOG_FILE = path.join(LOG_DIR, 'notification.log');
const DEFAULT_EVENT_FILES = [MAIN_LOG_FILE, NOTIFICATION_LOG_FILE];

// 只关注钉钉业务事件（channel = dingtalk-business）和登录事件
const WATCHED_ACTIONS = new Set([
  'auth.login.qr',
  'auth.login.auto',
  'org.sync',
  'org.sync.summary',
]);
const HOURS_WINDOW = 24;
const MAX_EVENT_LINES_PER_FILE = 1500;
const MAX_RECENT_EVENTS = 20;

const ACTION_TITLES = {
  'auth.login.qr': '扫码登录',
  'auth.login.auto': '免登登录',
  'org.sync': '组织同步',
  'org.sync.summary': '组织同步汇总',
};

function safeParseLine(line) {
  try {
    return JSON.parse(line);
  } catch (_error) {
    return null;
  }
}

function normalizeEventFiles(filePaths) {
  if (!filePaths) return DEFAULT_EVENT_FILES;
  return Array.isArray(filePaths) ? filePaths : [filePaths];
}

function parseEventTime(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;

  const hasTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(raw);
  const date = new Date(hasTimezone ? raw : `${raw}+08:00`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function toIsoTime(value) {
  const date = parseEventTime(value);
  if (!date) return null;
  const local = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return local.toISOString().replace('Z', '+08:00');
}

function getEventIdentity(entry) {
  if (entry.reqId) {
    return `${entry.reqId}:${entry.action}`;
  }
  return [
    entry.time,
    entry.action,
    entry.taskId,
    entry.commentId,
    entry.userId,
    entry.targetUserId,
    entry.bizId,
    entry.eventType,
    entry.result,
  ]
    .filter(Boolean)
    .join(':');
}

function shouldReplaceEvent(current, candidate) {
  if (candidate.channel === 'dingtalk-business' && current.channel !== 'dingtalk-business') {
    return true;
  }
  if (candidate.result && !current.result) {
    return true;
  }
  return false;
}

function loadBusinessEvents(filePaths = DEFAULT_EVENT_FILES) {
  const events = [];

  for (const filePath of normalizeEventFiles(filePaths)) {
    if (!filePath || !fs.existsSync(filePath)) continue;

    const sourceFile = path.basename(filePath);
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(-MAX_EVENT_LINES_PER_FILE);

    for (const line of lines) {
      const entry = safeParseLine(line);
      if (entry && entry.time && entry.action) {
        events.push({ ...entry, sourceFile });
      }
    }
  }

  const deduplicated = new Map();
  for (const entry of events) {
    const identity = getEventIdentity(entry);
    const current = deduplicated.get(identity);
    if (!current || shouldReplaceEvent(current, entry)) {
      deduplicated.set(identity, entry);
    }
  }

  return [...deduplicated.values()].sort((left, right) => {
    const leftTime = parseEventTime(left.time)?.getTime() || 0;
    const rightTime = parseEventTime(right.time)?.getTime() || 0;
    return rightTime - leftTime;
  });
}

function resolveRecentEvents(events) {
  return events.slice(0, MAX_RECENT_EVENTS).map((entry, index) => {
    let detail = '等待补充审计详情';

    if (entry.action === 'org.sync.summary') {
      detail = `部门 ${entry.departmentsSynced || 0}，用户 ${entry.usersSynced || 0}，失活 ${entry.usersDisabled || 0}`;
    } else if (entry.action === 'org.sync') {
      detail = entry.result === 'success'
        ? `同步完成，耗时 ${entry.durationMs || 0}ms`
        : `同步失败：${entry.errorMessage || entry.errorCode || '未知错误'}`;
    } else if (entry.action === 'auth.login.qr' || entry.action === 'auth.login.auto') {
      detail = entry.result === 'success'
        ? `登录完成，耗时 ${entry.durationMs || 0}ms`
        : `登录失败：${entry.errorMessage || entry.errorCode || '未知错误'}`;
    }

    return {
      id: `${entry.action}-${entry.time}-${index}`,
      title: ACTION_TITLES[entry.action] || entry.action,
      detail,
      level: entry.result === 'failed' ? 'error' : entry.level === 'warn' ? 'warning' : 'success',
      label: entry.result === 'failed' ? '失败' : entry.result === 'success' ? '成功' : '处理中',
      time: toIsoTime(entry.time),
    };
  });
}

function buildAdminHealthOverview({ events = [], notificationStats, now = new Date() }) {
  const nowTime = new Date(now);
  const windowStartTime = nowTime.getTime() - HOURS_WINDOW * 60 * 60 * 1000;
  const watchedEvents = events.filter((entry) => WATCHED_ACTIONS.has(entry.action));
  const channelEvents = watchedEvents.filter((entry) => entry.channel === 'dingtalk-business');
  const healthEvents = channelEvents.length ? channelEvents : watchedEvents;
  const recentWindowEvents = healthEvents.filter((entry) => {
    const eventTime = parseEventTime(entry.time)?.getTime();
    return Number.isFinite(eventTime) && eventTime >= windowStartTime;
  });
  const loginEvents = recentWindowEvents.filter(
    (entry) => entry.action === 'auth.login.qr' || entry.action === 'auth.login.auto'
  );
  const loginSuccessCount = loginEvents.filter((entry) => entry.result === 'success').length;
  const loginFailedCount = loginEvents.filter((entry) => entry.result === 'failed').length;
  const loginTotalCount = loginEvents.length;
  const loginSuccessRate = loginTotalCount > 0
    ? Math.round((loginSuccessCount / loginTotalCount) * 100)
    : 0;

  const latestSyncEvent = healthEvents.find(
    (entry) => entry.action === 'org.sync.summary' || entry.action === 'org.sync'
  );

  const safeNotificationStats = notificationStats || {
    total24h: 0,
    unreadTotal: 0,
    lastCreatedAt: null,
  };

  return {
    generatedAt: toIsoTime(nowTime),
    windowHours: HOURS_WINDOW,
    metrics: {
      login: {
        label: '登录成功率',
        value: `${loginSuccessRate}%`,
        detail: loginTotalCount > 0
          ? `24h 内 ${loginSuccessCount}/${loginTotalCount} 次成功`
          : '24h 内暂无登录事件',
        tone: loginTotalCount === 0
          ? 'neutral'
          : loginSuccessRate >= 95
            ? 'success'
            : loginSuccessRate >= 70
              ? 'warning'
              : 'error',
        progress: loginSuccessRate,
        totalCount: loginTotalCount,
        successCount: loginSuccessCount,
        failedCount: loginFailedCount,
        lastEventAt: loginEvents[0] ? toIsoTime(loginEvents[0].time) : null,
        source: 'logs/notification.log',
      },
      sync: {
        label: '最近同步',
        value: latestSyncEvent
          ? latestSyncEvent.result === 'success'
            ? '成功'
            : '失败'
          : '--',
        detail: latestSyncEvent
          ? `部门 ${latestSyncEvent.departmentsSynced || 0}，用户 ${latestSyncEvent.usersSynced || 0}，失活 ${latestSyncEvent.usersDisabled || 0}`
          : '暂无组织同步记录',
        tone: !latestSyncEvent
          ? 'neutral'
          : latestSyncEvent.result === 'success'
            ? 'success'
            : 'error',
        progress: latestSyncEvent?.result === 'success' ? 100 : 0,
        lastEventAt: latestSyncEvent ? toIsoTime(latestSyncEvent.time) : null,
        durationMs: latestSyncEvent?.durationMs || 0,
        departmentsSynced: latestSyncEvent?.departmentsSynced || 0,
        usersSynced: latestSyncEvent?.usersSynced || 0,
        usersDisabled: latestSyncEvent?.usersDisabled || 0,
        source: 'logs/notification.log',
      },
      notifications: {
        label: '通知入库',
        value: String(safeNotificationStats.total24h || 0),
        detail: `24h 内新增 ${safeNotificationStats.total24h || 0} 条，未读 ${safeNotificationStats.unreadTotal || 0} 条`,
        tone: safeNotificationStats.total24h > 0 ? 'success' : 'neutral',
        progress: safeNotificationStats.total24h > 0
          ? Math.max(0, 100 - Math.min(100, safeNotificationStats.unreadTotal * 5))
          : 0,
        total24h: safeNotificationStats.total24h || 0,
        unreadTotal: safeNotificationStats.unreadTotal || 0,
        lastCreatedAt: safeNotificationStats.lastCreatedAt || null,
        source: 'db.notifications',
      },
    },
    recentEvents: resolveRecentEvents(healthEvents),
  };
}

function getAdminHealthOverview(options = {}) {
  const events = loadBusinessEvents(options.filePaths || options.filePath);
  const notificationStats = notificationDao.getSystemHealthStats({
    now: options.now,
  });

  return buildAdminHealthOverview({
    now: options.now,
    events,
    notificationStats,
  });
}

module.exports = {
  buildAdminHealthOverview,
  loadBusinessEvents,
  getAdminHealthOverview,
  parseEventTime,
  toIsoTime,
};
