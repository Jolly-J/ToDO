/** 钉钉宣传承载页静态存储、ZIP 校验与原子替换。 */

const fs = require('node:fs');
const path = require('node:path');
const { Worker } = require('node:worker_threads');

const BROADCAST_PAGES_ROOT = process.env.BROADCAST_PAGES_ROOT
  ? path.resolve(process.env.BROADCAST_PAGES_ROOT)
  : path.resolve(__dirname, '..', '..', '..', 'data', 'broadcast-pages');
const MAX_ARCHIVE_ENTRIES = 1000;
const MAX_EXTRACTED_SIZE = 100 * 1024 * 1024;

function ensureBroadcastPagesDir() {
  fs.mkdirSync(BROADCAST_PAGES_ROOT, { recursive: true });
  return BROADCAST_PAGES_ROOT;
}

function assertBroadcastId(broadcastId) {
  const normalized = String(broadcastId || '');
  if (!/^broadcast-[a-zA-Z0-9-]+$/.test(normalized)) {
    const error = new Error('宣传页标识无效');
    error.status = 400;
    error.code = 40002;
    throw error;
  }
  return normalized;
}

function getBroadcastDir(broadcastId) {
  ensureBroadcastPagesDir();
  return path.join(BROADCAST_PAGES_ROOT, assertBroadcastId(broadcastId));
}

function findEntryHtml(dirPath) {
  const directIndex = path.join(dirPath, 'index.html');
  if (fs.existsSync(directIndex)) return directIndex;
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    if (item.isFile() && /\.html?$/i.test(item.name)) return path.join(dirPath, item.name);
  }
  for (const item of items) {
    if (item.isDirectory() && !item.name.startsWith('.') && item.name !== '__MACOSX') {
      const found = findEntryHtml(path.join(dirPath, item.name));
      if (found) return found;
    }
  }
  return null;
}

function createStagingDir(broadcastId) {
  ensureBroadcastPagesDir();
  return fs.mkdtempSync(path.join(BROADCAST_PAGES_ROOT, `.${assertBroadcastId(broadcastId)}-staging-`));
}

function createStorageError(message) {
  const error = new Error(message);
  error.status = 400;
  error.code = 40002;
  return error;
}

function validateArchiveEntries(entries) {
  if (entries.length > MAX_ARCHIVE_ENTRIES) {
    throw createStorageError(`压缩包文件数量不能超过${MAX_ARCHIVE_ENTRIES}个`);
  }
  let extractedSize = 0;
  for (const entry of entries) {
    const entryName = String(entry.entryName || '').replace(/\\/g, '/');
    const normalized = path.posix.normalize(entryName);
    if (entryName.includes('\0') || normalized.startsWith('../') || normalized === '..' || path.posix.isAbsolute(normalized)) {
      throw createStorageError('压缩包包含不安全的文件路径');
    }
    if (!entry.isDirectory) {
      extractedSize += Number(entry.header?.size || 0);
      if (extractedSize > MAX_EXTRACTED_SIZE) throw createStorageError('压缩包解压后不能超过100MB');
    }
  }
}

function validateExtractedTree(rootDir) {
  let entryCount = 0;
  let totalSize = 0;
  const pending = [rootDir];
  while (pending.length) {
    const current = pending.pop();
    for (const item of fs.readdirSync(current, { withFileTypes: true })) {
      const itemPath = path.join(current, item.name);
      const stat = fs.lstatSync(itemPath);
      if (stat.isSymbolicLink()) throw createStorageError('压缩包不能包含符号链接');
      if (stat.isDirectory()) {
        pending.push(itemPath);
      } else {
        entryCount += 1;
        totalSize += stat.size;
        if (entryCount > MAX_ARCHIVE_ENTRIES || totalSize > MAX_EXTRACTED_SIZE) {
          throw createStorageError('压缩包解压内容超过系统限制');
        }
      }
    }
  }
}

function moveEntryDirectoryToRoot(stagingDir, entryHtmlPath) {
  const entryDir = path.dirname(entryHtmlPath);
  if (entryDir === stagingDir) return entryHtmlPath;
  for (const item of fs.readdirSync(entryDir)) {
    const source = path.join(entryDir, item);
    const destination = path.join(stagingDir, item);
    if (fs.existsSync(destination)) throw createStorageError(`压缩包顶层存在重名文件：${item}`);
    fs.renameSync(source, destination);
  }
  return path.join(stagingDir, path.basename(entryHtmlPath));
}

function normalizeEntryHtml(stagingDir, entryHtmlPath) {
  const movedEntry = moveEntryDirectoryToRoot(stagingDir, entryHtmlPath);
  const topIndex = path.join(stagingDir, 'index.html');
  if (path.resolve(movedEntry) !== path.resolve(topIndex)) fs.copyFileSync(movedEntry, topIndex);
  return topIndex;
}

function prepareZipPackageSync(broadcastId, zipBuffer) {
  const stagingDir = createStagingDir(broadcastId);
  try {
    let AdmZip;
    try {
      // 按需加载：漏装依赖时只影响 ZIP 导入，不阻止整个服务启动。
      AdmZip = require('adm-zip');
    } catch (_error) {
      throw createStorageError('ZIP解析依赖未安装，请先在server目录安装生产依赖');
    }
    const zip = new AdmZip(zipBuffer);
    validateArchiveEntries(zip.getEntries());
    zip.extractAllTo(stagingDir, true);
    validateExtractedTree(stagingDir);
    const entryHtmlPath = findEntryHtml(stagingDir);
    if (!entryHtmlPath) throw createStorageError('压缩包内未找到 HTML 文件（建议命名为 index.html）');
    const topIndex = normalizeEntryHtml(stagingDir, entryHtmlPath);
    return { stagingDir, htmlContent: fs.readFileSync(topIndex, 'utf8') };
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

function prepareZipPackage(broadcastId, zipBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const worker = new Worker(path.join(__dirname, 'dingtalkBroadcast.archive.worker.js'), {
      workerData: { broadcastId, zipBuffer },
    });
    worker.once('message', (message) => {
      settled = true;
      if (message?.success) resolve(message.result);
      else reject(createStorageError(message?.error || '压缩包处理失败'));
    });
    worker.once('error', (error) => {
      settled = true;
      reject(error);
    });
    worker.once('exit', (code) => {
      if (!settled) reject(createStorageError(code === 0 ? '压缩包处理未返回结果' : '压缩包处理进程异常退出'));
    });
  });
}

async function prepareSingleHtml(broadcastId, htmlBuffer) {
  const stagingDir = createStagingDir(broadcastId);
  try {
    await fs.promises.writeFile(path.join(stagingDir, 'index.html'), htmlBuffer);
    return { stagingDir, htmlContent: htmlBuffer.toString('utf8') };
  } catch (error) {
    fs.rmSync(stagingDir, { recursive: true, force: true });
    throw error;
  }
}

function commitPreparedPackage(broadcastId, prepared, commitDatabase) {
  const targetDir = getBroadcastDir(broadcastId);
  const backupDir = `${targetDir}.backup-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let oldMoved = false;
  let newMoved = false;
  try {
    if (fs.existsSync(targetDir)) {
      fs.renameSync(targetDir, backupDir);
      oldMoved = true;
    }
    fs.renameSync(prepared.stagingDir, targetDir);
    newMoved = true;
    const result = commitDatabase();
    if (!result) throw createStorageError('宣传页草稿状态已变化，请刷新后重试');
    if (oldMoved) {
      try {
        fs.rmSync(backupDir, { recursive: true, force: true });
      } catch (_error) {
        // 新版本和数据库已经提交，遗留备份目录可由运维清理，不能反向破坏成功提交。
      }
    }
    return result;
  } catch (error) {
    if (newMoved && fs.existsSync(targetDir)) fs.rmSync(targetDir, { recursive: true, force: true });
    if (oldMoved && fs.existsSync(backupDir)) fs.renameSync(backupDir, targetDir);
    if (fs.existsSync(prepared.stagingDir)) fs.rmSync(prepared.stagingDir, { recursive: true, force: true });
    throw error;
  }
}

module.exports = {
  BROADCAST_PAGES_ROOT,
  MAX_ARCHIVE_ENTRIES,
  MAX_EXTRACTED_SIZE,
  commitPreparedPackage,
  getBroadcastDir,
  prepareSingleHtml,
  prepareZipPackage,
  prepareZipPackageSync,
  validateArchiveEntries,
};
