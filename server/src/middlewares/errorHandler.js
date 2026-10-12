/**
 * 全局错误处理中间件
 *
 * 统一返回 { code, data, message } 结构
 * 兼容 response.createError 抛出的业务异常
 */

const logger = require('../utils/logger');

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  const status = Number.isInteger(err?.status) ? err.status : 500;
  const code = Number.isInteger(err?.code) ? err.code : status;

  // 生产环境下隐藏 500 错误的内部信息
  const message =
    status >= 500 && process.env.NODE_ENV === 'production'
      ? '服务器内部错误'
      : err?.message || '服务器内部错误';

  logger.error('请求处理异常', {
    reqId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    code,
    error: err?.message || 'unknown',
  });

  return res.status(status).json({
    code,
    data: null,
    message,
  });
}

module.exports = {
  errorHandler,
};
