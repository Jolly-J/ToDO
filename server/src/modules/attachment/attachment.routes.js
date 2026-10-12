/**
 * 附件路由 - 接入 multer 的真实上传与流式下载
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const { success } = require('../../utils/response');
const { createUploader, upload, validateUploadedFile } = require('../../middlewares/upload');
const attachmentDao = require('./attachment.dao');
const { commentAttachmentDao } = require('../../db/commentDao');
const notificationAggregation = require('../notification/notification.aggregation');
const { isShareReadonlyAccess } = require('../notification/shareReadonlyRegistry');
const fs = require('fs');
const path = require('path');
const { buildAttachmentContentDisposition } = require('./attachment.filename');
const taskDao = require('../../db/taskDao');

const router = Router();
const richTextImageUpload = createUploader({ dest: 'server/data/rich-text-images' });
const richTextImageRoot = path.resolve(__dirname, '../../../data/rich-text-images');
const allowedRichTextImageMimeTypes = new Set(['image/gif', 'image/jpeg', 'image/png', 'image/webp']);
const allowedRichTextImageExts = new Set(['.gif', '.jpeg', '.jpg', '.png', '.webp']);

router.use(auth);

function removeUploadedFile(file) {
  if (file?.path && fs.existsSync(file.path)) {
    try {
      fs.unlinkSync(file.path);
    } catch (_) {
      // 清理失败不影响向前端返回明确的业务错误。
    }
  }
}

function rejectIfShareReadonly(req, res, taskId) {
  if (isShareReadonlyAccess(req.user?.id, taskId)) {
    res.status(403).json({ code: 40303, message: '分享链接访问为只读模式，不允许修改任务' });
    return true;
  }
  return false;
}

function validateRichTextImage(file) {
  const basicValidationError = validateUploadedFile(file);
  if (basicValidationError) return basicValidationError;

  const ext = path.extname(file.originalname || file.filename || '').toLowerCase();
  if (!allowedRichTextImageMimeTypes.has(file.mimetype) || !allowedRichTextImageExts.has(ext)) {
    removeUploadedFile(file);
    const err = new Error('富文本图片仅支持 PNG、JPG、WEBP、GIF 格式');
    err.code = 'INVALID_IMAGE_TYPE';
    return err;
  }

  return null;
}

function buildRichTextImageUrl(filePath) {
  const relativePath = path.relative(richTextImageRoot, filePath).replace(/\\/g, '/');
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return null;
  }
  return `/uploads/rich-text-images/${relativePath}`;
}

/**
 * 任务附件预上传 (pending)：先上传拿到 ID，任务创建后再关联
 */
router.post('/task-attachments/pending', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ code: 40001, message: '请提供文件' });
  }

  const validationError = validateUploadedFile(req.file);
  if (validationError) {
    return res.status(400).json({ code: 40001, message: validationError.message });
  }

  const result = attachmentDao.createPending(req.file, req.user.id);
  const { physical_path, ...safeData } = result;
  return success(res, safeData, '上传成功');
});

/**
 * 附件上传 (10MB 限制，自动关联任务)
 */
router.post('/upload', upload.single('file'), (req, res) => {
  const { taskId } = req.body;
  if (taskId && rejectIfShareReadonly(req, res, taskId)) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return;
  }

  if (!req.file) {
    return res.status(400).json({ code: 40001, message: '请提供文件' });
  }

  // Magic Bytes 安全验证
  const validationError = validateUploadedFile(req.file);
  if (validationError) {
    return res.status(400).json({ code: 40001, message: validationError.message });
  }

  if (!taskId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ code: 40001, message: '必须提供关联的 taskId' });
  }

  const result = attachmentDao.createAttachment(req.file, taskId, req.user.id);

  // 给前端屏蔽物埋路径信息
  const { physical_path, ...safeData } = result;

  return success(res, safeData, '上传成功');
});

/**
 * 评论附件上传 (10MB 限制，暂不关联评论，保留物理文件)
 * 前端先上传附件获得 ID，提交评论时再关联
 */
router.post('/comment-attachments', upload.single('file'), (req, res) => {
  const { taskId } = req.body;
  if (taskId && rejectIfShareReadonly(req, res, taskId)) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    return;
  }

  if (!req.file) {
    return res.status(400).json({ code: 40001, message: '请提供文件' });
  }

  // Magic Bytes 安全验证
  const validationError = validateUploadedFile(req.file);
  if (validationError) {
    return res.status(400).json({ code: 40001, message: validationError.message });
  }

  if (!taskId) {
    fs.unlinkSync(req.file.path);
    return res.status(400).json({ code: 40001, message: '必须提供关联的 taskId' });
  }

  const result = commentAttachmentDao.createPending(req.file, taskId, req.user.id);

  // 保留物理文件，存储路径到数据库（修复评论附件无法下载问题）
  const { physical_path, ...safeData } = result;

  return success(res, safeData, '上传成功');
});

/**
 * 富文本内联图片上传
 *
 * 图片保存在项目目录 server/data/rich-text-images，并返回可写入 Markdown 的项目相对 URL。
 */
router.post('/rich-text-images', richTextImageUpload.single('file'), (req, res) => {
  const { taskId } = req.body;
  if (taskId && rejectIfShareReadonly(req, res, taskId)) {
    removeUploadedFile(req.file);
    return;
  }

  if (!req.file) {
    return res.status(400).json({ code: 40001, message: '请提供图片文件' });
  }

  const validationError = validateRichTextImage(req.file);
  if (validationError) {
    return res.status(400).json({ code: 40001, message: validationError.message });
  }

  if (!taskId) {
    removeUploadedFile(req.file);
    return res.status(400).json({ code: 40001, message: '必须提供关联的 taskId' });
  }

  const task = taskDao.findById(taskId, { includeDeleted: true });
  if (!task || taskDao.isTaskDeleted(task)) {
    removeUploadedFile(req.file);
    return res.status(404).json({ code: 40401, message: '任务不存在', data: null });
  }

  if (!taskDao.isTaskRelatedOrAdmin(task, req.user.id)) {
    removeUploadedFile(req.file);
    return res.status(403).json({ code: 40003, message: '无权限上传该任务的富文本图片', data: null });
  }

  const url = buildRichTextImageUrl(req.file.path);
  if (!url) {
    removeUploadedFile(req.file);
    return res.status(500).json({ code: 50001, message: '图片路径生成失败', data: null });
  }

  return success(res, {
    url,
    filename: req.file.filename,
    original_name: req.file.originalname,
    file_size: req.file.size,
    mime_type: req.file.mimetype,
  }, '上传成功');
});

/**
 * 评论附件下载
 */
router.get('/comment-attachments/:id/download', (req, res) => {
  const attachment = commentAttachmentDao.resolveDownload(req.params.id, req.user.id);

  if (!attachment) {
    return res.status(404).json({ code: 40401, message: '附件不存在或无权限' });
  }

  res.setHeader('Content-Type', attachment.mime_type);
  res.setHeader('Content-Disposition', buildAttachmentContentDisposition(attachment.original_name));

  const stream = fs.createReadStream(attachment.physical_path);
  stream.pipe(res);
});

/**
 * 下载附件
 */
router.get('/:id/download', (req, res) => {
  const attachment = attachmentDao.resolveDownload(req.params.id, req.user.id);

  if (!attachment) {
    return res.status(404).json({ code: 40401, message: '附件不存在或无权限' });
  }

  res.setHeader('Content-Type', attachment.mime_type);
  res.setHeader('Content-Disposition', buildAttachmentContentDisposition(attachment.original_name));
  
  const stream = fs.createReadStream(attachment.physical_path);
  stream.pipe(res);
});

/**
 * 删除附件
 */
router.delete('/:id', (req, res) => {
  const attachment = attachmentDao.findAttachmentById(req.params.id) || commentAttachmentDao.findById(req.params.id);
  if (attachment?.task_id && rejectIfShareReadonly(req, res, attachment.task_id)) {
    return;
  }

  try {
    const deletedAttachment = attachmentDao.deleteAttachment(req.params.id, req.user.id);
    notificationAggregation.enqueueTaskChanges({
      taskId: deletedAttachment.task_id,
      actorId: req.user.id,
      changeItems: [{ type: 'attachment_change' }],
    });
    return success(res, null, '附件已删除');
  } catch (err) {
    return res.status(403).json({ code: 40301, message: err.message });
  }
});

module.exports = router;
