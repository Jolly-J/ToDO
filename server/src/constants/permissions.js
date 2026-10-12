/**
 * 权限常量基线
 *
 * 基线文档：docs/06-角色权限系统设计.md
 * 定义全局权限、Team 权限、数据范围枚举
 */

// ──────────────────────────────────────────
// 全局权限
// ──────────────────────────────────────────

const SYSTEM_PERMISSIONS = {
  'system:settings:view': '查看系统设置',
  'system:settings:edit': '修改系统设置',
  'system:dingtalk:sync': '触发钉钉同步',
  'system:roles:manage': '管理角色和权限',
  'system:users:manage': '管理用户（禁用/启用）',
};

const DATA_PERMISSIONS = {
  'data:all_teams:view': '查看所有Team',
  'data:all_tasks:view': '查看所有任务',
  'data:dept_teams:view': '查看本部门Team',
  'data:dept_tasks:view': '查看本部门任务',
};

const GLOBAL_FEATURE_PERMISSIONS = {
  'global:team:create': '创建Team',
  'global:dashboard:view': '查看驾驶舱',
};

const GLOBAL_PERMISSIONS = {
  ...SYSTEM_PERMISSIONS,
  ...DATA_PERMISSIONS,
  ...GLOBAL_FEATURE_PERMISSIONS,
};

// ──────────────────────────────────────────
// Team 权限
// ──────────────────────────────────────────

const TEAM_PERMISSIONS = {
  'team:info:edit': '编辑Team信息',
  'team:delete': '删除Team',
  'team:archive': '归档Team',
  'team:member:add': '添加成员',
  'team:member:remove': '移除成员',
  'team:member:role': '修改成员角色',
  'team:task:create': '创建任务',
  'team:task:edit_all': '编辑所有任务',
  'team:task:edit_own': '编辑自己创建/被指派的任务',
  'team:task:delete_all': '删除所有任务',
  'team:task:delete_own': '删除自己创建的任务',
  'team:task:view': '查看任务',
  'team:comment:create': '发表评论',
  'team:comment:delete_all': '删除所有评论',
  'team:comment:delete_own': '删除自己的评论',
  'team:attachment:upload': '上传附件',
  'team:attachment:delete_all': '删除所有附件',
  'team:attachment:delete_own': '删除自己上传的附件',
};

// ──────────────────────────────────────────
// 数据范围
// ──────────────────────────────────────────

const DATA_SCOPE = {
  ALL: 'all',
  DEPARTMENT: 'dept',
  SELF: 'self',
  CUSTOM: 'custom',
};

// ──────────────────────────────────────────
// 预设角色代码
// ──────────────────────────────────────────

const GLOBAL_ROLE_CODES = {
  SUPER_ADMIN: 'super_admin',
  DEPT_MANAGER: 'dept_manager',
  NORMAL_USER: 'normal_user',
  OBSERVER: 'observer',
};

const TEAM_ROLE_CODES = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
  OBSERVER: 'observer',
};

module.exports = {
  GLOBAL_PERMISSIONS,
  SYSTEM_PERMISSIONS,
  DATA_PERMISSIONS,
  GLOBAL_FEATURE_PERMISSIONS,
  TEAM_PERMISSIONS,
  DATA_SCOPE,
  GLOBAL_ROLE_CODES,
  TEAM_ROLE_CODES,
};
