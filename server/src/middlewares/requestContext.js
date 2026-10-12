/**
 * 请求上下文中间件
 *
 * 负责为每个请求注入并回传统一的 `x-request-id`。
 */
const { randomUUID } = require('node:crypto');

function requestContext(req, res, next) {
  const headerId = String(req.headers['x-request-id'] || '').trim();
  const reqId = headerId || randomUUID();

  req.requestId = reqId;
  res.setHeader('x-request-id', reqId);
  next();
}

module.exports = {
  requestContext,
};
