/**
 * 附件下载路由
 *
 * 提供任务附件下载接口并设置安全的下载响应头。
 */
const express = require('express');
const attachmentDao = require('../modules/attachment/attachment.dao');
const { buildAttachmentContentDisposition } = require('../modules/attachment/attachment.filename');

const router = express.Router();

function resolveCurrentUserId(req) {
  return req.user?.id;
}

router.get('/:id/download', (req, res) => {
  const download = attachmentDao.resolveDownload(req.params.id, resolveCurrentUserId(req));

  if (!download) {
    return res.status(404).json({
      code: 40401,
      message: '附件不存在，可能被删除或您没有访问权限',
      data: null,
    });
  }

  res.setHeader('Content-Type', download.mime_type);
  res.setHeader('Content-Disposition', buildAttachmentContentDisposition(download.original_name));
  return res.status(200).sendFile(download.physical_path);
});

module.exports = router;
