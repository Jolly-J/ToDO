/**
 * 管理后台用户目录服务
 *
 * 负责整理用户、角色和管理员身份相关视图数据。
 */
const userDao = require('../../db/userDao');
const roleDao = require('../../db/roleDao');
const permissionCache = require('../../services/permissionCache');
const { GLOBAL_ROLE_CODES } = require('../../constants/permissions');

function normalizeUserRow(user, roles, isAdmin) {
  const safeRoles = Array.isArray(roles) ? roles : [];

  return {
    ...user,
    isDeptManager: Boolean(user.is_dept_manager),
    statusLabel: Number(user.status) === 1 ? '正常' : '已停用',
    isAdmin: Boolean(isAdmin),
    globalRoles: safeRoles,
    roleCodes: safeRoles.map((role) => role.code),
    roleNames: safeRoles.map((role) => role.name),
  };
}

function buildAdminUserDirectory({ source, resolveRoles, isAdminResolver }) {
  const list = (source?.list || []).map((user) => {
    const roles = resolveRoles ? resolveRoles(user.id) : [];
    const isAdmin = isAdminResolver ? isAdminResolver(user.id) : false;
    return normalizeUserRow(user, roles, isAdmin);
  });

  return {
    list,
    total: source?.total || 0,
    page: source?.page || 1,
    pageSize: source?.pageSize || list.length,
    summary: {
      total: source?.total || list.length,
      activeCount: list.filter((item) => Number(item.status) === 1).length,
      adminCount: list.filter((item) => item.isAdmin).length,
      deptManagerCount: list.filter((item) => item.isDeptManager).length,
    },
  };
}

function buildAdminRoleIds({ currentRoles = [], adminRoleId, fallbackRoleId, shouldHaveAdmin }) {
  const baseRoleIds = currentRoles
    .filter((role) => role.code !== GLOBAL_ROLE_CODES.SUPER_ADMIN)
    .map((role) => role.id);

  if (shouldHaveAdmin && adminRoleId) {
    return [...new Set([...baseRoleIds, adminRoleId])];
  }

  if (baseRoleIds.length > 0) {
    return [...new Set(baseRoleIds)];
  }

  return fallbackRoleId ? [fallbackRoleId] : [];
}

function getAdminRoleMutationGuard({
  actorUserId,
  targetUserId,
  targetIsAdmin,
  nextIsAdmin,
  adminCount,
}) {
  if (targetIsAdmin === nextIsAdmin) {
    return { allowed: true };
  }

  if (!targetIsAdmin || nextIsAdmin) {
    return { allowed: true };
  }

  if (actorUserId && targetUserId && String(actorUserId) === String(targetUserId)) {
    return {
      allowed: false,
      code: 'ADMIN_SELF_REVOKE_FORBIDDEN',
      message: '不能撤销当前登录管理员自己的管理员身份',
    };
  }

  if (Number(adminCount || 0) <= 1) {
    return {
      allowed: false,
      code: 'LAST_ADMIN_REVOKE_FORBIDDEN',
      message: '系统至少需要保留一名管理员',
    };
  }

  return { allowed: true };
}

function getAdminUsers(filters = {}) {
  const source = userDao.listUsers(filters);

  return buildAdminUserDirectory({
    source,
    resolveRoles: (userId) => roleDao.getUserGlobalRoles(userId),
    isAdminResolver: (userId) => permissionCache.isSuperAdmin(userId),
  });
}

module.exports = {
  buildAdminRoleIds,
  buildAdminUserDirectory,
  getAdminRoleMutationGuard,
  getAdminUsers,
};
