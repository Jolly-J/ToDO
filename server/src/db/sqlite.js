/**
 * SQLite 连接单例
 *
 * 负责初始化数据库文件、迁移旧库位置并返回全局 `better-sqlite3` 实例。
 */
const Database = require('better-sqlite3');
const { createConfig } = require('../config');
const { prepareDatabasePath } = require('./databasePath');

let dbInstance = null;

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const config = createConfig();
  const dbFilePath = config.dbPath;
  prepareDatabasePath(dbFilePath);

  dbInstance = new Database(dbFilePath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

module.exports = {
  getDb,
};
