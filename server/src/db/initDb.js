/**
 * 数据库初始化入口
 *
 * 流程：
 * 1. 执行 Knex 数据库迁移（建表、索引、增量变更）
 * 2. 执行角色与权限种子数据
 * 3. 执行业务示例数据（开发环境）
 */

const { getDb } = require('./sqlite');
const { runMigrations, closeKnex } = require('./migrationRunner');
const { seedRoles } = require('./seedRoles');
const { seedDatabase } = require('./seed');
const logger = require('../utils/logger');

let initialized = false;

/**
 * 初始化数据库
 *
 * @returns {Promise<object>} SQLite 数据库实例
 */
async function initDb() {
  if (initialized) {
    return getDb();
  }

  // 1. 执行数据库迁移
  const migrationResult = await runMigrations();

  if (!migrationResult.success) {
    logger.error('数据库迁移失败，服务启动终止', {
      action: 'system.db.init',
      error: migrationResult.error?.message,
    });
    throw migrationResult.error;
  }

  // 关闭 Knex 连接（释放 sqlite3 驱动）
  await closeKnex();

  // 2. 获取 better-sqlite3 实例（业务代码使用同步 API）
  const db = getDb();

  // 3. 角色与权限种子数据
  seedRoles(db);

  // 4. 业务示例数据 (开发环境)
  // seedDatabase(db);

  initialized = true;

  logger.debug('数据库初始化完成', {
    action: 'system.db.init',
    migrations: migrationResult.executed.length,
    skipped: migrationResult.skipped.length,
  });

  return db;
}

/**
 * 同步获取数据库实例（兼容旧代码）
 * 仅在已初始化后可用
 */
function getDbSync() {
  if (!initialized) {
    throw new Error('数据库尚未初始化，请先调用 initDb()');
  }
  return getDb();
}

module.exports = {
  initDb,
  getDbSync,
};