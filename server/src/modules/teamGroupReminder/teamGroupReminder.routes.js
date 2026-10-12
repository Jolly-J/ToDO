const express = require('express');
const { success, error } = require('../../utils/response');
const service = require('./teamGroupReminder.service');

const router = express.Router();

function handleError(res, err) {
  if (err?.code === 'TEAM_NOT_FOUND') {
    return error(res, 'TEAM_NOT_FOUND', err.message || '团队不存在');
  }
  if (err?.code === 'FORBIDDEN') {
    return error(res, 'FORBIDDEN', err.message || '无权限操作');
  }
  if (err?.code === 'INVALID_PARAM') {
    return error(res, 'INVALID_PARAM', err.message || '参数错误');
  }
  if (err?.code === 'EXTERNAL_SERVICE_ERROR') {
    return error(res, 'EXTERNAL_SERVICE_ERROR', err.message || '外部服务调用失败');
  }
  return error(res, 'INTERNAL_ERROR', err?.message || '群提醒操作失败');
}

router.get('/teams/:teamId/group-reminder', (req, res) => {
  try {
    return success(res, service.getGroupReminder(req.params.teamId, req.user?.id));
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/teams/:teamId/group-reminder/config', (req, res) => {
  try {
    return success(res, service.saveConfig(req.params.teamId, req.body || {}, req.user?.id), '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

router.put('/teams/:teamId/group-reminder/rule', (req, res) => {
  try {
    return success(res, service.saveRule(req.params.teamId, req.body || {}, req.user?.id), '保存成功');
  } catch (err) {
    return handleError(res, err);
  }
});

router.get('/teams/:teamId/group-reminder/task-pool', (req, res) => {
  try {
    return success(res, { list: service.listTaskPool(req.params.teamId, req.user?.id) });
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/teams/:teamId/group-reminder/test-send', async (req, res) => {
  try {
    return success(res, await service.testSend(req.params.teamId, req.user?.id), '发送完成');
  } catch (err) {
    return handleError(res, err);
  }
});

router.post('/teams/:teamId/group-reminder/calendar/sync', async (req, res) => {
  try {
    return success(res, await service.syncCalendar(req.params.teamId, req.user?.id), '同步完成');
  } catch (err) {
    return handleError(res, err);
  }
});

module.exports = router;
