/** 管理后台钉钉宣传推送接口。 */

const path = require('node:path');
const { Router } = require('express');
const multer = require('multer');
const { normalizeUploadedOriginalName } = require('../attachment/attachment.filename');
const { success, createError } = require('../../utils/response');
const broadcastDao = require('./dingtalkBroadcast.dao');
const broadcastService = require('./dingtalkBroadcast.service');
const imageBed = require('./dingtalkBroadcast.imageBed');

const broadcastStorage = require('./dingtalkBroadcast.storage');

const router = Router();
const MAX_PACKAGE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp']);
const ALLOWED_PACKAGE_EXTENSIONS = new Set(['.html', '.htm', '.zip']);

const packageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PACKAGE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    file.originalname = normalizeUploadedOriginalName(file.originalname);
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_PACKAGE_EXTENSIONS.has(extension)) {
      const error = new Error('支持上传 .zip 压缩包或 .html 网页文件');
      error.status = 400;
      error.code = 40002;
      callback(error, false);
      return;
    }
    callback(null, true);
  },
});

function uploadSinglePackage(req, res, next) {
  packageUpload.single('file')(req, res, (uploadError) => {
    if (!uploadError) {
      next();
      return;
    }
    const isFileTooLarge = uploadError.code === 'LIMIT_FILE_SIZE';
    uploadError.status = 400;
    uploadError.code = 40002;
    if (isFileTooLarge) {
      uploadError.message = '页面压缩包不能超过50MB';
    }
    next(uploadError);
  });
}

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    const extension = path.extname(file.originalname).toLowerCase();
    if (!ALLOWED_IMAGE_EXTENSIONS.has(extension)) {
      const error = new Error('封面图片只支持 png/jpg/jpeg/gif/webp 格式');
      error.status = 400;
      error.code = 40002;
      callback(error, false);
      return;
    }
    callback(null, true);
  },
});

function uploadSingleImage(req, res, next) {
  imageUpload.single('file')(req, res, (uploadError) => {
    if (!uploadError) {
      next();
      return;
    }
    const isFileTooLarge = uploadError.code === 'LIMIT_FILE_SIZE';
    uploadError.status = 400;
    uploadError.code = 40002;
    if (isFileTooLarge) {
      uploadError.message = '封面图片不能超过5MB';
    }
    next(uploadError);
  });
}

router.get('/summary', (_req, res) => {
  return success(res, broadcastService.getPushSummary());
});

router.get('/records', (req, res) => {
  return success(res, broadcastService.getRecordFeed({
    page: Number(req.query.page) || 1,
    pageSize: Number(req.query.pageSize) || 20,
  }));
});

router.post('/records/:id/recall', (req, res) => {
  const result = broadcastService.requestRecall({
    recordId: req.params.id,
    operatorId: req.user.id,
    reqId: req.requestId,
  });
  return success(res, result, '撤回任务已提交');
});

router.post('/records/:id/retry-failures', (req, res) => {
  const result = broadcastService.retryFailures({
    recordId: req.params.id,
    idempotencyKey: req.body?.idempotencyKey,
    operatorId: req.user.id,
    reqId: req.requestId,
  });
  return success(res, result, '限流人员补发任务已提交');
});

router.post('/image', uploadSingleImage, async (req, res) => {
  if (!req.file?.buffer) {
    const error = new Error('请选择图片文件');
    error.status = 400;
    error.code = 40001;
    throw error;
  }

  const result = await imageBed.uploadImage({
    buffer: req.file.buffer,
    filename: req.file.originalname,
    contentType: req.file.mimetype,
    reqId: req.requestId,
  });
  return success(res, result, '封面图片上传成功');
});

router.post('/html', uploadSinglePackage, async (req, res) => {
  if (!req.file?.buffer) {
    const error = new Error('请选择页面压缩包 (.zip) 或 HTML 文件');
    error.status = 400;
    error.code = 40001;
    throw error;
  }

  const isZip = path.extname(req.file.originalname).toLowerCase() === '.zip';

  // 1. 获取或创建草稿广播记录以确定 broadcastId
  let draft = null;
  let createdDraft = false;
  if (req.body?.broadcastId) {
    try {
      draft = broadcastDao.getEditableActionDraft(String(req.body.broadcastId));
    } catch (error) {
      if (error.code === 'BROADCAST_ALREADY_SUBMITTED') {
        throw createError('DUPLICATE', error.message);
      }
      throw error;
    }
    if (!draft) throw createError('NOT_FOUND', '宣传页草稿不存在，请重新导入');
  } else {
    draft = broadcastDao.createActionDraft({
      htmlContent: '',
      originalName: req.file.originalname,
      htmlSize: req.file.size,
      createdBy: req.user.id,
    });
    createdDraft = true;
  }

  let prepared;
  let updatedDraft;
  try {
    prepared = isZip
      ? await broadcastStorage.prepareZipPackage(draft.id, req.file.buffer)
      : await broadcastStorage.prepareSingleHtml(draft.id, req.file.buffer);
    updatedDraft = broadcastStorage.commitPreparedPackage(draft.id, prepared, () => (
      broadcastDao.replaceActionHtml(draft.id, {
        htmlContent: prepared.htmlContent,
        originalName: req.file.originalname,
        htmlSize: req.file.size,
      })
    ));
  } catch (error) {
    if (createdDraft) broadcastDao.deleteEmptyDraft(draft.id);
    throw error;
  }

  return success(res, {
    broadcastId: updatedDraft.id,
    originalName: updatedDraft.html_original_name,
    htmlSize: updatedDraft.html_size,
    previewUrl: `/p/${updatedDraft.public_token}`,
  }, isZip ? '宣传页面包导入成功（已解压并托管图片和视频）' : 'HTML导入成功');
});

router.post('/test', async (req, res) => {
  const result = await broadcastService.sendTest({
    payload: req.body,
    operatorId: req.user.id,
    reqId: req.requestId,
  });
  return success(res, result, '测试推送已加入发送队列');
});

router.post('/all', async (req, res) => {
  const result = await broadcastService.sendAll({
    payload: req.body,
    operatorId: req.user.id,
    reqId: req.requestId,
  });
  return success(res, result, '全员推送已加入发送队列');
});

module.exports = router;
