/**
 * 仪表盘控制器
 *
 * 负责解析请求参数并返回仪表盘统计接口响应。
 */
const dashboardService = require('./dashboard.service');
const { resolveCurrentUserId, resolveDataScope } = require('../../utils/requestUser');

function resolveDashboardContext(req) {
  const days = Number(req.query.days) || undefined;
  let startDate = String(req.query.start_date || '').trim() || undefined;
  let endDate = String(req.query.end_date || '').trim() || undefined;

  // 后向兼容遗留的 days 参数
  if (days && !startDate) {
    const d = new Date();
    d.setDate(d.getDate() - days);
    startDate = d.toISOString().split('T')[0];
  }

  return {
    userId: resolveCurrentUserId(req),
    scope: resolveDataScope(req, 'self'),
    teamId: String(req.query.team_id || '').trim() || undefined,
    startDate,
    endDate,
  };
}

function getStats(req, res) {
  const data = dashboardService.buildStats(resolveDashboardContext(req));

  return res.json({
    code: 0,
    message: 'ok',
    data,
  });
}

function getTrend(req, res) {
  const data = dashboardService.buildTrend(resolveDashboardContext(req));

  return res.json({
    code: 0,
    message: 'ok',
    data,
  });
}

function getTeamDistribution(req, res) {
  const data = dashboardService.buildTeamDistribution(resolveDashboardContext(req));

  return res.json({
    code: 0,
    message: 'ok',
    data,
  });
}

function getOverdue(req, res) {
  const data = dashboardService.buildOverdueList(resolveDashboardContext(req));

  return res.json({
    code: 0,
    message: 'ok',
    data,
  });
}

function getTasksByStatus(req, res) {
  const ctx = resolveDashboardContext(req);
  const status = String(req.query.status || 'all').trim();
  const page = Math.max(1, Number(req.query.page) || 1);
  const pageSize = Math.min(50, Math.max(1, Number(req.query.page_size) || 20));

  const data = dashboardService.buildTasksByStatus({ ...ctx, status, page, pageSize });

  return res.json({
    code: 0,
    message: 'ok',
    data,
  });
}

module.exports = {
  getStats,
  getTrend,
  getTeamDistribution,
  getOverdue,
  getTasksByStatus,
};
