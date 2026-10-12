/**
 * 权限缓存服务
 *
 * 基线文档：docs/backend-foundation/design.md
 * 缓存全局角色与 Team 角色权限，避免每次请求查库
 */

const roleDao = require('../db/roleDao');
const logger = require('../utils/logger');

class PermissionCache {
  constructor() {
    /** @type {Map<string, string[]>} userId → globalPermissions */
    this.globalPermissions = new Map();
    /** @type {Map<string, string[]>} `${userId}:${teamId}` → teamPermissions */
    this.teamPermissions = new Map();
    /** @type {Map<string, object[]>} userId → roles */
    this.userRoles = new Map();
  }

  /**
   * 获取用户全局权限 (带缓存)
   * @param {string} userId
   * @returns {string[]}
   */
  getUserGlobalPermissions(userId) {
    if (this.globalPermissions.has(userId)) {
      return this.globalPermissions.get(userId);
    }

    const permissions = roleDao.getUserGlobalPermissions(userId);
    this.globalPermissions.set(userId, permissions);
    return permissions;
  }

  /**
   * 获取用户全局角色 (带缓存)
   * @param {string} userId
   * @returns {object[]}
   */
  getUserGlobalRoles(userId) {
    if (this.userRoles.has(userId)) {
      return this.userRoles.get(userId);
    }

    const roles = roleDao.getUserGlobalRoles(userId);
    this.userRoles.set(userId, roles);
    return roles;
  }

  /**
   * 获取用户在 Team 中的权限 (带缓存)
   * @param {string} userId
   * @param {string} teamId
   * @returns {string[]}
   */
  getUserTeamPermissions(userId, teamId) {
    const key = `${userId}:${teamId}`;

    if (this.teamPermissions.has(key)) {
      return this.teamPermissions.get(key);
    }

    const permissions = roleDao.getUserTeamPermissions(userId, teamId);
    this.teamPermissions.set(key, permissions);
    return permissions;
  }

  /**
   * 判断用户是否具备全局权限
   * @param {string} userId
   * @param {string} permissionCode
   * @returns {boolean}
   */
  hasGlobalPermission(userId, permissionCode) {
    const permissions = this.getUserGlobalPermissions(userId);
    return permissions.includes(permissionCode);
  }

  /**
   * 判断用户是否具备 Team 权限
   * @param {string} userId
   * @param {string} teamId
   * @param {string} permissionCode
   * @returns {boolean}
   */
  hasTeamPermission(userId, teamId, permissionCode) {
    const permissions = this.getUserTeamPermissions(userId, teamId);
    return permissions.includes(permissionCode);
  }

  /**
   * 判断用户是否为超级管理员
   * @param {string} userId
   * @returns {boolean}
   */
  isSuperAdmin(userId) {
    const roles = this.getUserGlobalRoles(userId);
    return roles.some(r => r.code === 'super_admin');
  }

  /**
   * 获取用户数据范围
   * @param {string} userId
   * @returns {string} all/dept/self/custom
   */
  getUserDataScope(userId) {
    const roles = this.getUserGlobalRoles(userId);
    const scopePriority = { all: 4, dept: 3, self: 2, custom: 1 };
    let dataScope = 'self';

    for (const role of roles) {
      if ((scopePriority[role.data_scope] || 0) > (scopePriority[dataScope] || 0)) {
        dataScope = role.data_scope;
      }
    }

    return dataScope;
  }

  /**
   * 清除用户缓存 (角色变更时调用)
   * @param {string} userId
   */
  clearUserCache(userId) {
    this.globalPermissions.delete(userId);
    this.userRoles.delete(userId);

    for (const key of this.teamPermissions.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this.teamPermissions.delete(key);
      }
    }

    logger.debug('权限缓存已清除', {
      action: 'permission.cache.clear_user',
      userId,
    });
  }

  /**
   * 清除 Team 缓存 (Team 角色变更时调用)
   * @param {string} teamId
   */
  clearTeamCache(teamId) {
    for (const key of this.teamPermissions.keys()) {
      if (key.endsWith(`:${teamId}`)) {
        this.teamPermissions.delete(key);
      }
    }
  }

  /**
   * 清除全部缓存
   */
  clearAll() {
    this.globalPermissions.clear();
    this.teamPermissions.clear();
    this.userRoles.clear();
    logger.debug('权限缓存已全部清除', {
      action: 'permission.cache.clear_all',
    });
  }
}

module.exports = new PermissionCache();
