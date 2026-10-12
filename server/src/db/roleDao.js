/**
 * 角色 DAO
 *
 * 提供角色、权限、用户角色分配的查询与管理能力
 * 全部使用 prepared statements
 */

const { getDb } = require('./sqlite');
const { generateId } = require('../utils/uuid');
const { nowIso } = require('../utils/datetime');

// ──────────────────────────────────────────
// 全局角色
// ──────────────────────────────────────────

function listGlobalRoles() {
  const db = getDb();
  return db.prepare('SELECT * FROM global_roles ORDER BY sort_order ASC').all();
}

function findGlobalRoleByCode(code) {
  const db = getDb();
  return db.prepare('SELECT * FROM global_roles WHERE code = ?').get(code) || null;
}

function findGlobalRoleById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM global_roles WHERE id = ?').get(id) || null;
}

function getGlobalRolePermissions(roleId) {
  const db = getDb();
  return db.prepare('SELECT permission_code FROM global_role_permissions WHERE role_id = ?')
    .all(roleId)
    .map(r => r.permission_code);
}

// ──────────────────────────────────────────
// Team 角色
// ──────────────────────────────────────────

function listTeamRoles() {
  const db = getDb();
  return db.prepare('SELECT * FROM team_roles ORDER BY sort_order ASC').all();
}

function findTeamRoleByCode(code) {
  const db = getDb();
  return db.prepare('SELECT * FROM team_roles WHERE code = ?').get(code) || null;
}

function getTeamRolePermissions(roleId) {
  const db = getDb();
  return db.prepare('SELECT permission_code FROM team_role_permissions WHERE role_id = ?')
    .all(roleId)
    .map(r => r.permission_code);
}

// ──────────────────────────────────────────
// 用户角色
// ──────────────────────────────────────────

function getUserGlobalRoles(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT gr.id, gr.code, gr.name, gr.data_scope, gr.is_system
    FROM user_global_roles ugr
    JOIN global_roles gr ON ugr.role_id = gr.id
    WHERE ugr.user_id = ?
  `).all(userId);
}

function getUserGlobalPermissions(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT DISTINCT grp.permission_code
    FROM user_global_roles ugr
    JOIN global_role_permissions grp ON ugr.role_id = grp.role_id
    WHERE ugr.user_id = ?
  `).all(userId).map(r => r.permission_code);
}

function countUsersByGlobalRoleId(roleId) {
  const db = getDb();
  const result = db.prepare(
    'SELECT COUNT(DISTINCT user_id) as count FROM user_global_roles WHERE role_id = ?'
  ).get(roleId);

  return Number(result?.count || 0);
}

function getUserTeamRole(userId, teamId) {
  const db = getDb();
  const member = db.prepare(
    'SELECT role_id FROM team_members WHERE user_id = ? AND team_id = ?'
  ).get(userId, teamId);

  if (!member) {
    return null;
  }

  // role_id 可能是角色 code (旧数据) 或角色 id (新数据)
  let role = db.prepare('SELECT * FROM team_roles WHERE id = ?').get(member.role_id);

  if (!role) {
    role = db.prepare('SELECT * FROM team_roles WHERE code = ?').get(member.role_id);
  }

  return role || null;
}

function getUserTeamPermissions(userId, teamId) {
  const role = getUserTeamRole(userId, teamId);

  if (!role) {
    return [];
  }

  return getTeamRolePermissions(role.id);
}

function isTeamMember(userId, teamId) {
  const db = getDb();
  const result = db.prepare(
    'SELECT COUNT(*) as count FROM team_members WHERE user_id = ? AND team_id = ?'
  ).get(userId, teamId);

  return result.count > 0;
}

// ──────────────────────────────────────────
// 角色管理 (管理端)
// ──────────────────────────────────────────

function assignUserGlobalRole(userId, roleId, assignedBy) {
  const db = getDb();
  db.prepare(`
    INSERT OR IGNORE INTO user_global_roles (id, user_id, role_id, assigned_by, assigned_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(generateId(), userId, roleId, assignedBy, nowIso());
}

function removeUserGlobalRole(userId, roleId) {
  const db = getDb();
  return db.prepare(
    'DELETE FROM user_global_roles WHERE user_id = ? AND role_id = ?'
  ).run(userId, roleId).changes;
}

function setUserGlobalRoles(userId, roleIds, assignedBy) {
  const db = getDb();
  const stamp = nowIso();

  const setRoles = db.transaction(() => {
    db.prepare('DELETE FROM user_global_roles WHERE user_id = ?').run(userId);

    for (const roleId of roleIds) {
      db.prepare(`
        INSERT INTO user_global_roles (id, user_id, role_id, assigned_by, assigned_at)
        VALUES (?, ?, ?, ?, ?)
      `).run(generateId(), userId, roleId, assignedBy, stamp);
    }
  });

  setRoles();
}

module.exports = {
  listGlobalRoles,
  findGlobalRoleByCode,
  findGlobalRoleById,
  getGlobalRolePermissions,
  listTeamRoles,
  findTeamRoleByCode,
  getTeamRolePermissions,
  getUserGlobalRoles,
  getUserGlobalPermissions,
  countUsersByGlobalRoleId,
  getUserTeamRole,
  getUserTeamPermissions,
  isTeamMember,
  assignUserGlobalRole,
  removeUserGlobalRole,
  setUserGlobalRoles,
};
