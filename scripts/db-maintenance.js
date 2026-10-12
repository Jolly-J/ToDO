#!/usr/bin/env node

/**
 * TaskFlow 数据库与承载页资源备份流水线。
 * 支持 SQLite 安全热备，并同步归档 ActionCard 宣传承载页。
 */

const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../server/src/db/sqlite');

// 设置环境，加载环境变量
const rootDir = path.resolve(__dirname, '..');
try {
  require(path.join(rootDir, 'server/src/bootstrap/env')).loadEnv();
} catch (e) {
  console.warn('⚠️ 环境变量加载失败，使用默认配置备份。');
}

const dbPath = process.env.DB_PATH 
  ? path.resolve(rootDir, process.env.DB_PATH) 
  : path.join(rootDir, 'server', 'data', 'taskflow.db');

const backupDir = path.join(rootDir, 'server', 'data', 'backups');
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir, { recursive: true });
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const backupPath = path.join(backupDir, `taskflow-backup-${timestamp}.db`);
const broadcastPagesDir = path.join(rootDir, 'server', 'data', 'broadcast-pages');
const broadcastBackupPath = path.join(backupDir, `broadcast-pages-backup-${timestamp}.tar.gz`);

function backupBroadcastPages() {
  if (!fs.existsSync(broadcastPagesDir)) {
    console.log('ℹ️  未发现宣传承载页目录，跳过资源归档。');
    return null;
  }
  const result = spawnSync('tar', [
    '-czf',
    broadcastBackupPath,
    '-C',
    path.dirname(broadcastPagesDir),
    path.basename(broadcastPagesDir),
  ], { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(result.stderr || '宣传承载页归档失败');
  }
  console.log(`✅ 承载页资源备份成功: ${broadcastBackupPath}`);
  return broadcastBackupPath;
}

console.log('── TaskFlow 数据库维护工具 ──');
console.log(`📌 当前库路径: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
  console.error('❌ 数据库文件不存在，取消备份。');
  process.exit(1);
}

// 1. 在线安全备份 (使用 better-sqlite3 提供的 backup)
console.log('\n📦 正在执行 SQLite 热备份...');
try {
  const db = getDb();
  db.backup(backupPath).then(() => {
    console.log(`✅ 备份成功: ${backupPath}`);

    console.log('\n📦 正在归档宣传承载页资源...');
    backupBroadcastPages();
    
    // 2. 健康检查 (PRAGMA integrity_check)
    console.log('\n🛠️  执行完整性检查...');
    const result = db.prepare('PRAGMA integrity_check').get();
    if (result.integrity_check === 'ok') {
      console.log('✅ 数据库完整性检查通过！');
    } else {
      console.error('❌ 数据库可能损坏:', result.integrity_check);
    }
    
    console.log('\n🎉 所有维护任务已完成！');
    process.exit(0);
  }).catch((err) => {
    console.error('❌ 备份失败:', err);
    process.exit(1);
  });
} catch (e) {
  console.error('❌ 执行失败:', e);
  process.exit(1);
}
