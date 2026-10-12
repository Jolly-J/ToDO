/**
 * 任务集合查询路由
 *
 * 提供团队任务列表、看板、日历和我的任务查询接口。
 */
const express = require('express');
const taskDao = require('../db/taskDao');
const permissionCache = require('../services/permissionCache');

const router = express.Router();

function resolveCurrentUserId(req) {
  return req.user?.id;
}

router.get('/teams/:teamId/tasks', (req, res) => {
  const view = String(req.query.view || 'list');
  const userId = resolveCurrentUserId(req);
  const result = taskDao.listByTeam(req.params.teamId, {
    view,
    status: req.query.status,
    priority: req.query.priority,
    assignee_id: req.query.assignee_id,
    keyword: req.query.keyword,
    dueStartDate: req.query.due_start_date,
    dueEndDate: req.query.due_end_date,
    userId,
    dataScope: permissionCache.getUserDataScope(userId),
  });

  if (view === 'board') {
    return res.json({
      code: 0,
      message: 'ok',
      data: {
        in_progress: result.list.filter((task) => task.status === 'in_progress'),
        delayed_in_progress: result.list.filter((task) => task.status === 'delayed_in_progress'),
        done: result.list.filter((task) => task.status === 'done'),
        delayed_done: result.list.filter((task) => task.status === 'delayed_done'),
        canceled: result.list.filter((task) => task.status === 'canceled'),
      },
    });
  }

  if (view === 'calendar') {
    return res.json({
      code: 0,
      message: 'ok',
      data: result.list
        .filter((task) => task.due_date)
        .map((task) => ({
          id: task.id,
          title: task.title,
          date: task.due_date,
          priority: task.priority,
          status: task.status,
        })),
    });
  }

  return res.json({
    code: 0,
    message: 'ok',
    data: {
      list: result.list,
      total: result.total,
      page: 1,
      pageSize: 20,
    },
  });
});

router.get('/my-tasks', (req, res) => {
  const result = taskDao.listMyTasks(resolveCurrentUserId(req), {
    scope: req.query.scope,
    status: req.query.status,
    priority: req.query.priority,
    keyword: req.query.keyword,
    dueStartDate: req.query.due_start_date || req.query.dueStartDate,
    dueEndDate: req.query.due_end_date || req.query.dueEndDate,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: {
      list: result.list,
      total: result.total,
      page: 1,
      pageSize: 20,
      summary: result.summary,
    },
  });
});

module.exports = router;
