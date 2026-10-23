/** 在任何驱动打开数据库之前处理旧库路径；显式 DB_PATH 永不搬动其他库。 */
const fs = require('node:fs');
const path = require('node:path');

function prepareDatabasePath(dbPath, { rootDir = path.resolve(__dirname, '../../..'), explicit = Boolean(process.env.DB_PATH) } = {}) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (explicit) return;
  const legacy = path.join(rootDir, 'taskflow.db');
  if (legacy === dbPath || !fs.existsSync(legacy)) return;
  if (fs.existsSync(dbPath)) {
    throw new Error('同时存在旧库与目标库，请核对备份并显式指定 DB_PATH，禁止自动选择或合并');
  }
  for (const suffix of ['', '-wal', '-shm']) {
    if (fs.existsSync(`${legacy}${suffix}`)) fs.renameSync(`${legacy}${suffix}`, `${dbPath}${suffix}`);
  }
}

module.exports = { prepareDatabasePath };
