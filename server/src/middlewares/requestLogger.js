/**
 * 请求日志中间件
 *
 * 负责记录写操作请求、慢请求和异常响应的结构化日志。
 */
const logger = require('../utils/logger');

const SILENT_PATHS = new Set([
  '/api/logs/frontend',
  '/api/notifications/unread-count',
]);

function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }

  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function isExpectedAuthProbe(req, reqPath, statusCode) {
  return req.method === 'GET' && reqPath === '/api/auth/me' && statusCode === 401;
}

function createRequestLogger(options = {}) {
  const slowMs = Number.isFinite(options.slowMs) ? options.slowMs : 1200;
  const mutationMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

  return function requestLogger(req, res, next) {
    const startedAt = process.hrtime.bigint();
    const isMutation = mutationMethods.has(String(req.method || '').toUpperCase());
    const reqPath = req.originalUrl?.split('?')[0] || req.originalUrl;
    const isSilent = SILENT_PATHS.has(reqPath);

    if (isMutation && !isSilent) {
      const bodyKeys = req.body && typeof req.body === 'object' ? Object.keys(req.body) : [];
      logger.info('请求开始', {
        action: 'request.start',
        reqId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        bodyKeys,
        ip: resolveClientIp(req),
      });
    }

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const payload = {
        action: 'request.complete',
        reqId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Number(durationMs.toFixed(2)),
        ip: resolveClientIp(req),
      };

      if (res.statusCode >= 500) {
        logger.error('请求异常', {
          ...payload,
          action: 'request.error',
          result: 'failed',
        });
        return;
      }

      if (res.statusCode >= 400) {
        if (isExpectedAuthProbe(req, reqPath, res.statusCode)) {
          logger.debug('登录态探测未授权', {
            ...payload,
            action: 'request.auth_probe',
            result: 'expected',
          });
          return;
        }

        logger.warn('客户端错误', {
          ...payload,
          action: 'request.client_error',
          result: 'failed',
        });
        return;
      }

      if (durationMs >= slowMs) {
        logger.warn('慢请求', {
          ...payload,
          action: 'request.slow',
          slowThresholdMs: slowMs,
        });
        return;
      }

      // mutation 请求记录完成日志
      if (isMutation && !isSilent) {
        logger.info('请求完成', payload);
      }
    });

    next();
  };
}

module.exports = {
  createRequestLogger,
};
