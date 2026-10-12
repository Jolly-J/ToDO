/**
 * Knex 数据库迁移运行器
 *
 * 功能特性：
 * - 启动时自动执行待执行的迁移
 * - 详细日志记录每个迁移的执行状态
 * - 错误处理与回滚支持
 */

const knex = require('knex');
const knexConfig = require('../../knexfile');
const logger = require('../utils/logger');
const path = require('node:path');
const fs = require('node:fs');

let knexInstance = null;

/**
 * 获取 Knex 实例（单例）
 */
function getKnex() {
  if (!knexInstance) {
    knexInstance = knex(knexConfig);
  }
  return knexInstance;
}

/**
 * 关闭 Knex 连接
 */
async function closeKnex() {
  if (knexInstance) {
    await knexInstance.destroy();
    knexInstance = null;
  }
}

/**
 * 获取迁移文件列表
 */
function getMigrationFiles() {
  const migrationsDir = knexConfig.migrations.directory;
  if (!fs.existsSync(migrationsDir)) {
    return [];
  }
  return fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js'))
    .sort();
}

/**
 * 获取已执行的迁移列表
 */
async function getCompletedMigrations() {
  const knex = getKnex();
  const tableName = knexConfig.migrations.tableName;

  // 确保 migrations 表存在
  const hasTable = await knex.schema.hasTable(tableName);
  if (!hasTable) {
    return [];
  }

  const rows = await knex(tableName).select('name').orderBy('id');
  return rows.map(r => r.name);
}

/**
 * 执行数据库迁移
 *
 * @returns {Promise<{success: boolean, executed: string[], skipped: string[], error?: Error}>}
 */
async function runMigrations() {
  logger.debug('开始执行数据库迁移', { action: 'db.migration.start' });

  const result = {
    success: false,
    executed: [],
    skipped: [],
    error: null,
  };

  try {
    const knex = getKnex();

    // 获取所有迁移文件和已执行的迁移
    const allFiles = getMigrationFiles();
    const completed = await getCompletedMigrations();

    // 找出待执行的迁移
    const pending = allFiles.filter(f => !completed.includes(f));

    if (pending.length === 0) {
      logger.debug('数据库迁移无需执行', {
        action: 'db.migration.skip',
        total: allFiles.length,
        completed: completed.length,
      });
      result.success = true;
      result.skipped = allFiles;
      return result;
    }

    // 执行迁移
    logger.debug('发现待执行迁移文件', {
      action: 'db.migration.start',
      pending: pending.length,
      files: pending,
    });

    // 使用 knex 的 latest 方法执行所有待执行的迁移
    const [batchNo, migrations] = await knex.migrate.latest();

    for (const migration of migrations) {
      const fileName = migration.name || migration.file || migration;
      logger.debug('迁移文件执行成功', {
        action: 'db.migration.file',
        file: fileName,
        batch: batchNo,
      });
      result.executed.push(fileName);
    }

    logger.debug('数据库迁移完成', {
      action: 'db.migration.complete',
      executed: result.executed.length,
      batch: batchNo,
    });

    result.success = true;
    return result;
  } catch (err) {
    logger.error('数据库迁移失败', {
      action: 'db.migration.error',
      error: { message: err.message, stack: err.stack },
    });
    result.error = err;
    return result;
  }
}

/**
 * 回滚最后一次迁移
 *
 * @returns {Promise<{success: boolean, rolledBack: string[], error?: Error}>}
 */
async function rollbackMigration() {
  logger.info('开始回滚数据库迁移', { action: 'db.migration.rollback' });

  const result = {
    success: false,
    rolledBack: [],
    error: null,
  };

  try {
    const knex = getKnex();
    const [batchNo, migrations] = await knex.migrate.rollback();

    if (!migrations || migrations.length === 0) {
      logger.info('无需回滚', { action: 'db.migration.rollback' });
      result.success = true;
      return result;
    }

    for (const migration of migrations) {
      const fileName = migration.name || migration.file || migration;
      logger.info('迁移文件已回滚', {
        action: 'db.migration.rollback',
        file: fileName,
      });
      result.rolledBack.push(fileName);
    }

    logger.info('数据库迁移回滚完成', {
      action: 'db.migration.rollback',
      rolledBack: result.rolledBack.length,
    });

    result.success = true;
    return result;
  } catch (err) {
    logger.error('数据库迁移回滚失败', {
      action: 'db.migration.error',
      error: { message: err.message, stack: err.stack },
    });
    result.error = err;
    return result;
  }
}

/**
 * 获取迁移状态
 */
async function getMigrationStatus() {
  const allFiles = getMigrationFiles();
  const completed = await getCompletedMigrations();
  const pending = allFiles.filter(f => !completed.includes(f));

  return {
    total: allFiles.length,
    completed: completed.length,
    pending: pending.length,
    completedList: completed,
    pendingList: pending,
  };
}

module.exports = {
  runMigrations,
  rollbackMigration,
  getMigrationStatus,
  getKnex,
  closeKnex,
};