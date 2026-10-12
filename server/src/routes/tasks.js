/**
 * 任务路由模块
 *
 * 负责注册任务创建、编辑、分享、评论和附件等核心接口。
 */
const express = require('express');
const fs = require('node:fs');
const taskDao = require('../db/taskDao');
const commentDao = require('../db/commentDao');
const { upload } = require('../middlewares/upload');
const attachmentDao = require('../modules/attachment/attachment.dao');
const notificationAggregation = require('../modules/notification/notification.aggregation');
const notificationEvents = require('../modules/notification/notification.events');
const permissionCache = require('../services/permissionCache');
const { encryptLinkToken } = require('../utils/linkCrypto');
const { buildTaskNotificationUrl } = require('../modules/notification/notification.links');
const { isShareReadonlyAccess } = require('../modules/notification/shareReadonlyRegistry');
const logger = require('../utils/logger');
const { nowIso } = require('../utils/datetime');

const router = express.Router();
const ALLOWED_COMMENT_MESSAGE_TYPES = new Set(['message', 'progress']);

function resolveCurrentUserId(req) {
  return req.user?.id;
}

function removeUploadedFiles(files) {
  for (const file of files) {
    try {
      if (file?.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
    } catch (_err) {
      // 删除临时文件失败不应影响主流程响应。
    }
  }
}

function toPublicAttachment(attachment) {
  const { physical_path, ...safeAttachment } = attachment || {};
  return safeAttachment;
}

function canManageTeamTasks(userId, teamId) {
  if (!userId || !teamId) {
    return false;
  }
  if (permissionCache.isSuperAdmin(userId)) {
    return true;
  }
  return permissionCache.hasTeamPermission(userId, teamId, 'team:task:edit_all');
}

function rejectIfShareReadonly(req, res, taskId) {
  const currentUserId = resolveCurrentUserId(req);
  if (isShareReadonlyAccess(currentUserId, taskId)) {
    res.status(403).json({
      code: 40303,
      message: '分享链接访问为只读模式，不允许修改任务',
      data: null,
    });
    return true;
  }
  return false;
}

function rejectIfTaskCanceled(res, task, message) {
  if (task?.status !== 'canceled') {
    return false;
  }

  res.status(409).json({
    code: 40901,
    message,
    data: null,
  });
  return true;
}

function canReadTaskComments(task, userId) {
  if (taskDao.isTaskDeleted(task)) {
    return task.deleted_by === userId;
  }

  return taskDao.isTaskRelatedOrAdmin(task, userId);
}

router.post('/', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  const rawTeamId = req.body.team_id;
  const teamId = rawTeamId && String(rawTeamId).trim() ? String(rawTeamId).trim() : null;
  const rawParentId = req.body.parent_id;
  const parentId = rawParentId && String(rawParentId).trim() ? String(rawParentId).trim() : null;
  const taskScope = req.body.task_scope || (req.body.is_personal ? 'personal' : (teamId ? 'team' : undefined));

  let effectiveTeamId = taskScope === 'personal' ? null : teamId;
  if (parentId) {
    const parentTask = taskDao.findById(parentId);
    if (!parentTask) {
      return res.status(404).json({
        code: 40004,
        message: '父级任务不存在',
        data: null,
      });
    }
    if (taskScope !== 'personal' && !effectiveTeamId && parentTask.team_id) {
      effectiveTeamId = parentTask.team_id;
    }
  }

  if (effectiveTeamId && !canManageTeamTasks(currentUserId, effectiveTeamId)) {
    return res.status(403).json({
      code: 40003,
      message: '仅团队创建者或管理员可创建任务',
      data: null,
    });
  }

  const task = taskDao.upsert({
    id: `task-${Date.now()}`,
    title: req.body.title || '',
    description: req.body.description || '',
    status: req.body.status || 'in_progress',
    priority: req.body.priority || 'medium',
    team_id: effectiveTeamId,
    parent_id: parentId,
    creator_id: currentUserId,
    assignee_id: req.body.assignee_id || '',
    participant_ids: req.body.participant_ids || [],
    start_date: req.body.start_date || null,
    due_date: req.body.due_date || null,
    reminder_rule: req.body.reminder_rule || null,
    periodic_interval_days: req.body.periodic_interval_days || null,
    periodic_time: req.body.periodic_time || null,
    sort_order: req.body.sort_order || 1,
    is_deleted: false,
    deleted_at: null,
    deleted_by: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  });

  const attachmentIds = Array.isArray(req.body.attachment_ids) ? req.body.attachment_ids : [];
  if (attachmentIds.length > 0) {
    attachmentDao.attachToTask(attachmentIds, task.id, currentUserId);
  }

  logger.info('任务保存成功', {
    reqId: req.requestId,
    action: 'task.create',
    taskId: task.id,
    operatorId: currentUserId,
    durationMs: Date.now() - startedAt,
  });

  return res.status(201).json({
    code: 0,
    message: 'ok',
    data: task,
  });
});

router.get('/trash', (req, res) => {
  const tasks = taskDao.listDeletedBy(resolveCurrentUserId(req), {
    keyword: req.query.keyword,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: {
      list: tasks,
      total: tasks.length,
      page: 1,
      pageSize: 20,
    },
  });
});

router.get('/trash/:id', (req, res) => {
  const task = taskDao.findTrashDetail(req.params.id, resolveCurrentUserId(req));

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  return res.json({
    code: 0,
    message: 'ok',
    data: task,
  });
});

router.patch('/trash/:id/restore', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  if (rejectIfShareReadonly(req, res, req.params.id)) {
    return;
  }
  const task = taskDao.restore(req.params.id, currentUserId);

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  logger.info('任务恢复成功', {
    reqId: req.requestId,
    action: 'task.restore',
    taskId: req.params.id,
    operatorId: currentUserId,
    durationMs: Date.now() - startedAt,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: task,
  });
});

router.get('/:id/share-link', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  const taskId = req.params.id;
  console.log('[share-link] 收到请求', { taskId, currentUserId });

  try {
    const task = taskDao.findById(taskId, { enrich: true });

    if (!task || taskDao.isTaskDeleted(task)) {
      return res.status(404).json({
        code: 40401,
        message: '任务不存在',
        data: null,
      });
    }

    if (!taskDao.canUserAccessVisibleTask(task, currentUserId)) {
      return res.status(403).json({
        code: 40003,
        message: '没有权限分享该任务',
        data: null,
      });
    }

    const token = encryptLinkToken({ taskId, teamId: task.team_id });
    const url = buildTaskNotificationUrl({ token, source: 'share', channel: 'dingtalk-jsapi' });

    if (!url) {
      logger.error('生成分享链接失败：appBaseUrl 未配置', {
        reqId: req.requestId,
        action: 'task.share_link',
        taskId,
        operatorId: currentUserId,
      });
      return res.status(500).json({
        code: 50001,
        message: '分享链接生成失败，请检查服务配置',
        data: null,
      });
    }

    const parts = [];
    if (task.assignee_name) parts.push(`负责人：${task.assignee_name}`);
    if (task.due_date) parts.push(`截止：${task.due_date}`);
    const content = parts.length ? parts.join(' · ') : '点击查看任务详情';

    logger.info('生成任务分享链接', {
      reqId: req.requestId,
      action: 'task.share_link',
      taskId,
      operatorId: currentUserId,
      durationMs: Date.now() - startedAt,
    });

    return res.json({
      code: 0,
      message: 'ok',
      data: {
        url,
        title: task.title,
        content,
      },
    });
  } catch (error) {
    logger.error('生成分享链接异常', {
      reqId: req.requestId,
      action: 'task.share_link',
      taskId,
      operatorId: currentUserId,
      error: error instanceof Error ? error.message : '未知错误',
    });
    return res.status(500).json({
      code: 50001,
      message: error instanceof Error ? error.message : '生成分享链接失败',
      data: null,
    });
  }
});

router.post('/:id/share', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  const receiverIds = req.body?.receiverIds || [];

  try {
    const result = taskDao.shareTask(req.params.id, currentUserId, receiverIds);

    if (!result) {
      return res.status(404).json({
        code: 40401,
        message: '任务不存在',
        data: null,
      });
    }

    logger.info('任务分享成功', {
      reqId: req.requestId,
      action: 'task.share',
      taskId: req.params.id,
      operatorId: currentUserId,
      receiverCount: receiverIds.length,
      durationMs: Date.now() - startedAt,
    });

    return res.json({
      code: 0,
      message: 'ok',
      data: result,
    });
  } catch (error) {
    const status = error && error.code === 'FORBIDDEN' ? 403 : 400;

    logger.error('任务分享失败', {
      reqId: req.requestId,
      action: 'task.share',
      taskId: req.params.id,
      operatorId: currentUserId,
      error: error instanceof Error ? error.message : '分享任务失败',
    });

    return res.status(status).json({
      code: status === 403 ? 40003 : 40101,
      message: error instanceof Error ? error.message : '分享任务失败',
      data: null,
    });
  }
});

router.get('/:id', (req, res) => {
  const currentUserId = resolveCurrentUserId(req);
  const existedTask = taskDao.findById(req.params.id, { includeDeleted: true });

  if (!existedTask) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  // 基础可见性检查 (只要在团队里就能看)
  if (!taskDao.canUserAccessVisibleTask(existedTask, currentUserId)) {
    return res.status(403).json({
      code: 40003,
      message: '无权限访问该任务',
      data: null,
    });
  }

  // 敏感信息检查 (只有相关人/管理员能看附件)
  const isRelatedOrAdmin = taskDao.isTaskRelatedOrAdmin(existedTask, currentUserId);

  const task = taskDao.findById(req.params.id, {
    enrich: true,
    includeAttachments: isRelatedOrAdmin, // 非相关人员不给附件
    includeSubtasks: true, // 包含直接子任务列表与统计
    userId: currentUserId,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: task,
  });
});

router.get('/:id/subtasks', (req, res) => {
  const currentUserId = resolveCurrentUserId(req);
  const existedTask = taskDao.findById(req.params.id);
  if (!existedTask) {
    return res.status(404).json({ code: 40401, message: '任务不存在', data: null });
  }
  if (!taskDao.canUserAccessVisibleTask(existedTask, currentUserId)) {
    return res.status(403).json({ code: 40003, message: '无权限访问该任务', data: null });
  }

  const subtasks = taskDao.listSubtasks(req.params.id, { userId: currentUserId });
  const stats = taskDao.getSubtaskStats(req.params.id);
  return res.json({
    code: 0,
    message: 'ok',
    data: {
      list: subtasks,
      ...stats,
    },
  });
});

router.get('/:id/breadcrumbs', (req, res) => {
  const currentUserId = resolveCurrentUserId(req);
  const existedTask = taskDao.findById(req.params.id);
  if (!existedTask) {
    return res.status(404).json({ code: 40401, message: '任务不存在', data: null });
  }
  if (!taskDao.canUserAccessVisibleTask(existedTask, currentUserId)) {
    return res.status(403).json({ code: 40003, message: '无权限访问该任务', data: null });
  }

  const breadcrumbs = taskDao.getTaskBreadcrumbs(req.params.id);
  return res.json({
    code: 0,
    message: 'ok',
    data: breadcrumbs,
  });
});

router.patch('/:id', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = req.user.id;
  if (rejectIfShareReadonly(req, res, req.params.id)) {
    return;
  }
  const existedTask = taskDao.findById(req.params.id, { includeDeleted: true });

  if (!existedTask) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  if (!taskDao.canUserAccessVisibleTask(existedTask, currentUserId)) {
    return res.status(403).json({
      code: 40003,
      message: '无权限操作该任务',
      data: null,
    });
  }

  const isOwnerOrAdmin = existedTask.team_id
    ? canManageTeamTasks(currentUserId, existedTask.team_id)
    : (existedTask.creator_id === currentUserId || permissionCache.isSuperAdmin(currentUserId));
  const isAssignee = existedTask.assignee_id === currentUserId;

  if (!isOwnerOrAdmin && !isAssignee) {
    return res.status(403).json({
      code: 40003,
      message: '无权操作该任务',
      data: null,
    });
  }

  if (!isOwnerOrAdmin && isAssignee) {
    const allowedFields = ['description', 'participant_ids', 'status', 'sort_order'];
    const requestBody = req.body || {};
    const requestedFields = Object.keys(requestBody);
    const illegalFields = requestedFields.filter(f => !allowedFields.includes(f));
    
    if (illegalFields.length > 0) {
      return res.status(403).json({
        code: 40003,
        message: `负责人无权修改以下字段: ${illegalFields.join(', ')}`,
        data: null,
      });
    }
  }

  if (req.body && req.body.team_id !== undefined) {
    const targetTeamId = req.body.team_id && String(req.body.team_id).trim() ? String(req.body.team_id).trim() : null;
    if (targetTeamId && !canManageTeamTasks(currentUserId, targetTeamId)) {
      return res.status(403).json({
        code: 40003,
        message: '无权将任务转入该团队',
        data: null,
      });
    }
  }

  const task = taskDao.update(req.params.id, req.body || {}, req.user.id);

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  logger.info('任务保存成功', {
    reqId: req.requestId,
    action: 'task.update',
    taskId: req.params.id,
    operatorId: req.user.id,
    durationMs: Date.now() - startedAt,
    fields: req.body && typeof req.body === 'object' ? Object.keys(req.body) : [],
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: task,
  });
});

router.patch('/:id/status', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = req.user.id;
  if (rejectIfShareReadonly(req, res, req.params.id)) {
    return;
  }
  const existedTask = taskDao.findById(req.params.id, { includeDeleted: true });

  if (!existedTask) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  if (!taskDao.canUserAccessVisibleTask(existedTask, currentUserId)) {
    return res.status(403).json({
      code: 40003,
      message: '无权限操作该任务',
      data: null,
    });
  }

  const isOwnerOrAdmin = canManageTeamTasks(currentUserId, existedTask.team_id);
  const isAssignee = existedTask.assignee_id === currentUserId;

  if (!isOwnerOrAdmin && !isAssignee) {
    return res.status(403).json({
      code: 40003,
      message: '无权操作该任务',
      data: null,
    });
  }

  const task = taskDao.updateStatus(req.params.id, req.body?.status, req.body?.sort_order, req.user.id);

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  logger.info('任务保存成功', {
    reqId: req.requestId,
    action: 'task.update_status',
    taskId: req.params.id,
    operatorId: req.user.id,
    durationMs: Date.now() - startedAt,
    status: req.body?.status,
    sort_order: req.body?.sort_order,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: task,
  });
});


router.post('/:taskId/attachments', upload.array('files', 5), (req, res) => {
  const currentUserId = resolveCurrentUserId(req);
  const taskId = req.params.taskId;
  if (rejectIfShareReadonly(req, res, taskId)) {
    removeUploadedFiles(Array.isArray(req.files) ? req.files : []);
    return;
  }
  const files = Array.isArray(req.files) ? req.files : [];

  if (!files.length) {
    return res.status(400).json({
      code: 40001,
      message: '请至少上传一个附件',
      data: null,
    });
  }

  const task = taskDao.findById(taskId, { includeDeleted: true });

  if (!task) {
    removeUploadedFiles(files);
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  const canAccessDeletedTask = taskDao.isTaskDeleted(task) && task.deleted_by === currentUserId;
  const canAccessVisibleTask = !taskDao.isTaskDeleted(task) && taskDao.canUserAccessVisibleTask(task, currentUserId);

  if (!canAccessDeletedTask && !canAccessVisibleTask) {
    removeUploadedFiles(files);
    return res.status(403).json({
      code: 40003,
      message: '无权限操作该任务附件',
      data: null,
    });
  }

  if (rejectIfTaskCanceled(res, task, '已取消任务不允许上传附件')) {
    removeUploadedFiles(files);
    return;
  }

  const attachments = files.map((file) =>
    toPublicAttachment(attachmentDao.createAttachment(file, taskId, currentUserId))
  );
  const attachmentCount = attachmentDao.countByTaskId(taskId);
  notificationAggregation.enqueueTaskChanges({
    taskId,
    actorId: currentUserId,
    changeItems: [{ type: 'attachment_change' }],
  });

  logger.info('附件上传成功', {
    reqId: req.requestId,
    action: 'attachment.upload',
    taskId,
    operatorId: currentUserId,
    fileCount: files.length,
  });

  return res.status(201).json({
    code: 0,
    message: 'ok',
    data: {
      attachments,
      attachment_count: attachmentCount,
    },
  });
});

router.delete('/:id', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  if (rejectIfShareReadonly(req, res, req.params.id)) {
    return;
  }
  const existedTask = taskDao.findById(req.params.id, { includeDeleted: true });

  if (!existedTask) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  if (!taskDao.canUserAccessVisibleTask(existedTask, currentUserId)) {
    return res.status(403).json({
      code: 40003,
      message: '无权限操作该任务',
      data: null,
    });
  }

  const canDelete = existedTask.team_id
    ? canManageTeamTasks(currentUserId, existedTask.team_id)
    : (existedTask.creator_id === currentUserId || permissionCache.isSuperAdmin(currentUserId));

  if (!canDelete) {
    return res.status(403).json({
      code: 40003,
      message: existedTask.team_id ? '仅团队创建者或管理员可管理任务' : '仅个人任务创建者可删除任务',
      data: null,
    });
  }

  const task = taskDao.softDelete(req.params.id, currentUserId);

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  logger.info('任务删除成功', {
    reqId: req.requestId,
    action: 'task.delete',
    taskId: req.params.id,
    operatorId: currentUserId,
    durationMs: Date.now() - startedAt,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: null,
  });
});

router.get('/:taskId/comments', (req, res) => {
  const currentUserId = resolveCurrentUserId(req);
  const task = taskDao.findById(req.params.taskId, { includeDeleted: true });

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  if (!canReadTaskComments(task, currentUserId)) {
    if (taskDao.isTaskDeleted(task)) {
      return res.status(403).json({
        code: 40003,
        message: '无权限访问该任务的评论',
        data: null,
      });
    }

    // 方案 B：非相关人员不可查看评论 (返回 200 + restricted 标志，避免前端全局 Toast 报错)
    return res.json({
      code: 0,
      message: 'restricted',
      data: [],
    });
  }

  return res.json({
    code: 0,
    message: 'ok',
    data: commentDao.listByTaskId(req.params.taskId, { currentUserId }),
  });
});

router.post('/:taskId/comments/read', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  const task = taskDao.findById(req.params.taskId, { includeDeleted: true });

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
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

  const commentIds = Array.isArray(req.body?.comment_ids) ? req.body.comment_ids : [];
  if (commentIds.length === 0) {
    return res.status(400).json({
      code: 40001,
      message: '缺少评论 ID',
      data: null,
    });
  }

  const result = commentDao.markByTaskId(req.params.taskId, commentIds, currentUserId);

  logger.info('评论已读标记成功', {
    reqId: req.requestId,
    action: 'comment.read.mark',
    taskId: req.params.taskId,
    operatorId: currentUserId,
    commentCount: commentIds.length,
    updated: result.updated,
    durationMs: Date.now() - startedAt,
  });

  return res.json({
    code: 0,
    message: 'ok',
    data: result,
  });
});

router.post('/:taskId/comments', (req, res) => {
  const startedAt = Date.now();
  const currentUserId = resolveCurrentUserId(req);
  const task = taskDao.findById(req.params.taskId);

  if (!task) {
    return res.status(404).json({
      code: 40401,
      message: '任务不存在',
      data: null,
    });
  }

  if (!taskDao.isTaskRelatedOrAdmin(task, currentUserId)) {
    // 方案 B：非相关人员不可发表评论
    return res.status(403).json({
      code: 40003,
      message: '无权限在该任务发表评论',
      data: null,
    });
  }

  if (rejectIfTaskCanceled(res, task, '已取消任务不允许新增评论')) {
    return;
  }

  if (rejectIfShareReadonly(req, res, req.params.taskId)) {
    return;
  }
  const requestId = String(req.headers['x-idempotency-key'] || req.headers['x-request-id'] || '').trim() || null;
  const rawMessageType = typeof req.body?.message_type === 'string' ? req.body.message_type.trim() : '';
  const messageType = rawMessageType || 'message';
  const mentionedUserIds = commentDao.normalizeUserIds(req.body?.mentioned_user_ids, currentUserId);
  const existingComment = commentDao.findByRequestKey(req.params.taskId, currentUserId, requestId, { currentUserId });

  if (existingComment) {
    return res.json({
      code: 0,
      message: 'ok',
      data: existingComment,
    });
  }

  if (!ALLOWED_COMMENT_MESSAGE_TYPES.has(messageType)) {
    return res.status(400).json({
      code: 40001,
      message: '评论类型不合法',
      data: null,
    });
  }

  if (mentionedUserIds.length > 0 && task.team_id) {
    const mentionableUserIds = commentDao.listMentionableUserIds(task.team_id, mentionedUserIds);
    if (mentionableUserIds.length !== mentionedUserIds.length) {
      return res.status(400).json({
        code: 40001,
        message: '被 @ 人必须是任务所在团队成员',
        data: null,
      });
    }
  }

  if (mentionedUserIds.length > 0) {

    const taskRelatedUserIds = new Set([
      task.creator_id,
      task.assignee_id,
      ...taskDao.uniqueIds(task.participant_ids),
    ].filter(Boolean));
    const mentionsTaskExternalUser = mentionedUserIds.some((userId) => !taskRelatedUserIds.has(userId));

    if (mentionsTaskExternalUser && !taskDao.canMentionTaskExternalMember(task, currentUserId)) {
      return res.status(403).json({
        code: 40003,
        message: '无权限 @ 任务外成员并加入协作',
        data: null,
      });
    }
  }

  const attachmentIds = req.body.attachment_ids || [];
  const comment = commentDao.create({
    id: `comment-${Date.now()}`,
    task_id: req.params.taskId,
    user_id: currentUserId,
    content: req.body.content || '',
    message_type: messageType,
    parent_id: req.body.parent_id ?? null,
    request_id: requestId,
    created_at: nowIso(),
    updated_at: nowIso(),
    deleted_at: null,
  }, attachmentIds, { currentUserId, mentionedUserIds });

  const eventType = messageType === 'progress' ? 'task.progress_commented' : 'task.commented';
  const autoAddedMentionUserIds = (comment.mentioned_users || [])
    .filter((mentionedUser) => mentionedUser.auto_added_to_task)
    .map((mentionedUser) => mentionedUser.id);

  if (mentionedUserIds.length > 0) {
    notificationEvents.emit('task.comment_mentioned', {
      bizType: 'task',
      bizId: req.params.taskId,
      actorId: currentUserId,
      reqId: req.requestId,
      data: {
        title: task.title,
        actorName: req.user?.name || '',
        commentSnippet: (comment.content || '').slice(0, 100),
        mentionedUserIds,
        autoAddedMentionUserIds,
        isProgressComment: messageType === 'progress',
      },
    });
  }

  notificationEvents.emit(eventType, {
    bizType: 'task',
    bizId: req.params.taskId,
    actorId: currentUserId,
    reqId: req.requestId,
    data: {
      title: task.title,
      actorName: req.user?.name || '',
      commentSnippet: (comment.content || '').slice(0, 100),
      mentionedUserIds,
    },
  });

  logger.info('评论保存成功', {
    reqId: req.requestId,
    action: 'comment.create',
    taskId: req.params.taskId,
    commentId: comment.id,
    operatorId: currentUserId,
    durationMs: Date.now() - startedAt,
    attachmentCount: attachmentIds.length,
    messageType,
  });

  return res.status(201).json({
    code: 0,
    message: 'ok',
    data: comment,
  });
});

module.exports = router;
