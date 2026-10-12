/**
 * 管理后台任务检索服务
 *
 * 负责构建管理员视角的任务筛选、分页和聚合结果。
 */
const taskDao = require('../../db/taskDao');

const DEFAULT_PAGE_SIZE = 100;

function matchesKeyword(task, keyword) {
  const normalized = String(keyword || '').trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  const haystack = [
    task.title,
    task.description,
    task.team_name,
    task.creator_name,
    task.assignee_name,
    ...(task.participants || []).map((item) => item?.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return haystack.includes(normalized);
}

function matchesTaskFilters(task, filters = {}) {
  if (filters.status && task.status !== filters.status) {
    return false;
  }

  if (filters.priority && task.priority !== filters.priority) {
    return false;
  }

  if (filters.teamId && task.team_id !== filters.teamId) {
    return false;
  }

  return matchesKeyword(task, filters.keyword);
}

function buildTaskFacets(tasks = []) {
  return {
    teams: [...new Map(
      tasks
        .filter((task) => task.team_id)
        .map((task) => [task.team_id, { id: task.team_id, name: task.team_name || '未命名团队' }])
    ).values()].sort((left, right) => String(left.name).localeCompare(String(right.name), 'zh-CN')),
    statuses: [...new Set(tasks.map((task) => task.status).filter(Boolean))],
    priorities: [...new Set(tasks.map((task) => task.priority).filter(Boolean))],
  };
}

function sortTasks(left, right) {
  const leftUpdatedAt = String(left.updated_at || '');
  const rightUpdatedAt = String(right.updated_at || '');
  if (leftUpdatedAt !== rightUpdatedAt) {
    return rightUpdatedAt.localeCompare(leftUpdatedAt);
  }
  return String(left.created_at || '').localeCompare(String(right.created_at || '')) * -1;
}

function buildAdminTaskFeed({ tasks = [], filters = {} }) {
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(200, Math.max(1, Number(filters.pageSize) || DEFAULT_PAGE_SIZE));
  const sortedTasks = tasks.slice().sort(sortTasks);
  const filtered = sortedTasks.filter((task) => matchesTaskFilters(task, filters));

  return {
    list: filtered.slice((page - 1) * pageSize, page * pageSize),
    total: filtered.length,
    page,
    pageSize,
    facets: buildTaskFacets(sortedTasks),
  };
}

function getAdminTaskFeed(filters = {}, userId) {
  const tasks = taskDao
    .listVisibleForScope({ scope: 'all' })
    .map((task) => taskDao.enrichTask(task, { userId }));

  return buildAdminTaskFeed({ tasks, filters });
}

module.exports = {
  buildAdminTaskFeed,
  getAdminTaskFeed,
};
