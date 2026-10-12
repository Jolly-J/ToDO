/**
 * 钉钉业务事件审计日志
 *
 * 复用 logger 统一写入 taskflow.log，不再维护独立的 dingtalk-business.log。
 * 调用方式不变：auditDingtalkEvent({ action, reqId, result, level, ...meta })
 */

const logger = require('./logger');

const LEVELS = new Set(['info', 'warn', 'error']);

function sanitizeMeta(meta = {}) {
  const sanitized = { ...meta };
  const sensitiveKeys = ['authCode', 'accessToken', 'token', 'secret', 'password'];
  for (const key of sensitiveKeys) {
    if (sanitized[key] !== undefined) sanitized[key] = '[REDACTED]';
  }
  return sanitized;
}

function auditDingtalkEvent(params) {
  const {
    action,
    reqId,
    result = 'success',
    level = result === 'failed' ? 'error' : 'info',
    durationMs,
    ...meta
  } = params || {};

  const safeLevel = LEVELS.has(level) ? level : 'info';

  logger[safeLevel]('钉钉业务事件', {
    action: action || 'unknown',
    result,
    reqId: reqId || null,
    ...(Number.isFinite(durationMs) ? { durationMs } : {}),
    ...sanitizeMeta(meta),
    channel: 'dingtalk-business',
  });
}

module.exports = { auditDingtalkEvent };
