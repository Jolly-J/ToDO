/**
 * 认证服务
 *
 * 1. 统一处理扫码与免登后的本地建档
 * 2. 更新用户基础信息与身份映射
 * 3. 分配默认角色并签发 JWT
 */

const jwtUtil = require('../../utils/jwt');
const logger = require('../../utils/logger');
const userDao = require('../../db/userDao');
const userIdentityDao = require('../../db/userIdentityDao');
const { getDb } = require('../../db/sqlite');
const { generateId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');
const { isBootstrapSuperAdmin } = require('../../constants/adminUsers');
const permissionCache = require('../../services/permissionCache');

/**
 * 处理登录建档 — 扫码/免登统一入口
 * @param {{ userid: string, name?: string, avatar?: string, unionid?: string, openid?: string, job_number?: string, mobile?: string, email?: string, department_id?: string, department_name?: string }} params
 * @returns {{ token: string, user: object, globalPermissions: string[], dataScope: string }}
 */
function handleLogin(params) {
  const db = getDb();

  const result = db.transaction(() => {
    // 0. 严格校验：不允许未登记用户登录，也不允许被禁用的用户（status=0）登录
    const existingUser = userDao.findById(params.userid);
    if (!existingUser) {
      const err = new Error('系统未登记此账号，请联系管理员开通');
      err.code = 'USER_NOT_REGISTERED';
      throw err;
    }
    if (existingUser.status === 0) {
      const err = new Error('您的账号已被访问策略禁用');
      err.code = 'USER_DISABLED';
      throw err;
    }

    // 1. 局部身份信息更新 (UPSERT 退化为增量 UPDATE)
    const user = userDao.upsertUser({
      id: params.userid,
      name: params.name || '',
      avatar: params.avatar || '',
      job_number: params.job_number || '',
      mobile: params.mobile || '',
      email: params.email || '',
      department_id: params.department_id || null,
      department_name: params.department_name || '',
    });

    // 2. UPSERT 身份映射
    if (params.unionid || params.openid) {
      userIdentityDao.upsertIdentity({
        user_id: params.userid,
        provider: 'dingtalk',
        provider_userid: params.userid,
        unionid: params.unionid || null,
        openid: params.openid || null,
      });
    }

    // 3. 确保默认角色分配
    ensureDefaultRole(db, params.userid);
    ensureBootstrapSuperAdminRole(db, params.userid);
    permissionCache.clearUserCache(params.userid);

    // 4. 加载权限信息
    const permInfo = loadUserPermissions(db, params.userid);

    // 5. 签发 JWT
    const token = jwtUtil.sign({
      id: user.id,
      name: user.name,
    });

    logger.business('user.login', 'success', {
      userId: user.id,
      userName: user.name,
      isNewUser: !user.created_at,
    });

    return {
      token,
      user: {
        id: user.id,
        name: user.name,
        avatar: user.avatar,
        avatar_type: user.avatar_type || 'default',
        avatar_config: user.avatar_config || null,
        job_number: user.job_number,
        mobile: user.mobile,
        email: user.email,
        department_id: user.department_id,
        department_name: user.department_name,
        is_dept_manager: user.is_dept_manager,
        status: user.status,
      },
      globalPermissions: permInfo.permissions,
      dataScope: permInfo.dataScope,
    };
  })();

  return result;
}

/**
 * 获取当前用户完整信息 (用于 /api/auth/me)
 * @param {string} userId
 * @returns {object|null}
 */
function getCurrentUser(userId) {
  const db = getDb();
  const user = userDao.findById(userId);

  if (!user || user.status !== 1) {
    return null;
  }

  const permInfo = loadUserPermissions(db, userId);

  return {
    user: {
      id: user.id,
      name: user.name,
      avatar: user.avatar,
      avatar_type: user.avatar_type || 'default',
      avatar_config: user.avatar_config || null,
      job_number: user.job_number,
      mobile: user.mobile,
      email: user.email,
      department_id: user.department_id,
      department_name: user.department_name,
      is_dept_manager: user.is_dept_manager,
      status: user.status,
    },
    globalPermissions: permInfo.permissions,
    globalRoleCodes: permInfo.roleCodes,
    dataScope: permInfo.dataScope,
    isSuperAdmin: permInfo.isSuperAdmin,
  };
}

/**
 * 确保用户有默认全局角色
 */
function ensureDefaultRole(db, userId) {
  const existing = db.prepare(
    'SELECT COUNT(*) as count FROM user_global_roles WHERE user_id = ?'
  ).get(userId);

  if (existing.count > 0) {
    return;
  }

  const preferredRoleCode = isBootstrapSuperAdmin(userId) ? 'super_admin' : 'normal_user';
  const normalRole = db.prepare('SELECT id FROM global_roles WHERE code = ?').get(preferredRoleCode)
    || db.prepare("SELECT id FROM global_roles WHERE code = 'normal_user'").get();

  if (!normalRole) {
    return;
  }

  db.prepare(`
    INSERT OR IGNORE INTO user_global_roles (id, user_id, role_id, assigned_by, assigned_at)
    VALUES (?, ?, ?, 'system', ?)
  `).run(generateId(), userId, normalRole.id, nowIso());
}

function ensureBootstrapSuperAdminRole(db, userId) {
  if (!isBootstrapSuperAdmin(userId)) {
    return;
  }

  const superAdminRole = db.prepare("SELECT id FROM global_roles WHERE code = 'super_admin'").get();
  if (!superAdminRole) {
    return;
  }

  db.prepare(`
    INSERT OR IGNORE INTO user_global_roles (id, user_id, role_id, assigned_by, assigned_at)
    VALUES (?, ?, ?, 'system', ?)
  `).run(generateId(), userId, superAdminRole.id, nowIso());
}

/**
 * 加载用户权限信息
 */
function loadUserPermissions(db, userId) {
  const roles = db.prepare(`
    SELECT gr.code, gr.data_scope
    FROM user_global_roles ugr
    JOIN global_roles gr ON ugr.role_id = gr.id
    WHERE ugr.user_id = ?
  `).all(userId);

  const roleCodes = roles.map(r => r.code);
  const isSuperAdmin = roleCodes.includes('super_admin');

  // 聚合数据范围 (优先级: all > dept > self > custom)
  const scopePriority = { all: 4, dept: 3, self: 2, custom: 1 };
  let dataScope = 'self';

  for (const role of roles) {
    if ((scopePriority[role.data_scope] || 0) > (scopePriority[dataScope] || 0)) {
      dataScope = role.data_scope;
    }
  }

  // 聚合所有权限
  const roleIds = roles.length > 0
    ? db.prepare(`SELECT id FROM global_roles WHERE code IN (${roles.map(() => '?').join(',')})`)
        .all(...roleCodes).map(r => r.id)
    : [];

  let permissions = [];

  if (roleIds.length > 0) {
    permissions = db.prepare(
      `SELECT DISTINCT permission_code FROM global_role_permissions WHERE role_id IN (${roleIds.map(() => '?').join(',')})`
    ).all(...roleIds).map(r => r.permission_code);
  }

  return {
    roleCodes,
    permissions,
    dataScope,
    isSuperAdmin,
  };
}

module.exports = {
  handleLogin,
  getCurrentUser,
};
