/**
 * SQLite 连接单例
 *
 * 负责初始化数据库文件、迁移旧库位置并返回全局 `better-sqlite3` 实例。
 */
const fs = require('node:fs');
const path = require('node:path');
const Database = require('better-sqlite3');
const { createConfig } = require('../config');

let dbInstance = null;

function migrateLegacyDatabase(rootDir, dbFilePath) {
  const legacyBase = path.join(rootDir, 'taskflow.db');
  const targetBase = dbFilePath;

  if (legacyBase === targetBase) {
    return;
  }

  const targetExists = fs.existsSync(targetBase);
  const legacyExists = fs.existsSync(legacyBase);

  if (targetExists || !legacyExists) {
    return;
  }

  const suffixes = ['', '-wal', '-shm'];

  for (const suffix of suffixes) {
    const source = `${legacyBase}${suffix}`;
    const target = `${targetBase}${suffix}`;

    if (fs.existsSync(source) && !fs.existsSync(target)) {
      fs.renameSync(source, target);
    }
  }
}

function getDb() {
  if (dbInstance) {
    return dbInstance;
  }

  const config = createConfig();
  const rootDir = path.resolve(__dirname, '../../..');
  const dbFilePath = config.dbPath;
  const dbDir = path.dirname(dbFilePath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  migrateLegacyDatabase(rootDir, dbFilePath);

  dbInstance = new Database(dbFilePath);
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('foreign_keys = ON');
  dbInstance.pragma('synchronous = NORMAL');

  return dbInstance;
}

module.exports = {
  getDb,
};
