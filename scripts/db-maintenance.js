#!/usr/bin/env node

/**
 * TaskFlow 数据库与承载页资源备份流水线。
 * 保存 SQLite 快照、普通附件、富文本图片与宣传承载页；要求维护窗口暂停写入。
 */

const fs = require('node:fs');
const path = require('node:path');
const { getDb } = require('../server/src/db/sqlite');
const { createConfig } = require('../server/src/config');
const { backupBundle } = require('../server/src/db/backupBundle');

async function main() {
  const rootDir = path.resolve(__dirname, '..');
  const { dbPath } = createConfig();
  if (!fs.existsSync(dbPath)) throw new Error('数据库文件不存在，取消备份');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const target = path.join(rootDir, 'server/data/backups', `taskflow-${timestamp}`);
  console.log('请先暂停业务写入及附件清理；本工具不停止服务。');
  await backupBundle(getDb(), target, {
    'broadcast-pages': path.join(rootDir, 'server/data/broadcast-pages'),
    'rich-text-images': path.join(rootDir, 'server/data/rich-text-images'),
  });
  console.log(`数据库、普通附件及资源清单备份完成: ${target}`);
}

if (require.main === module) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { main };
