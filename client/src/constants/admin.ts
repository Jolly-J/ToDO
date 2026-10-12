/** 管理员相关常量，定义默认管理员 ID 及环境变量解析逻辑 */
const DEFAULT_ADMIN_USER_IDS: string[] = [];

function parseAdminUserIdsFromEnv() {
  const raw = String(import.meta.env.VITE_ADMIN_USER_IDS || '').trim();
  if (!raw) {
    return [];
  }

  return raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export const ADMIN_USER_IDS = new Set([
  ...DEFAULT_ADMIN_USER_IDS,
  ...parseAdminUserIdsFromEnv(),
]);

export function isLocalAdminUser(userId?: string | null) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return false;
  }
  return ADMIN_USER_IDS.has(normalizedUserId);
}
