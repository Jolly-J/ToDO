/**
 * 附件上传中间件 (基于 multer)
 */

const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { generateId } = require('../utils/uuid');
const { normalizeUploadedOriginalName } = require('../modules/attachment/attachment.filename');

// 危险拓展名拦截列表
const DANGEROUS_EXTS = ['.exe', '.sh', '.bat', '.js', '.php', '.com', '.cmd', '.vbs', '.jsp', '.html'];

/**
 * 上传后安全验证（仅拦截危险扩展名，不做 Magic Bytes 检测）
 */
function validateUploadedFile(file) {
  file.originalname = normalizeUploadedOriginalName(file.originalname);
  const ext = path.extname(file.originalname).toLowerCase();
  if (ext === '' || DANGEROUS_EXTS.includes(ext)) {
    try { fs.unlinkSync(file.path); } catch (_) {}
    const err = new Error(`不支持的文件格式: ${ext || '无后缀'}`);
    err.code = 'INVALID_FILE_TYPE';
    return err;
  }
  return null;
}

function createUploader(options = {}) {
  const rootDir = path.resolve(__dirname, '../../..');
  const baseUploadDir = options.dest 
    ? path.resolve(rootDir, options.dest) 
    : path.join(rootDir, 'server', 'data', 'attachments');

  const storage = multer.diskStorage({
    destination: (req, _file, cb) => {
      // 动态依据年月创建子目录，如 2026-03
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const folder = path.join(baseUploadDir, `${year}-${month}`);

      fs.mkdir(folder, { recursive: true }, (err) => {
        if (err) return cb(err, folder);
        cb(null, folder);
      });
    },
    filename: (req, file, cb) => {
      file.originalname = normalizeUploadedOriginalName(file.originalname);
      // 抹除原名风险，使用完全随机 UUID 并保留安全扩展名
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, `${generateId()}${ext}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    file.originalname = normalizeUploadedOriginalName(file.originalname);
    // 处理文件扩展名安全
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '' || DANGEROUS_EXTS.includes(ext)) {
      const err = new Error(`不支持的文件格式: ${ext || '无后缀'}`);
      err.code = 'INVALID_FILE_TYPE';
      return cb(err, false);
    }
    cb(null, true);
  };

  return multer({
    storage,
    limits: {
      fileSize: 10 * 1024 * 1024, // 硬限制 10MB
      files: 5,                   // 单次最多 5 个文件
    },
    fileFilter,
  });
}

// 默认 10MB 带后缀校验的通用业务上传器
const upload = createUploader();

module.exports = {
  upload,
  createUploader,
  normalizeOriginalName: normalizeUploadedOriginalName,
  normalizeUploadedOriginalName,
  validateUploadedFile,
};
