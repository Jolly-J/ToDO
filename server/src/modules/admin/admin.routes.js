/**
 * 管理端路由 — 角色与权限管理
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const { success, error } = require('../../utils/response');
const roleDao = require('../../db/roleDao');
const userDao = require('../../db/userDao');
const permissionCache = require('../../services/permissionCache');
const { GLOBAL_PERMISSIONS, TEAM_PERMISSIONS, GLOBAL_ROLE_CODES } = require('../../constants/permissions');
const { getAdminHealthOverview } = require('./admin.health.service');
const { buildAdminRoleIds, getAdminRoleMutationGuard, getAdminUsers } = require('./admin.users.service');
const { getAdminAuditFeed } = require('./admin.audit.service');
const { getAdminTaskFeed } = require('./admin.tasks.service');
const dingtalkBroadcastAdminRoutes = require('../dingtalkBroadcast/dingtalkBroadcast.admin.routes');

const router = Router();

// 所有接口都需要认证
router.use(auth);

function getAdminSessionPayload(userId) {
  const roles = roleDao.getUserGlobalRoles(userId);
  const roleCodes = roles.map((role) => role.code);
  const isAdmin = roleCodes.includes(GLOBAL_ROLE_CODES.SUPER_ADMIN);

  return {
    userId,
    isAdmin,
    roleCodes,
  };
}

function requireAdminSession(req, res, next) {
  const payload = getAdminSessionPayload(req.user.id);

  if (!payload.isAdmin) {
    return error(res, 'FORBIDDEN', '仅管理员可访问管理后台');
  }

  req.adminSession = payload;
  next();
}

/**
 * GET /api/admin/session — 管理端会话检查
 * 返回当前用户是否具备管理员能力
 */
router.get('/session', (req, res) => {
  return success(res, getAdminSessionPayload(req.user.id));
});

// 其余接口统一要求单一管理员角色
router.use(requireAdminSession);

router.use('/dingtalk-push', dingtalkBroadcastAdminRoutes);

/**
 * GET /api/admin/health — 管理后台真实健康度与最近审计事件
 */
router.get('/health', (req, res) => {
  return success(res, getAdminHealthOverview());
});

/**
 * GET /api/admin/users — 管理后台用户目录
 */
router.get('/users', (req, res) => {
  const { keyword, status, page, pageSize } = req.query;

  return success(
    res,
    getAdminUsers({
      keyword,
      status: status !== undefined ? Number(status) : undefined,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    })
  );
});

/**
 * PUT /api/admin/users/:id/admin-role — 仅切换后台管理员角色
 */
router.put('/users/:id/admin-role', (req, res) => {
  const user = userDao.findById(req.params.id);

  if (!user) {
    return error(res, 'USER_NOT_FOUND');
  }

  const { isAdmin } = req.body;

  if (typeof isAdmin !== 'boolean') {
    return error(res, 'INVALID_PARAM', 'isAdmin 必须为布尔值');
  }

  const currentRoles = roleDao.getUserGlobalRoles(req.params.id);
  const adminRole = roleDao.findGlobalRoleByCode(GLOBAL_ROLE_CODES.SUPER_ADMIN);
  const normalUserRole = roleDao.findGlobalRoleByCode(GLOBAL_ROLE_CODES.NORMAL_USER);

  if (!adminRole) {
    return error(res, 'INVALID_CONFIG', '管理员角色未初始化');
  }

  const guard = getAdminRoleMutationGuard({
    actorUserId: req.user.id,
    targetUserId: req.params.id,
    targetIsAdmin: currentRoles.some((role) => role.code === GLOBAL_ROLE_CODES.SUPER_ADMIN),
    nextIsAdmin: isAdmin,
    adminCount: roleDao.countUsersByGlobalRoleId(adminRole.id),
  });

  if (!guard.allowed) {
    return error(res, 'FORBIDDEN', guard.message);
  }

  const nextRoleIds = buildAdminRoleIds({
    currentRoles,
    adminRoleId: adminRole.id,
    fallbackRoleId: normalUserRole?.id,
    shouldHaveAdmin: isAdmin,
  });

  roleDao.setUserGlobalRoles(req.params.id, nextRoleIds, req.user.id);
  permissionCache.clearUserCache(req.params.id);

  return success(res, {
    userId: req.params.id,
    isAdmin,
    roles: roleDao.getUserGlobalRoles(req.params.id),
  });
});

/**
 * GET /api/admin/audit — 钉钉业务审计事件流
 */
router.get('/audit', (req, res) => {
  const { action, result, keyword, page, pageSize } = req.query;

  return success(
    res,
    getAdminAuditFeed({
      action,
      result,
      keyword,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 20,
    })
  );
});

/**
 * GET /api/admin/tasks — 管理后台全量任务只读视图
 */
router.get('/tasks', (req, res) => {
  const { keyword, status, priority, teamId, page, pageSize } = req.query;

  return success(
    res,
    getAdminTaskFeed({
      keyword,
      status,
      priority,
      teamId,
      page: Number(page) || 1,
      pageSize: Number(pageSize) || 100,
    }, req.user.id)
  );
});

// ──────────────────────────────────────────
// 全局角色管理
// ──────────────────────────────────────────

/**
 * GET /api/admin/global-roles — 全局角色列表
 */
router.get('/global-roles', (req, res) => {
  const roles = roleDao.listGlobalRoles();
  const rolesWithPerms = roles.map(role => ({
    ...role,
    permissions: roleDao.getGlobalRolePermissions(role.id),
  }));

  return success(res, { list: rolesWithPerms });
});

/**
 * GET /api/admin/team-roles — Team 角色列表
 */
router.get('/team-roles', (req, res) => {
  const roles = roleDao.listTeamRoles();
  const rolesWithPerms = roles.map(role => ({
    ...role,
    permissions: roleDao.getTeamRolePermissions(role.id),
  }));

  return success(res, { list: rolesWithPerms });
});

/**
 * GET /api/admin/permissions/global — 全局权限清单
 */
router.get('/permissions/global', (req, res) => {
  const list = Object.entries(GLOBAL_PERMISSIONS).map(([code, name]) => ({ code, name }));
  return success(res, { list });
});

/**
 * GET /api/admin/permissions/team — Team 权限清单
 */
router.get('/permissions/team', (req, res) => {
  const list = Object.entries(TEAM_PERMISSIONS).map(([code, name]) => ({ code, name }));
  return success(res, { list });
});

// ──────────────────────────────────────────
// 用户角色分配
// ──────────────────────────────────────────

/**
 * GET /api/admin/users/:id/roles — 获取用户全局角色
 */
router.get('/users/:id/roles', (req, res) => {
  const user = userDao.findById(req.params.id);

  if (!user) {
    return error(res, 'USER_NOT_FOUND');
  }

  const roles = roleDao.getUserGlobalRoles(req.params.id);
  return success(res, { userId: req.params.id, roles });
});

/**
 * PUT /api/admin/users/:id/roles — 分配用户全局角色
 */
router.put('/users/:id/roles', (req, res) => {
  const user = userDao.findById(req.params.id);

  if (!user) {
    return error(res, 'USER_NOT_FOUND');
  }

  const { roleIds } = req.body;

  if (!Array.isArray(roleIds)) {
    return error(res, 'INVALID_PARAM', 'roleIds 必须为数组');
  }

  roleDao.setUserGlobalRoles(req.params.id, roleIds, req.user.id);
  permissionCache.clearUserCache(req.params.id);

  const updatedRoles = roleDao.getUserGlobalRoles(req.params.id);
  return success(res, { userId: req.params.id, roles: updatedRoles });
});

/**
 * PUT /api/admin/users/:id/dept-manager — 设置/取消部门经理
 */
router.put('/users/:id/dept-manager', (req, res) => {
  const user = userDao.findById(req.params.id);

  if (!user) {
    return error(res, 'USER_NOT_FOUND');
  }

  const { isDeptManager } = req.body;
  const updatedUser = userDao.upsertUser({
    id: req.params.id,
    is_dept_manager: isDeptManager ? 1 : 0,
  });

  return success(res, updatedUser);
});

module.exports = router;
