/**
 * 仪表盘服务层
 *
 * 负责组合 dashboard DAO 并输出仪表盘所需的数据结构。
 */
const dashboardDao = require('./dashboard.dao');

function buildStats(context) {
  return dashboardDao.getDashboardStats(context);
}

function buildTrend(context) {
  return dashboardDao.getDashboardTrend(context);
}

function buildTeamDistribution(context) {
  return dashboardDao.getTeamDistribution(context);
}

function buildOverdueList(context) {
  return dashboardDao.getOverdueTasks({ ...context, limit: 10 });
}

function buildTasksByStatus(context) {
  return dashboardDao.getTasksByStatus(context);
}

module.exports = {
  buildStats,
  buildTrend,
  buildTeamDistribution,
  buildOverdueList,
  buildTasksByStatus,
};
