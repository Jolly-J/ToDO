/**
 * 统一数据范围过滤工具
 *
 * 基线文档：docs/backend-foundation/design.md
 * 为 Team、Task、Dashboard 查询提供统一过滤入口
 */

const userDao = require('../db/userDao');
const { getDb } = require('../db/sqlite');

/**
 * 根据数据范围生成 SQL 过滤条件
 *
 * @param {{ userId: string, dataScope: string, departmentId?: string }} context
 * @param {{ userColumn?: string, teamColumn?: string }} options
 * @returns {{ condition: string, params: any[] }}
 */
function buildScopeFilter(context, options = {}) {
  const { userId, dataScope, departmentId } = context;
  const userColumn = options.userColumn || 'creator_id';

  switch (dataScope) {
    case 'all':
      // 超管/全部数据 — 不过滤
      return { condition: '1=1', params: [] };

    case 'dept': {
      // 部门经理 — 本部门所有人的数据
      const deptId = departmentId || getUserDepartmentId(userId);

      if (!deptId) {
        // 没有部门信息则退化为 self
        return buildSelfFilter(userId, userColumn);
      }

      const deptUserIds = userDao.getUserIdsByDepartment(deptId);

      if (deptUserIds.length === 0) {
        return buildSelfFilter(userId, userColumn);
      }

      const placeholders = deptUserIds.map(() => '?').join(', ');
      return {
        condition: `${userColumn} IN (${placeholders})`,
        params: deptUserIds,
      };
    }

    case 'custom':
      // 观察者 — 通过 Team 邀请控制，等同于 self + 所属 Team
      return buildSelfFilter(userId, userColumn);

    case 'self':
    default:
      return buildSelfFilter(userId, userColumn);
  }
}

/**
 * 构建 self 范围过滤
 */
function buildSelfFilter(userId, userColumn) {
  return {
    condition: `${userColumn} = ?`,
    params: [userId],
  };
}

/**
 * 构建 Team 可见范围过滤
 * @param {{ userId: string, dataScope: string, departmentId?: string }} context
 * @returns {{ condition: string, params: any[] }}
 */
function buildTeamScopeFilter(context) {
  const { userId, dataScope, departmentId } = context;

  switch (dataScope) {
    case 'all':
      return { condition: '1=1', params: [] };

    case 'dept': {
      const deptId = departmentId || getUserDepartmentId(userId);

      if (!deptId) {
        return buildTeamSelfFilter(userId);
      }

      // 本部门用户参与的所有 Team
      const deptUserIds = userDao.getUserIdsByDepartment(deptId);

      if (deptUserIds.length === 0) {
        return buildTeamSelfFilter(userId);
      }

      const placeholders = deptUserIds.map(() => '?').join(', ');
      return {
        condition: `t.id IN (SELECT team_id FROM team_members WHERE user_id IN (${placeholders}))`,
        params: deptUserIds,
      };
    }

    case 'self':
    case 'custom':
    default:
      return buildTeamSelfFilter(userId);
  }
}

/**
 * 构建用户所属 Team 过滤
 */
function buildTeamSelfFilter(userId) {
  return {
    condition: 't.id IN (SELECT team_id FROM team_members WHERE user_id = ?)',
    params: [userId],
  };
}

/**
 * 构建任务可见范围过滤 (综合 Team + 角色)
 * @param {{ userId: string, dataScope: string, departmentId?: string, teamId?: string }} context
 * @returns {{ condition: string, params: any[] }}
 */
function buildTaskScopeFilter(context) {
  const { userId, dataScope, teamId } = context;

  // 如果指定了 teamId，不做数据范围过滤 (Team 权限由 permission 中间件保证)
  if (teamId) {
    return {
      condition: 'tasks.team_id = ?',
      params: [teamId],
    };
  }

  switch (dataScope) {
    case 'all':
      return { condition: '1=1', params: [] };

    case 'dept': {
      const deptId = context.departmentId || getUserDepartmentId(userId);

      if (!deptId) {
        return buildTaskSelfFilter(userId);
      }

      const deptUserIds = userDao.getUserIdsByDepartment(deptId);

      if (deptUserIds.length === 0) {
        return buildTaskSelfFilter(userId);
      }

      const ph = deptUserIds.map(() => '?').join(', ');
      return {
        condition: `(tasks.creator_id IN (${ph}) OR tasks.assignee_id IN (${ph}))`,
        params: [...deptUserIds, ...deptUserIds],
      };
    }

    case 'self':
    case 'custom':
    default:
      return buildTaskSelfFilter(userId);
  }
}

function buildTaskSelfFilter(userId) {
  return {
    condition: `(tasks.creator_id = ? OR tasks.assignee_id = ? OR tasks.participant_ids LIKE ?)`,
    params: [userId, userId, `%"${userId}"%`],
  };
}

/**
 * 获取用户主部门 ID
 */
function getUserDepartmentId(userId) {
  const user = userDao.findById(userId);
  return user?.department_id || null;
}

module.exports = {
  buildScopeFilter,
  buildTeamScopeFilter,
  buildTaskScopeFilter,
};
