/**
 * 启动阶段预置超级管理员配置
 *
 * 功能说明：
 * - 在系统初始部署或首批交付阶段，为指定的钉钉/系统用户 ID 自动授予超级管理员角色（super_admin）。
 * - 开源版本已全面脱敏，不再硬编码任何个人姓名与工号/钉钉 ID，改为从环境变量动态读取。
 *
 * 环境变量支持：
 * - INITIAL_SUPER_ADMIN_IDS: 逗号分隔的用户 ID 列表，例如 "admin_user_1,admin_user_2"
 * - INITIAL_SUPER_ADMIN_ID: 单个管理员用户 ID（兼容写法）
 *
 * 安全提示：
 * - 生产环境中请通过 .env 文件或容器环境变量按需注入；
 * - 若未配置环境变量，默认不会自动赋予超管，避免未授权访问风险。
 */

function parseSuperAdminIds() {
  const raw = process.env.INITIAL_SUPER_ADMIN_IDS || process.env.INITIAL_SUPER_ADMIN_ID || '';
  return raw
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

function getBootstrapSuperAdmins() {
  const ids = parseSuperAdminIds();
  return ids.map((id) => ({
    id,
    name: `系统初始管理员(${id})`,
  }));
}

function isBootstrapSuperAdmin(userId) {
  const normalizedUserId = String(userId || '').trim();
  if (!normalizedUserId) {
    return false;
  }
  const ids = parseSuperAdminIds();
  return ids.includes(normalizedUserId);
}

module.exports = {
  get BOOTSTRAP_SUPER_ADMINS() {
    return getBootstrapSuperAdmins();
  },
  getBootstrapSuperAdmins,
  isBootstrapSuperAdmin,
};
