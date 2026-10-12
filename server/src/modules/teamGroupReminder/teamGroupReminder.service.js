const { getDb } = require('../../db/sqlite');
const { generatePrefixedId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');
const { buildWorkdayOverridesFromIcs, isChinaWorkday } = require('./workdayCalendar');
const dingtalkGroupRobotAdapter = require('./dingtalkGroupRobot.adapter');

const DEFAULT_HEADING = '请各位负责人关注未完成任务：';
const DEFAULT_SEND_TIME = '09:30';
const CALENDAR_URL = 'https://cdn.jsdelivr.net/npm/chinese-days/dist/holidays.ics';
const CALENDAR_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const CALENDAR_FETCH_TIMEOUT_MS = 10 * 1000;
const FINISHED_STATUSES = ['done', 'delayed_done', 'canceled'];

function createGroupReminderError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function boolToInt(value) {
  return value ? 1 : 0;
}

function intToBool(value) {
  return Number(value) === 1;
}

function normalizeTaskIds(taskIds) {
  if (!Array.isArray(taskIds)) {
    return [];
  }
  return [...new Set(taskIds.map((id) => String(id || '').trim()).filter(Boolean))];
}

function normalizeSendTime(value) {
  const text = String(value || '').trim();
  if (!/^\d{2}:\d{2}$/.test(text)) {
    throw createGroupReminderError('INVALID_PARAM', '发送时间格式应为 HH:mm', 400);
  }
  const [hour, minute] = text.split(':').map(Number);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    throw createGroupReminderError('INVALID_PARAM', '发送时间格式应为 HH:mm', 400);
  }
  return text;
}

function getTeamRecord(teamId) {
  return getDb()
    .prepare(
      `
      SELECT id, name, owner_id, is_archived
      FROM teams
      WHERE id = ?
      LIMIT 1
    `
    )
    .get(teamId);
}

function getTeamRole(teamId, userId, teamHint) {
  const team = teamHint || getTeamRecord(teamId);
  if (!team || !userId) {
    return null;
  }
  if (team.owner_id === userId) {
    return 'owner';
  }
  const membership = getDb()
    .prepare(
      `
      SELECT role_id
      FROM team_members
      WHERE team_id = ? AND user_id = ?
      LIMIT 1
    `
    )
    .get(teamId, userId);
  return membership?.role_id || null;
}

function ensureReadableTeam(teamId, userId) {
  const team = getTeamRecord(teamId);
  if (!team || team.is_archived === 1) {
    throw createGroupReminderError('TEAM_NOT_FOUND', '团队不存在', 404);
  }
  if (!getTeamRole(teamId, userId, team)) {
    throw createGroupReminderError('FORBIDDEN', '无权限访问团队', 403);
  }
  return team;
}

function ensureManageableTeam(teamId, userId) {
  const team = ensureReadableTeam(teamId, userId);
  const role = getTeamRole(teamId, userId, team);
  if (role !== 'owner' && role !== 'admin') {
    throw createGroupReminderError('FORBIDDEN', '仅团队创建者或管理员可配置群提醒', 403);
  }
  return team;
}

function toConfig(row) {
  if (!row) {
    return {
      webhook_url: '',
      secret: '',
      enabled: false,
    };
  }
  return {
    webhook_url: row.webhook_url || '',
    secret: row.secret || '',
    enabled: intToBool(row.enabled),
  };
}

function toRule(row) {
  if (!row) {
    return {
      enabled: false,
      send_time: DEFAULT_SEND_TIME,
      workday_only: true,
      heading: DEFAULT_HEADING,
      last_sent_date: null,
    };
  }
  return {
    enabled: intToBool(row.enabled),
    send_time: row.send_time || DEFAULT_SEND_TIME,
    workday_only: intToBool(row.workday_only),
    heading: row.heading || DEFAULT_HEADING,
    last_sent_date: row.last_sent_date || null,
  };
}

function getConfigRow(teamId) {
  return getDb()
    .prepare(
      `
      SELECT *
      FROM team_group_robot_configs
      WHERE team_id = ?
      LIMIT 1
    `
    )
    .get(teamId);
}

function getRuleRow(teamId) {
  return getDb()
    .prepare(
      `
      SELECT *
      FROM team_group_reminder_rules
      WHERE team_id = ?
      LIMIT 1
    `
    )
    .get(teamId);
}

function ensureConfigRow(teamId) {
  const existing = getConfigRow(teamId);
  if (existing) {
    return existing;
  }

  const stamp = nowIso();
  const row = {
    id: generatePrefixedId('tgr-config'),
    team_id: teamId,
    webhook_url: '',
    secret: '',
    enabled: 0,
    created_at: stamp,
    updated_at: stamp,
  };

  getDb()
    .prepare(
      `
      INSERT INTO team_group_robot_configs (
        id, team_id, webhook_url, secret, enabled, created_at, updated_at
      ) VALUES (
        @id, @team_id, @webhook_url, @secret, @enabled, @created_at, @updated_at
      )
    `
    )
    .run(row);

  return row;
}

function ensureRuleRow(teamId) {
  const existing = getRuleRow(teamId);
  if (existing) {
    return existing;
  }

  const config = ensureConfigRow(teamId);
  const stamp = nowIso();
  const row = {
    id: generatePrefixedId('tgr-rule'),
    team_id: teamId,
    config_id: config.id,
    enabled: 0,
    send_time: DEFAULT_SEND_TIME,
    workday_only: 1,
    heading: DEFAULT_HEADING,
    last_sent_date: null,
    created_at: stamp,
    updated_at: stamp,
  };

  getDb()
    .prepare(
      `
      INSERT INTO team_group_reminder_rules (
        id, team_id, config_id, enabled, send_time, workday_only, heading,
        last_sent_date, created_at, updated_at
      ) VALUES (
        @id, @team_id, @config_id, @enabled, @send_time, @workday_only, @heading,
        @last_sent_date, @created_at, @updated_at
      )
    `
    )
    .run(row);

  return row;
}

function getSelectedTaskIds(ruleId) {
  if (!ruleId) {
    return [];
  }
  return getDb()
    .prepare(
      `
      SELECT task_id
      FROM team_group_reminder_tasks
      WHERE rule_id = ?
      ORDER BY created_at ASC
    `
    )
    .all(ruleId)
    .map((row) => row.task_id);
}

function getCalendarSummary() {
  const row = getDb()
    .prepare(
      `
      SELECT COUNT(1) AS override_count, MAX(synced_at) AS last_synced_at
      FROM team_group_workday_calendar_cache
    `
    )
    .get();
  return {
    override_count: row?.override_count || 0,
    overrideCount: row?.override_count || 0,
    last_synced_at: row?.last_synced_at || null,
    lastSyncedAt: row?.last_synced_at || null,
    source: CALENDAR_URL,
  };
}

function getGroupReminder(teamId, userId) {
  ensureReadableTeam(teamId, userId);
  const config = getConfigRow(teamId);
  const rule = getRuleRow(teamId);

  return {
    config: toConfig(config),
    rule: toRule(rule),
    selectedTaskIds: getSelectedTaskIds(rule?.id),
    calendarSummary: getCalendarSummary(),
  };
}

function saveConfig(teamId, payload, userId) {
  ensureManageableTeam(teamId, userId);
  const existing = ensureConfigRow(teamId);
  const stamp = nowIso();
  const webhookUrl = String(payload?.webhook_url || '').trim();
  const secret = String(payload?.secret || '').trim();

  getDb()
    .prepare(
      `
      UPDATE team_group_robot_configs
      SET webhook_url = @webhook_url,
          secret = @secret,
          enabled = @enabled,
          updated_at = @updated_at
      WHERE id = @id
    `
    )
    .run({
      id: existing.id,
      webhook_url: webhookUrl,
      secret,
      enabled: boolToInt(payload?.enabled),
      updated_at: stamp,
    });

  return toConfig(getConfigRow(teamId));
}

function filterTaskIdsBelongingToTeam(teamId, taskIds) {
  const ids = normalizeTaskIds(taskIds);
  if (ids.length === 0) {
    return [];
  }

  const placeholders = ids.map(() => '?').join(',');
  const rows = getDb()
    .prepare(
      `
      SELECT id
      FROM tasks
      WHERE team_id = ?
        AND is_deleted = 0
        AND status NOT IN ('done', 'delayed_done', 'canceled')
        AND id IN (${placeholders})
      ORDER BY created_at ASC
    `
    )
    .all(teamId, ...ids);
  const valid = new Set(rows.map((row) => row.id));
  return ids.filter((id) => valid.has(id));
}

function replaceSelectedTasks(ruleId, taskIds) {
  const db = getDb();
  const stamp = nowIso();

  db.prepare('DELETE FROM team_group_reminder_tasks WHERE rule_id = ?').run(ruleId);
  const insert = db.prepare(
    `
    INSERT INTO team_group_reminder_tasks (id, rule_id, task_id, created_at)
    VALUES (@id, @rule_id, @task_id, @created_at)
  `
  );
  for (const taskId of taskIds) {
    insert.run({
      id: generatePrefixedId('tgr-task'),
      rule_id: ruleId,
      task_id: taskId,
      created_at: stamp,
    });
  }
}

function saveRule(teamId, payload, userId) {
  ensureManageableTeam(teamId, userId);
  const config = ensureConfigRow(teamId);
  const existing = ensureRuleRow(teamId);
  const stamp = nowIso();
  const selectedTaskIds = filterTaskIdsBelongingToTeam(teamId, payload?.task_ids);

  getDb().transaction(() => {
    getDb()
      .prepare(
        `
        UPDATE team_group_reminder_rules
        SET config_id = @config_id,
            enabled = @enabled,
            send_time = @send_time,
            workday_only = @workday_only,
            heading = @heading,
            updated_at = @updated_at
        WHERE id = @id
      `
      )
      .run({
        id: existing.id,
        config_id: config.id,
        enabled: boolToInt(payload?.enabled),
        send_time: normalizeSendTime(payload?.send_time || DEFAULT_SEND_TIME),
        workday_only: payload?.workday_only === undefined ? 1 : boolToInt(payload.workday_only),
        heading: String(payload?.heading || DEFAULT_HEADING).trim() || DEFAULT_HEADING,
        updated_at: stamp,
      });
    replaceSelectedTasks(existing.id, selectedTaskIds);
  })();

  const rule = getRuleRow(teamId);
  return {
    rule: toRule(rule),
    selectedTaskIds: getSelectedTaskIds(rule.id),
  };
}

function listTaskPool(teamId, userId) {
  ensureReadableTeam(teamId, userId);
  return getDb()
    .prepare(
      `
      SELECT
        t.id,
        t.title,
        t.status,
        t.priority,
        t.due_date AS due_date,
        t.assignee_id AS assignee_id,
        u.name AS assignee_name,
        ui.provider_userid AS dingtalk_user_id
      FROM tasks t
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN user_identities ui ON ui.user_id = t.assignee_id AND ui.provider = 'dingtalk'
      WHERE t.team_id = ?
        AND t.is_deleted = 0
        AND t.status NOT IN ('done', 'delayed_done', 'canceled')
      ORDER BY t.sort_order ASC, t.created_at DESC
    `
    )
    .all(teamId)
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      due_date: row.due_date || null,
      assignee_id: row.assignee_id || '',
      assignee_name: row.assignee_name || '',
      dingtalk_user_id: row.dingtalk_user_id || '',
      can_mention: Boolean(row.dingtalk_user_id),
    }));
}

function listSelectedUnfinishedTasks(teamId, ruleId) {
  if (!ruleId) {
    return [];
  }
  return getDb()
    .prepare(
      `
      SELECT
        t.id,
        t.title,
        t.status,
        t.due_date AS dueDate,
        u.name AS assigneeName,
        ui.provider_userid AS dingtalkUserId
      FROM team_group_reminder_tasks s
      JOIN tasks t ON t.id = s.task_id
      LEFT JOIN users u ON u.id = t.assignee_id
      LEFT JOIN user_identities ui ON ui.user_id = t.assignee_id AND ui.provider = 'dingtalk'
      WHERE s.rule_id = ?
        AND t.team_id = ?
        AND t.is_deleted = 0
        AND t.status NOT IN ('done', 'delayed_done', 'canceled')
      ORDER BY s.created_at ASC
    `
    )
    .all(ruleId, teamId)
    .map((row) => ({
      id: row.id,
      title: row.title,
      status: row.status,
      dueDate: row.dueDate || '',
      assigneeName: row.assigneeName || '',
      dingtalkUserId: row.dingtalkUserId || '',
    }));
}

async function sendRuleNow({ config, rule, tasks }) {
  const markdownPayload = dingtalkGroupRobotAdapter.buildGroupTaskReminderTextPayload({
    heading: rule.heading,
    tasks,
  });
  const mentionPayload = dingtalkGroupRobotAdapter.buildGroupTaskReminderMentionTextPayload({
    tasks,
  });

  const markdownResult = await dingtalkGroupRobotAdapter.sendText({
    webhookUrl: config.webhook_url,
    secret: config.secret,
    heading: rule.heading,
    tasks,
    payload: markdownPayload,
  });

  if (!markdownResult.success || !mentionPayload) {
    return markdownResult;
  }

  return dingtalkGroupRobotAdapter.sendText({
    webhookUrl: config.webhook_url,
    secret: config.secret,
    tasks,
    payload: mentionPayload,
  });
}

async function testSend(teamId, userId) {
  ensureManageableTeam(teamId, userId);
  const config = getConfigRow(teamId);
  const rule = getRuleRow(teamId);

  if (!config?.enabled || !config.webhook_url) {
    throw createGroupReminderError('INVALID_PARAM', '请先启用并配置钉钉群机器人 webhook', 400);
  }
  if (!rule) {
    throw createGroupReminderError('INVALID_PARAM', '请先保存群提醒规则', 400);
  }

  const tasks = listSelectedUnfinishedTasks(teamId, rule.id);
  if (tasks.length === 0) {
    throw createGroupReminderError('INVALID_PARAM', '当前没有可发送的未完成任务', 400);
  }

  const result = await sendRuleNow({
    config,
    rule: toRule(rule),
    tasks,
  });

  return {
    success: Boolean(result.success),
    taskCount: tasks.length,
    result,
  };
}

function getChinaDateTime(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(now);
  const get = (type) => parts.find((part) => part.type === type)?.value || '';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}

function loadCachedWorkdayOverrides() {
  const rows = getDb()
    .prepare(
      `
      SELECT date, is_workday, name
      FROM team_group_workday_calendar_cache
    `
    )
    .all();
  return new Map(rows.map((row) => [row.date, { isWorkday: intToBool(row.is_workday), name: row.name || '' }]));
}

function replaceCalendarCache(overrides) {
  const db = getDb();
  const stamp = nowIso();
  const insert = db.prepare(
    `
    INSERT INTO team_group_workday_calendar_cache (date, is_workday, name, source, synced_at)
    VALUES (@date, @is_workday, @name, 'chinese-days', @synced_at)
  `
  );

  db.transaction(() => {
    db.prepare('DELETE FROM team_group_workday_calendar_cache').run();
    for (const [date, item] of overrides.entries()) {
      insert.run({
        date,
        is_workday: boolToInt(item.isWorkday),
        name: item.name || '',
        synced_at: stamp,
      });
    }
  })();
}

async function refreshCalendarCacheFromSource() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALENDAR_FETCH_TIMEOUT_MS);
  if (typeof timeout.unref === 'function') {
    timeout.unref();
  }
  try {
    const response = await fetch(CALENDAR_URL, { signal: controller.signal });
    if (!response.ok) {
      throw createGroupReminderError('EXTERNAL_SERVICE_ERROR', '工作日历同步失败', 502);
    }
    const icsText = await response.text();
    const overrides = buildWorkdayOverridesFromIcs(icsText);
    replaceCalendarCache(overrides);
    return getCalendarSummary();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw createGroupReminderError('EXTERNAL_SERVICE_ERROR', '工作日历同步超时', 502);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function shouldRefreshCalendarCache(summary, now = new Date()) {
  if (!summary?.last_synced_at || !summary.override_count) {
    return true;
  }
  const syncedAt = Date.parse(summary.last_synced_at);
  if (!Number.isFinite(syncedAt)) {
    return true;
  }
  return now.getTime() - syncedAt > CALENDAR_CACHE_TTL_MS;
}

async function ensureCalendarCacheFresh() {
  const summary = getCalendarSummary();
  if (!shouldRefreshCalendarCache(summary)) {
    return summary;
  }
  return refreshCalendarCacheFromSource();
}

async function syncCalendar(teamId, userId) {
  ensureManageableTeam(teamId, userId);
  return refreshCalendarCacheFromSource();
}

function listDueRuleRows(currentDate, currentTime) {
  return getDb()
    .prepare(
      `
      SELECT
        r.*,
        c.webhook_url,
        c.secret,
        c.enabled AS config_enabled
      FROM team_group_reminder_rules r
      JOIN team_group_robot_configs c ON c.id = r.config_id
      JOIN teams t ON t.id = r.team_id
      WHERE r.enabled = 1
        AND c.enabled = 1
        AND c.webhook_url <> ''
        AND t.is_archived = 0
        AND r.send_time <= ?
        AND (r.last_sent_date IS NULL OR r.last_sent_date <> ?)
      ORDER BY r.send_time ASC, r.created_at ASC
    `
    )
    .all(currentTime, currentDate);
}

async function scanAndSendDueReminders({ now = new Date(), workdayOverrides } = {}) {
  const { date: currentDate, time: currentTime } = getChinaDateTime(now);
  let overrides = workdayOverrides instanceof Map ? workdayOverrides : null;
  if (!overrides) {
    try {
      await ensureCalendarCacheFresh();
    } catch (_error) {
      // 日历源不可用时沿用已有缓存；没有缓存时再退回周一至周五判断。
    }
    overrides = loadCachedWorkdayOverrides();
  }
  const dueRules = listDueRuleRows(currentDate, currentTime);
  const result = {
    checkedCount: dueRules.length,
    sentCount: 0,
    skippedCount: 0,
    failedCount: 0,
  };

  for (const row of dueRules) {
    if (intToBool(row.workday_only) && !isChinaWorkday(currentDate, overrides)) {
      result.skippedCount += 1;
      continue;
    }

    const tasks = listSelectedUnfinishedTasks(row.team_id, row.id);
    if (tasks.length === 0) {
      getDb()
        .prepare('UPDATE team_group_reminder_rules SET last_sent_date = ?, updated_at = ? WHERE id = ?')
        .run(currentDate, nowIso(), row.id);
      result.skippedCount += 1;
      continue;
    }

    const sendResult = await sendRuleNow({
      config: {
        webhook_url: row.webhook_url,
        secret: row.secret || '',
      },
      rule: toRule(row),
      tasks,
    });

    if (sendResult.success) {
      getDb()
        .prepare('UPDATE team_group_reminder_rules SET last_sent_date = ?, updated_at = ? WHERE id = ?')
        .run(currentDate, nowIso(), row.id);
      result.sentCount += 1;
    } else {
      result.failedCount += 1;
    }
  }

  return result;
}

module.exports = {
  getGroupReminder,
  saveConfig,
  saveRule,
  listTaskPool,
  testSend,
  syncCalendar,
  scanAndSendDueReminders,
  createGroupReminderError,
  getChinaDateTime,
  ensureCalendarCacheFresh,
  CALENDAR_URL,
  CALENDAR_FETCH_TIMEOUT_MS,
  FINISHED_STATUSES,
};
