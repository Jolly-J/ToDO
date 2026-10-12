/**
 * 请求用户解析工具
 *
 * 负责从请求对象中提取当前用户和数据范围参数。
 */
function resolveCurrentUserId(req) {
  return req.user?.id;
}

function resolveDataScope(req, fallback = 'self') {
  const requested = String(req.query?.scope || req.headers['x-data-scope'] || fallback).trim().toLowerCase();
  return requested === 'all' ? 'all' : 'self';
}

module.exports = {
  resolveCurrentUserId,
  resolveDataScope,
};
