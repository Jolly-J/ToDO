/** SQLite 快照与附件配套备份；恢复仅写入全新目录并重定位绝对附件路径。 */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('better-sqlite3');

function hash(filename) {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    if (!fs.fstatSync(fd).isFile()) throw new Error('备份内容必须为普通文件');
    const digest = crypto.createHash('sha256');
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytes;
    while ((bytes = fs.readSync(fd, buffer, 0, buffer.length, null)) > 0) digest.update(buffer.subarray(0, bytes));
    return digest.digest('hex');
  } finally { fs.closeSync(fd); }
}

function requireNewDirectory(dir) {
  if (fs.existsSync(dir)) throw new Error('目标目录已存在，禁止覆盖备份或恢复结果');
  fs.mkdirSync(dir, { recursive: true });
}

async function backupBundle(db, dir, resourceDirs = {}) {
  requireNewDirectory(dir);
  const database = path.join(dir, 'taskflow.db');
  await db.backup(database);
  const snapshot = new Database(database, { readonly: true });
  const manifest = { version: 1, database: 'taskflow.db', files: [], resources: [] };
  try {
    if (snapshot.pragma('integrity_check', { simple: true }) !== 'ok' || snapshot.pragma('foreign_key_check').length) throw new Error('备份数据库一致性检查失败');
    for (const table of ['task_attachments', 'comment_attachments']) {
      for (const row of snapshot.prepare(`SELECT id, physical_path FROM ${table}`).all()) {
        // 旧的非物理附件不凭空生成文件；有物理路径但文件缺失则明确失败。
        if (!row.physical_path) continue;
        const relative = `attachments/${manifest.files.length}`;
        const destination = path.join(dir, relative);
        fs.mkdirSync(path.dirname(destination), { recursive: true });
        const beforeHash = hash(row.physical_path);
        fs.copyFileSync(row.physical_path, destination, fs.constants.COPYFILE_EXCL);
        if (hash(destination) !== beforeHash || hash(row.physical_path) !== beforeHash) throw new Error('备份时附件发生变化，请暂停写入后重试');
        manifest.files.push({ table, id: row.id, originalPath: row.physical_path, file: relative, sha256: beforeHash });
      }
    }
    for (const [name, source] of Object.entries(resourceDirs)) {
      if (!['broadcast-pages', 'rich-text-images'].includes(name)) throw new Error('不支持的资源目录');
      if (!fs.existsSync(source)) continue;
      if (fs.lstatSync(source).isSymbolicLink()) throw new Error('资源目录包含符号链接，请人工核对');
      fs.cpSync(source, path.join(dir, name), { recursive: true, errorOnExist: true, force: false });
      const visit = subdir => {
        if (fs.lstatSync(subdir).isSymbolicLink()) throw new Error('资源目录包含符号链接，请人工核对');
        for (const entry of fs.readdirSync(subdir, { withFileTypes: true })) {
          const filename = path.join(subdir, entry.name);
          if (entry.isSymbolicLink()) throw new Error('资源目录包含符号链接，请人工核对');
          if (entry.isDirectory()) visit(filename);
          else manifest.resources.push({ file: path.relative(dir, filename), sha256: hash(filename) });
        }
      };
      visit(path.join(dir, name));
    }
    manifest.databaseSha256 = hash(database);
    fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify(manifest, null, 2), { flag: 'wx' });
    return manifest;
  } finally { snapshot.close(); }
}

function safePath(base, relative) {
  if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.split('/').some(part => !part || part === '.' || part === '..')) throw new Error('备份路径越界');
  const filename = path.resolve(base, relative);
  if (!filename.startsWith(`${base}${path.sep}`)) throw new Error('备份路径越界');
  return filename;
}

function assertRegularFile(base, filename) {
  const relative = path.relative(base, filename);
  let current = base;
  for (const part of relative.split(path.sep)) {
    current = path.join(current, part);
    if (fs.lstatSync(current).isSymbolicLink()) throw new Error('备份或恢复路径包含符号链接');
  }
  if (!fs.statSync(filename).isFile() || fs.realpathSync(filename) !== filename) throw new Error('文件路径不安全');
}

function restoreBundle(source, destination) {
  const sourceRoot = fs.realpathSync(source);
  const manifestPath = path.join(sourceRoot, 'manifest.json');
  assertRegularFile(sourceRoot, manifestPath);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  if (manifest.version !== 1 || manifest.database !== 'taskflow.db' || !Array.isArray(manifest.files) || !Array.isArray(manifest.resources)) throw new Error('备份清单格式不支持');
  const database = safePath(sourceRoot, manifest.database);
  const files = [{ file: manifest.database, sha256: manifest.databaseSha256 }, ...manifest.files, ...manifest.resources];
  const paths = new Set(['manifest.json']);
  for (const entry of files) {
    if (!entry || typeof entry.sha256 !== 'string' || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('备份哈希格式不合法');
    const filename = safePath(sourceRoot, entry.file);
    if (paths.has(entry.file)) throw new Error('备份文件路径重复');
    paths.add(entry.file);
    assertRegularFile(sourceRoot, filename);
    if (hash(filename) !== entry.sha256) throw new Error('备份文件校验失败');
  }
  const snapshot = new Database(database, { readonly: true, fileMustExist: true });
  try {
    const required = new Map();
    for (const table of ['task_attachments', 'comment_attachments']) {
      for (const row of snapshot.prepare(`SELECT id, physical_path FROM ${table} WHERE physical_path IS NOT NULL AND physical_path != ''`).all()) required.set(`${table}:${row.id}`, row.physical_path);
    }
    const matched = new Set();
    for (const entry of manifest.files) {
      if (!['task_attachments', 'comment_attachments'].includes(entry.table) || typeof entry.id !== 'string' || !/^attachments\/[0-9]+$/.test(entry.file)) throw new Error('附件清单格式不合法');
      const key = `${entry.table}:${entry.id}`;
      if (matched.has(key)) throw new Error('附件清单记录重复');
      if (!required.has(key) || required.get(key) !== entry.originalPath) throw new Error('附件记录与清单不一致');
      matched.add(key);
    }
    if (matched.size !== required.size) throw new Error('附件清单遗漏数据库中的物理文件记录');
    for (const entry of manifest.resources) if (!/^(broadcast-pages|rich-text-images)\//.test(entry.file)) throw new Error('资源清单格式不合法');
    if (snapshot.pragma('foreign_key_check').length || snapshot.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('备份数据库一致性检查失败');
  } finally { snapshot.close(); }

  // 完整性与覆盖率验证全部通过后才建立恢复目录。
  requireNewDirectory(destination);
  const destinationRoot = fs.realpathSync(destination);
  const stagedDatabase = path.join(destinationRoot, 'restore-in-progress.db');
  for (const entry of files) {
    const filename = entry.file === manifest.database ? stagedDatabase : safePath(destinationRoot, entry.file);
    fs.mkdirSync(path.dirname(filename), { recursive: true });
    fs.copyFileSync(safePath(sourceRoot, entry.file), filename, fs.constants.COPYFILE_EXCL);
    assertRegularFile(destinationRoot, filename);
    if (hash(filename) !== entry.sha256) throw new Error('恢复复制时备份内容发生变化');
  }
  const db = new Database(stagedDatabase);
  try {
    db.pragma('foreign_keys = ON');
    db.transaction(() => {
      for (const entry of manifest.files) {
        const changed = db.prepare(`UPDATE ${entry.table} SET physical_path = ? WHERE id = ? AND physical_path = ?`)
          .run(safePath(destinationRoot, entry.file), entry.id, entry.originalPath);
        if (changed.changes !== 1) throw new Error('附件记录与清单不一致');
      }
      // 不允许任何有物理文件的附件保留原库绝对路径，避免后续清理误触源文件。
      for (const table of ['task_attachments', 'comment_attachments']) {
        for (const row of db.prepare(`SELECT physical_path FROM ${table} WHERE physical_path IS NOT NULL AND physical_path != ''`).all()) {
          if (!row.physical_path.startsWith(`${destinationRoot}${path.sep}`)) throw new Error('恢复附件路径越界');
          assertRegularFile(destinationRoot, row.physical_path);
        }
      }
      if (db.pragma('foreign_key_check').length || db.pragma('integrity_check', { simple: true }) !== 'ok') throw new Error('恢复一致性检查失败');
    })();
  } finally { db.close(); }
  // 不在验证完成前产生可用的 taskflow.db；link 的排他创建也不会覆盖并发新建文件。
  const finalDatabase = path.join(destinationRoot, manifest.database);
  fs.linkSync(stagedDatabase, finalDatabase);
  fs.unlinkSync(stagedDatabase);
  return finalDatabase;
}

module.exports = { backupBundle, restoreBundle, hash };
