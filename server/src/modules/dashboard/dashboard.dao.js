/**
 * Dashboard DAO — 正式化 (SQLite 聚合查询)
 *
 * 全部统计基于 SQL 聚合，不再在 JS 层遍历
 * 支持 scope=self/dept/all 和 teamId 过滤
 */

const { getDb } = require('../../db/sqlite');
const { todayDate, daysAgoDate } = require('../../utils/datetime');

// 团队统计和卡片明细共用任务可见范围，不能信任客户端传入的 scope=all。
function resolveTeamScope(teamId, userId) {
  const row = getDb().prepare(`
    SELECT t.owner_id, t.is_archived, tm.role_id, tm.task_visibility_scope
    FROM teams t
    LEFT JOIN team_members tm ON tm.team_id = t.id AND tm.user_id = ?
    WHERE t.id = ?
  `).get(userId || '', teamId);
  if (!row || row.is_archived) {
    throw Object.assign(new Error('团队不存在或已解散'), { status: 404, code: 'TEAM_NOT_FOUND' });
  }
  const isSuperAdmin = userId && require('../../services/permissionCache').isSuperAdmin(userId);
  if (isSuperAdmin || row.owner_id === userId || row.role_id === 'owner' || row.role_id === 'admin') {
    return 'all';
  }
  if (!userId || !row.role_id) {
    throw Object.assign(new Error('无权限访问团队'), { status: 403, code: 'FORBIDDEN' });
  }
  return row.task_visibility_scope === 'self' ? 'self' : 'all';
}

/**
 * 构建数据范围 WHERE 条件
 */
function buildScopeWhere(context) {
  const { scope, userId, teamId, startDate, endDate } = context;
  const conditions = ['t.is_deleted = 0'];
  const params = [];
  const effectiveScope = teamId ? resolveTeamScope(teamId, userId) : scope;

  if (teamId) {
    conditions.push('t.team_id = ?');
    params.push(teamId);
  }

  if (startDate) {
    conditions.push("DATE(t.created_at, '+8 hours') >= ?");
    params.push(startDate);
  }

  if (endDate) {
    conditions.push("DATE(t.created_at, '+8 hours') <= ?");
    params.push(endDate);
  }

  if (effectiveScope === 'self' && userId) {
    conditions.push('(t.creator_id = ? OR t.assignee_id = ? OR t.participant_ids LIKE ?)');
    params.push(userId, userId, `%"${userId}"%`);
  }
  // scope=all → 不做过滤
  // scope=dept → 暂按 self 处理 (P2 dataScope 工具可后续接入)

  return { where: conditions.join(' AND '), params };
}

/**
 * T04.01 统计卡片
 */
function getDashboardStats(context = {}) {
  const db = getDb();
  const { where, params } = buildScopeWhere(context);
  const today = todayDate();

  const row = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN t.status NOT IN ('done', 'delayed_done', 'canceled') THEN 1 ELSE 0 END) as unfinished,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as inProgress,
      SUM(CASE WHEN t.status = 'delayed_in_progress' THEN 1 ELSE 0 END) as delayedInProgress,
      SUM(CASE WHEN t.status IN ('done', 'delayed_done') THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN t.status = 'delayed_done' THEN 1 ELSE 0 END) as delayedDone,
      SUM(CASE WHEN t.status = 'canceled' THEN 1 ELSE 0 END) as canceled,
      SUM(CASE WHEN t.status NOT IN ('done', 'delayed_done', 'canceled') AND t.due_date IS NOT NULL AND t.due_date < ? THEN 1 ELSE 0 END) as overdue
    FROM tasks t
    WHERE ${where}
  `).get(today, ...params);

  return {
    total: row.total || 0,
    todo: row.unfinished || 0,
    unfinished: row.unfinished || 0,
    inProgress: row.inProgress || 0,
    delayedInProgress: row.delayedInProgress || 0,
    done: row.done || 0,
    delayedDone: row.delayedDone || 0,
    canceled: row.canceled || 0,
    overdue: row.overdue || 0,
  };
}

/**
 * T04.01 趋势图 (按日聚合)
 */
function getDashboardTrend(context = {}) {
  const db = getDb();
  const days = Math.max(1, Number(context.days) || 30);
  const defaultStartDate = daysAgoDate(days - 1);
  const defaultEndDate = todayDate();
  
  // Provide defaults if not specified so we always have a bounded range
  const explicitStart = context.startDate || defaultStartDate;
  const explicitEnd = context.endDate || defaultEndDate;
  
  // ensure context has the bounds for the where clause
  const safeContext = { ...context, startDate: explicitStart, endDate: explicitEnd };
  const { where, params } = buildScopeWhere(safeContext);

  // 创建趋势
  const createdTrend = db.prepare(`
    SELECT DATE(t.created_at, '+8 hours') as date, COUNT(*) as count
    FROM tasks t
    WHERE ${where}
    GROUP BY DATE(t.created_at, '+8 hours')
  `).all(...params);

  // 完成趋势
  const completedTrend = db.prepare(`
    SELECT DATE(t.completed_at, '+8 hours') as date, COUNT(*) as count
    FROM tasks t
    WHERE ${where} AND t.status IN ('done', 'delayed_done') AND t.completed_at IS NOT NULL
    GROUP BY DATE(t.completed_at, '+8 hours')
  `).all(...params);

  const createdMap = new Map(createdTrend.map(r => [r.date, r.count]));
  const completedMap = new Map(completedTrend.map(r => [r.date, r.count]));

  const trend = [];
  const startObj = new Date(explicitStart);
  const endObj = new Date(explicitEnd);
  
  // Ensure we don't loop endlessly if dates are weird
  if (!isNaN(startObj.getTime()) && !isNaN(endObj.getTime())) {
    for (let d = new Date(startObj); d <= endObj; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      trend.push({
        date: dateStr,
        created: createdMap.get(dateStr) || 0,
        completed: completedMap.get(dateStr) || 0,
      });
    }
  }

  return trend;
}

/**
 * T04.01 团队分布
 */
function getTeamDistribution(context = {}) {
  const db = getDb();
  const { where, params } = buildScopeWhere(context);

  // 按 team 聚合 (只统计用户有权可见的任务)
  const rows = db.prepare(`
    SELECT
      tm.name as name,
      SUM(CASE WHEN t.status NOT IN ('done', 'delayed_done', 'canceled') THEN 1 ELSE 0 END) as unfinished,
      SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) as in_progress,
      SUM(CASE WHEN t.status = 'delayed_in_progress' THEN 1 ELSE 0 END) as delayed_in_progress,
      SUM(CASE WHEN t.status IN ('done', 'delayed_done') THEN 1 ELSE 0 END) as done,
      SUM(CASE WHEN t.status = 'delayed_done' THEN 1 ELSE 0 END) as delayed_done,
      SUM(CASE WHEN t.status = 'canceled' THEN 1 ELSE 0 END) as canceled
    FROM tasks t
    JOIN teams tm ON t.team_id = tm.id
    WHERE ${where}
    GROUP BY t.team_id, tm.name
    ORDER BY COUNT(*) DESC
  `).all(...params);

  return rows;
}

/**
 * T04.01 逾期列表
 */
function getOverdueTasks(context = {}) {
  const db = getDb();
  const limit = Number(context.limit || 10);
  const { where, params } = buildScopeWhere(context);
  const today = todayDate();

  const rows = db.prepare(`
    SELECT t.*, tm.name as team_name
    FROM tasks t
    LEFT JOIN teams tm ON t.team_id = tm.id
    WHERE ${where} AND t.status NOT IN ('done', 'delayed_done', 'canceled') AND t.due_date IS NOT NULL AND t.due_date < ?
    ORDER BY t.due_date ASC, t.updated_at DESC
    LIMIT ?
  `).all(...params, today, limit);

  return rows;
}

/**
 * 按状态筛选任务列表（支持分页）
 * status: 'all' | 'unfinished' | 'in_progress' | 'delayed_in_progress' | 'done' | 'delayed_done' | 'canceled' | 'overdue'
 */
function getTasksByStatus(context = {}) {
  const db = getDb();
  const { status = 'all', page = 1, pageSize = 20 } = context;
  const { where, params } = buildScopeWhere(context);
  const today = todayDate();

  let statusCondition = '';
  const extraParams = [];

  if (status === 'overdue') {
    statusCondition = " AND t.status NOT IN ('done', 'delayed_done', 'canceled') AND t.due_date IS NOT NULL AND t.due_date < ?";
    extraParams.push(today);
  } else if (status === 'unfinished' || status === 'todo') {
    statusCondition = " AND t.status NOT IN ('done', 'delayed_done', 'canceled')";
  } else if (status === 'done') {
    statusCondition = " AND t.status IN ('done', 'delayed_done')";
  } else if (status === 'in_progress' || status === 'delayed_in_progress' || status === 'delayed_done' || status === 'canceled') {
    statusCondition = ' AND t.status = ?';
    extraParams.push(status);
  }
  // status === 'all' → 不加额外条件

  const countRow = db.prepare(`
    SELECT COUNT(*) as total FROM tasks t
    WHERE ${where}${statusCondition}
  `).get(...params, ...extraParams);

  const offset = (page - 1) * pageSize;
  const rows = db.prepare(`
    SELECT t.*, tm.name as team_name
    FROM tasks t
    LEFT JOIN teams tm ON t.team_id = tm.id
    WHERE ${where}${statusCondition}
    ORDER BY t.updated_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, ...extraParams, pageSize, offset);

  return {
    list: rows,
    total: countRow.total || 0,
    page,
    pageSize,
  };
}

module.exports = {
  getDashboardStats,
  getDashboardTrend,
  getTeamDistribution,
  getOverdueTasks,
  getTasksByStatus,
};
