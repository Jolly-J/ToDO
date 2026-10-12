/**
 * Permission 权限中间件
 *
 * 1. requireGlobalPermission — 全局权限校验
 * 2. requireTeamPermission — Team 权限校验
 * 3. requireTeamMember — Team 成员校验
 */

const { error } = require('../utils/response');
const permissionCache = require('../services/permissionCache');
const roleDao = require('../db/roleDao');

/**
 * 全局权限校验中间件
 * @param {string} permissionCode
 */
function requireGlobalPermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED');
    }

    // 超管拥有所有权限
    if (permissionCache.isSuperAdmin(req.user.id)) {
      return next();
    }

    if (!permissionCache.hasGlobalPermission(req.user.id, permissionCode)) {
      return error(res, 'FORBIDDEN_GLOBAL');
    }

    next();
  };
}

/**
 * Team 权限校验中间件
 * @param {string} permissionCode
 */
function requireTeamPermission(permissionCode) {
  return (req, res, next) => {
    if (!req.user) {
      return error(res, 'UNAUTHORIZED');
    }

    const teamId = req.params.teamId || req.params.id || req.body?.teamId || req.query?.teamId;

    if (!teamId) {
      return error(res, 'MISSING_PARAM', '缺少 teamId');
    }

    // 超管拥有所有 Team 权限
    if (permissionCache.isSuperAdmin(req.user.id)) {
      return next();
    }

    if (!permissionCache.hasTeamPermission(req.user.id, teamId, permissionCode)) {
      return error(res, 'FORBIDDEN_TEAM');
    }

    next();
  };
}

/**
 * Team 成员校验中间件 (不校验具体权限，只要求是成员)
 */
function requireTeamMember(req, res, next) {
  if (!req.user) {
    return error(res, 'UNAUTHORIZED');
  }

  const teamId = req.params.teamId || req.params.id || req.body?.teamId || req.query?.teamId;

  if (!teamId) {
    return error(res, 'MISSING_PARAM', '缺少 teamId');
  }

  // 超管可访问所有 Team
  if (permissionCache.isSuperAdmin(req.user.id)) {
    return next();
  }

  if (!roleDao.isTeamMember(req.user.id, teamId)) {
    return error(res, 'FORBIDDEN_TEAM', '非 Team 成员');
  }

  next();
}

/**
 * 注入权限上下文到 req.user (在 auth 中间件之后使用)
 */
function injectPermissionContext(req, res, next) {
  if (!req.user) {
    return next();
  }

  const userId = req.user.id;

  req.user.globalPermissions = permissionCache.getUserGlobalPermissions(userId);
  req.user.dataScope = permissionCache.getUserDataScope(userId);
  req.user.isSuperAdmin = permissionCache.isSuperAdmin(userId);

  const globalRoles = permissionCache.getUserGlobalRoles(userId);
  req.user.globalRoleCodes = globalRoles.map(r => r.code);

  next();
}

module.exports = {
  requireGlobalPermission,
  requireTeamPermission,
  requireTeamMember,
  injectPermissionContext,
};
