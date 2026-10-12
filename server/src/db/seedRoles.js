/**
 * 角色与权限种子数据
 *
 * 基线文档：docs/06-角色权限系统设计.md
 * 幂等初始化全局角色、Team 角色及权限关系
 */

const { generateId } = require('../utils/uuid');
const { nowIso } = require('../utils/datetime');

// ──────────────────────────────────────────
// 全局角色定义
// ──────────────────────────────────────────

const GLOBAL_ROLES = [
  {
    code: 'super_admin',
    name: '超级管理员',
    description: '拥有系统所有权限',
    data_scope: 'all',
    is_system: 1,
    sort_order: 1,
    permissions: [
      'system:settings:view',
      'system:settings:edit',
      'system:dingtalk:sync',
      'system:roles:manage',
      'system:users:manage',
      'data:all_teams:view',
      'data:all_tasks:view',
      'global:team:create',
      'global:dashboard:view',
    ],
  },
  {
    code: 'dept_manager',
    name: '部门经理',
    description: '可查看本部门所有数据',
    data_scope: 'dept',
    is_system: 1,
    sort_order: 2,
    permissions: [
      'data:dept_teams:view',
      'data:dept_tasks:view',
      'global:team:create',
      'global:dashboard:view',
    ],
  },
  {
    code: 'normal_user',
    name: '普通用户',
    description: '默认角色，仅能看到自己参与的数据',
    data_scope: 'self',
    is_system: 1,
    sort_order: 3,
    permissions: [
      'global:team:create',
      'global:dashboard:view',
    ],
  },
  {
    code: 'observer',
    name: '观察者',
    description: '只读权限，通过 Team 邀请控制范围',
    data_scope: 'custom',
    is_system: 1,
    sort_order: 4,
    permissions: [
      'global:dashboard:view',
    ],
  },
];

// ──────────────────────────────────────────
// Team 角色定义
// ──────────────────────────────────────────

const TEAM_ROLES = [
  {
    code: 'owner',
    name: '所有者',
    description: 'Team 创建者，拥有全部权限',
    is_system: 1,
    sort_order: 1,
    permissions: [
      'team:info:edit',
      'team:delete',
      'team:archive',
      'team:member:add',
      'team:member:remove',
      'team:member:role',
      'team:task:create',
      'team:task:edit_all',
      'team:task:delete_all',
      'team:task:view',
      'team:comment:create',
      'team:comment:delete_all',
      'team:attachment:upload',
      'team:attachment:delete_all',
    ],
  },
  {
    code: 'admin',
    name: '管理员',
    description: '可管理成员和全部任务',
    is_system: 1,
    sort_order: 2,
    permissions: [
      'team:info:edit',
      'team:archive',
      'team:member:add',
      'team:member:remove',
      'team:member:role',
      'team:task:create',
      'team:task:edit_all',
      'team:task:delete_all',
      'team:task:view',
      'team:comment:create',
      'team:comment:delete_all',
      'team:attachment:upload',
      'team:attachment:delete_all',
    ],
  },
  {
    code: 'member',
    name: '普通成员',
    description: '可创建任务，编辑自己的任务',
    is_system: 1,
    sort_order: 3,
    permissions: [
      'team:task:create',
      'team:task:edit_own',
      'team:task:delete_own',
      'team:task:view',
      'team:comment:create',
      'team:comment:delete_own',
      'team:attachment:upload',
      'team:attachment:delete_own',
    ],
  },
  {
    code: 'observer',
    name: '观察者',
    description: '只读权限',
    is_system: 1,
    sort_order: 4,
    permissions: [
      'team:task:view',
    ],
  },
];

/**
 * 初始化角色与权限种子数据 (幂等)
 * @param {import('better-sqlite3').Database} db
 */
function seedRoles(db) {
  const stamp = nowIso();

  // ── 准备语句 ──
  const insertGlobalRole = db.prepare(`
    INSERT OR IGNORE INTO global_roles (id, code, name, description, data_scope, is_system, sort_order, created_at, updated_at)
    VALUES (@id, @code, @name, @description, @data_scope, @is_system, @sort_order, @created_at, @updated_at)
  `);

  const insertGlobalRolePerm = db.prepare(`
    INSERT OR IGNORE INTO global_role_permissions (id, role_id, permission_code)
    VALUES (@id, @role_id, @permission_code)
  `);

  const insertTeamRole = db.prepare(`
    INSERT OR IGNORE INTO team_roles (id, code, name, description, is_system, sort_order, created_at, updated_at)
    VALUES (@id, @code, @name, @description, @is_system, @sort_order, @created_at, @updated_at)
  `);

  const insertTeamRolePerm = db.prepare(`
    INSERT OR IGNORE INTO team_role_permissions (id, role_id, permission_code)
    VALUES (@id, @role_id, @permission_code)
  `);

  const findGlobalRole = db.prepare('SELECT id FROM global_roles WHERE code = ?');
  const findTeamRole = db.prepare('SELECT id FROM team_roles WHERE code = ?');

  const writeRoles = db.transaction(() => {
    // ── 全局角色 ──
    for (const role of GLOBAL_ROLES) {
      const roleId = `gr-${role.code}`;

      insertGlobalRole.run({
        id: roleId,
        code: role.code,
        name: role.name,
        description: role.description,
        data_scope: role.data_scope,
        is_system: role.is_system,
        sort_order: role.sort_order,
        created_at: stamp,
        updated_at: stamp,
      });

      // 确保获取到已存在的 role id
      const existingRole = findGlobalRole.get(role.code);
      const finalRoleId = existingRole ? existingRole.id : roleId;

      for (const permCode of role.permissions) {
        insertGlobalRolePerm.run({
          id: generateId(),
          role_id: finalRoleId,
          permission_code: permCode,
        });
      }
    }

    // ── Team 角色 ──
    for (const role of TEAM_ROLES) {
      const roleId = `tr-${role.code}`;

      insertTeamRole.run({
        id: roleId,
        code: role.code,
        name: role.name,
        description: role.description,
        is_system: role.is_system,
        sort_order: role.sort_order,
        created_at: stamp,
        updated_at: stamp,
      });

      const existingRole = findTeamRole.get(role.code);
      const finalRoleId = existingRole ? existingRole.id : roleId;

      for (const permCode of role.permissions) {
        insertTeamRolePerm.run({
          id: generateId(),
          role_id: finalRoleId,
          permission_code: permCode,
        });
      }
    }
  });

  writeRoles();
}

module.exports = {
  seedRoles,
  GLOBAL_ROLES,
  TEAM_ROLES,
};
