/**
 * Knex 数据库迁移配置
 *
 * 配置说明：
 * - 使用 sqlite3 驱动执行迁移（knex 需要）
 * - 业务代码继续使用 better-sqlite3（同步）
 * - 迁移文件存放于 src/migrations/
 */

const path = require('node:path');
const { createConfig } = require('./src/config');

const config = createConfig();

module.exports = {
  client: 'sqlite3',
  connection: {
    filename: config.dbPath,
  },
  migrations: {
    directory: path.join(__dirname, 'src/migrations'),
    tableName: 'knex_migrations',
    loadExtensions: ['.js'],
    disableTransactions: true,
  },
  useNullAsDefault: true,
  pool: {
    afterCreate: (conn, cb) => {
      conn.run('PRAGMA foreign_keys = ON', cb);
    },
  },
};