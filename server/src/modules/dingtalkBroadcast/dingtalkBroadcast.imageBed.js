/** 宣传封面图片图床上传客户端。
 *
 * 服务端持图床 API Key，前端只上传文件到本服务，避免密钥泄露。
 * 目标图床：https://api.superbed.cn，使用 /api/v1/upload/ 接口（X-API-Key 认证）。
 */

const { createConfig } = require('../../config');
const logger = require('../../utils/logger');
const { createError } = require('../../utils/response');

/**
 * 上传单张图片到第三方图床
 * @param {{ buffer: Buffer, filename: string, contentType: string, reqId?: string }} params
 * @returns {Promise<{ url: string, filename: string, size: number }>}
 */
async function uploadImage({ buffer, filename, contentType, reqId }) {
  const config = createConfig();
  if (!config.imageBedApiKey) {
    throw createError('EXTERNAL_SERVICE_ERROR', 'IMAGE_BED_API_KEY 未配置，无法上传封面图片');
  }

  const formData = new FormData();
  formData.append(
    'files',
    new Blob([buffer], { type: contentType || 'application/octet-stream' }),
    filename,
  );

  let response;
  try {
    response = await fetch(config.imageBedApiUrl + '/api/v1/upload/', {
      method: 'POST',
      headers: { 'X-API-Key': config.imageBedApiKey },
      body: formData,
    });
  } catch (error) {
    logger.error('图床上传请求失败', {
      action: 'dingtalk.broadcast.image_upload',
      reqId,
      filename,
      error: error.message,
    });
    throw createError('EXTERNAL_SERVICE_ERROR', '图床上传失败，请稍后重试');
  }

  let data = null;
  try {
    data = await response.json();
  } catch (_error) {
    data = null;
  }

  const file = Array.isArray(data?.files) ? data.files[0] : null;
  if (!response.ok || data?.success !== true || !file?.url) {
    logger.error('图床返回上传失败', {
      action: 'dingtalk.broadcast.image_upload',
      reqId,
      filename,
      status: response.status,
    });
    throw createError('EXTERNAL_SERVICE_ERROR', '图床上传失败，请稍后重试');
  }

  logger.info('封面图片上传成功', {
    action: 'dingtalk.broadcast.image_upload',
    reqId,
    filename: file.filename || filename,
    url: file.url,
  });

  return {
    url: file.url,
    filename: file.filename || filename,
    size: Number(file.file_size) || buffer.length,
  };
}

module.exports = { uploadImage };
