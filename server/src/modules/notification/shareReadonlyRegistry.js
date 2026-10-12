/**
 * 分享只读访问注册表
 *
 * 负责记录分享链接触发的只读访问状态及其过期时间。
 */
const DEFAULT_TTL_MS = 30 * 60 * 1000;

const registry = new Map();

function buildKey(userId, taskId) {
  return `${String(userId || '').trim()}::${String(taskId || '').trim()}`;
}

function markShareReadonlyAccess(userId, taskId, ttlMs = DEFAULT_TTL_MS) {
  const key = buildKey(userId, taskId);
  if (!key || key === '::') {
    return;
  }

  const expiresAt = Date.now() + Math.max(Number(ttlMs) || DEFAULT_TTL_MS, 60 * 1000);
  registry.set(key, expiresAt);
}

function isShareReadonlyAccess(userId, taskId) {
  const key = buildKey(userId, taskId);
  const expiresAt = registry.get(key);
  if (!expiresAt) {
    return false;
  }

  if (Date.now() > expiresAt) {
    registry.delete(key);
    return false;
  }

  return true;
}

function clearExpiredShareReadonlyAccess() {
  const now = Date.now();
  for (const [key, expiresAt] of registry.entries()) {
    if (now > expiresAt) {
      registry.delete(key);
    }
  }
}

module.exports = {
  markShareReadonlyAccess,
  isShareReadonlyAccess,
  clearExpiredShareReadonlyAccess,
};
