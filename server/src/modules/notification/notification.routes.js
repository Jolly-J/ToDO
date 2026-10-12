/**
 * 通知路由
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const { success, paginated, error: errorRes } = require('../../utils/response');
const notificationDao = require('./notification.dao');
const taskDao = require('../../db/taskDao');
const roleDao = require('../../db/roleDao');
const { getDb } = require('../../db/sqlite');
const { decryptLinkToken } = require('../../utils/linkCrypto');
const notificationAggregation = require('./notification.aggregation');
const { markShareReadonlyAccess } = require('./shareReadonlyRegistry');

const router = Router();

router.use(auth);

function canOpenTeamLanding(userId, teamId) {
  if (!userId || !teamId) {
    return false;
  }

  const team = getDb()
    .prepare('SELECT owner_id FROM teams WHERE id = ? AND is_archived = 0 LIMIT 1')
    .get(teamId);

  if (!team) {
    return false;
  }

  return team.owner_id === userId || roleDao.isTeamMember(userId, teamId);
}

/**
 * GET /api/notifications — 通知列表
 */
router.get('/', (req, res) => {
  const result = notificationDao.listByUserId(req.user.id, {
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
    isRead: req.query.is_read !== undefined ? Number(req.query.is_read) : undefined,
  });

  return paginated(res, result);
});

/**
 * GET /api/notifications/unread-count — 未读数量
 */
router.get('/unread-count', (req, res) => {
  const count = notificationDao.getUnreadCount(req.user.id);
  return success(res, { count });
});

/**
 * PATCH /api/notifications/:id/read — 标记已读
 */
router.patch('/:id/read', (req, res) => {
  notificationDao.markAsRead(req.params.id, req.user.id);
  return success(res, null, '已标记已读');
});

/**
 * POST /api/notifications/read-all — 全部标记已读
 */
router.post('/read-all', (req, res) => {
  const count = notificationDao.markAllAsRead(req.user.id);
  return success(res, { count }, `已标记 ${count} 条为已读`);
});

/**
 * POST /api/notifications/aggregation/flush — 立即发送当前任务的聚合通知
 */
router.post('/aggregation/flush', (req, res) => {
  const taskId = String(req.body?.taskId || '').trim();
  if (!taskId) {
    return errorRes(res, 'INVALID_PARAM', '缺少 taskId 参数');
  }

  const result = notificationAggregation.flushByTaskActor(taskId, req.user.id, {
    reqId: req.requestId,
  });
  return success(res, result);
});

/**
 * GET /api/notifications/resolve-link — 解密通知跳转链接 token
 */
router.get('/resolve-link', (req, res) => {
  const { token } = req.query;
  const source = String(req.query.source || '').trim();
  if (!token) {
    return errorRes(res, 'INVALID_PARAM', '缺少 token 参数');
  }

  const payload = decryptLinkToken(token);
  if (!payload || !payload.taskId) {
    return errorRes(res, 'INVALID_TOKEN', '链接无效或已被篡改');
  }

  const task = taskDao.findById(payload.taskId, { includeDeleted: true });
  if (!task || taskDao.isTaskDeleted(task)) {
    return errorRes(res, 'TASK_NOT_FOUND', '任务不存在');
  }

  if (!taskDao.canUserAccessVisibleTask(task, req.user.id)) {
    return errorRes(res, 'FORBIDDEN', '无权限访问该任务');
  }

  if (source === 'share') {
    markShareReadonlyAccess(req.user.id, payload.taskId);
  }

  const teamId = task.team_id || payload.teamId || '';
  const landing = canOpenTeamLanding(req.user.id, teamId) ? 'team' : 'my-tasks';

  return success(res, { taskId: payload.taskId, teamId, landing });
});

module.exports = router;
