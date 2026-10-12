/**
 * 评论写接口路由
 *
 * 处理评论修改和删除，并校验只读分享访问限制。
 */
const express = require('express');
const commentDao = require('../db/commentDao');
const { isShareReadonlyAccess } = require('../modules/notification/shareReadonlyRegistry');
const logger = require('../utils/logger');
const notificationEvents = require('../modules/notification/notification.events');
const taskDao = require('../db/taskDao');

const router = express.Router();

function canReadTaskComments(task, userId) {
  if (taskDao.isTaskDeleted(task)) {
    return task.deleted_by === userId;
  }

  return taskDao.isTaskRelatedOrAdmin(task, userId);
}

router.get('/:id/read-status', (req, res) => {
  const currentUserId = req.user?.id;
  const existingComment = commentDao.findById(req.params.id);
  if (!existingComment) {
    return res.status(404).json({
      code: 40401,
      message: '评论不存在',
      data: null,
    });
  }

  const task = taskDao.findById(existingComment.task_id, { includeDeleted: true });
  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '关联任务不存在',
      data: null,
    });
  }

  if (!canReadTaskComments(task, currentUserId)) {
    return res.status(403).json({
      code: 40003,
      message: '无权限访问该任务的评论',
      data: null,
    });
  }

  return res.json({
    code: 0,
    message: 'ok',
    data: commentDao.getReadStatus(req.params.id),
  });
});

router.patch('/:id', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = req.user?.id;
  const existingComment = commentDao.findById(req.params.id);
  if (!existingComment) {
    return res.status(404).json({
      code: 40401,
      message: '评论不存在',
      data: null,
    });
  }

  if (existingComment.user_id !== currentUserId) {
    return res.status(403).json({
      code: 40003,
      message: '只能修改自己的评论',
      data: null,
    });
  }

  if (isShareReadonlyAccess(currentUserId, existingComment.task_id)) {
    return res.status(403).json({
      code: 40303,
      message: '分享链接访问为只读模式，不允许修改任务',
      data: null,
    });
  }

  const comment = commentDao.update(req.params.id, {
    content: req.body.content,
  }, { currentUserId });

  logger.info('评论保存成功', {
    reqId: req.requestId,
    action: 'comment.update',
    commentId: req.params.id,
    operatorId: req.user?.id || null,
    durationMs: Date.now() - startedAt,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: comment,
  });
});

router.delete('/:id', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = req.user?.id;
  const existingComment = commentDao.findById(req.params.id);
  if (!existingComment) {
    return res.status(404).json({
      code: 40401,
      message: '评论不存在',
      data: null,
    });
  }

  if (existingComment.user_id !== currentUserId) {
    return res.status(403).json({
      code: 40003,
      message: '只能删除自己的评论',
      data: null,
    });
  }

  if (isShareReadonlyAccess(currentUserId, existingComment.task_id)) {
    return res.status(403).json({
      code: 40303,
      message: '分享链接访问为只读模式，不允许修改任务',
      data: null,
    });
  }

  const comment = commentDao.remove(req.params.id);

  logger.info('评论删除成功', {
    reqId: req.requestId,
    action: 'comment.delete',
    commentId: req.params.id,
    taskId: comment.task_id,
    operatorId: req.user?.id || null,
    durationMs: Date.now() - startedAt,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: null,
  });
});

router.put('/:id/audit', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = req.user?.id;
  const existingComment = commentDao.findById(req.params.id);

  if (!existingComment) {
    return res.status(404).json({ code: 40401, message: '留言不存在', data: null });
  }

  const task = taskDao.findById(existingComment.task_id);
  if (!task) {
    return res.status(404).json({ code: 40401, message: '关联任务不存在', data: null });
  }

  // 必须是创建人才能审核
  if (task.creator_id !== currentUserId) {
    return res.status(403).json({ code: 40003, message: '只能由任务创建人进行审核', data: null });
  }

  const { action } = req.body;
  if (action !== 'approve' && action !== 'reject') {
    return res.status(400).json({ code: 40000, message: '无效的操作', data: null });
  }

  const newStatus = action === 'approve' ? 'approved' : 'rejected';
  const updatedComment = commentDao.updateAuditStatus(existingComment.id, newStatus, { currentUserId });

  // 通知员工审核结果
  notificationEvents.emit('task.progress_audited', {
    bizType: 'task',
    bizId: task.id,
    actorId: currentUserId,
    data: {
      targetUserId: existingComment.user_id,
      title: task.title,
      status: newStatus,
    },
  });

  logger.info('评论审批成功', {
    reqId: req.requestId,
    action: 'comment.audit',
    commentId: req.params.id,
    auditStatus: newStatus,
    operatorId: currentUserId || null,
    durationMs: Date.now() - startedAt,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: updatedComment,
  });
});

module.exports = router;
