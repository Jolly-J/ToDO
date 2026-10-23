/** 上传限额及授权：路由已知任务先验权；body 任务限额缓冲后验权才落盘。 */
const fs = require('node:fs');
const path = require('node:path');
const { Transform } = require('node:stream');
const { createUploader } = require('../../middlewares/upload');
const { generateId } = require('../../utils/uuid');
const { assertTaskWritable } = require('./attachment.access');

const MAX_BUFFERED_UPLOADS = 2;
let bufferedUploads = 0;

function parseBounded(req, res, parse, maxBytes, next) {
  const tooLarge = () => Object.assign(new Error('上传请求超过总大小限制'), { status: 413, code: 41301 });
  if (Number(req.headers['content-length']) > maxBytes) return next(tooLarge());
  let bytes = 0;
  const bounded = new Transform({ transform(chunk, encoding, done) {
    bytes += chunk.length;
    done(bytes > maxBytes ? tooLarge() : null, bytes > maxBytes ? undefined : chunk);
  } });
  bounded.headers = req.headers;
  bounded.method = req.method;
  bounded.user = req.user;
  bounded.params = req.params;
  const failed = err => bounded.destroy(err instanceof Error ? err : new Error('上传请求已中断'));
  req.once('aborted', failed);
  req.once('error', failed);
  bounded.once('error', () => { req.unpipe(bounded); req.resume(); });
  parse(bounded, res, err => {
    req.removeListener('aborted', failed);
    req.removeListener('error', failed);
    req.body = bounded.body;
    req.file = bounded.file;
    req.files = bounded.files;
    if (typeof err?.code === 'string' && err.code.startsWith('LIMIT_')) err.status = 413;
    next(err);
  });
  req.pipe(bounded);
}

function authorizedTaskUpload({ dest = 'server/data/attachments', taskParam, multiple = false } = {}) {
  // URL 上已有任务 ID 时，授权早于读取任何 multipart 内容，授权后直接流式写盘。
  const uploader = createUploader({ memory: !taskParam, dest });
  const parse = multiple ? uploader.array('files', 5) : uploader.single('file');
  return (req, res, next) => {
    if (taskParam) {
      try { assertTaskWritable(req.params[taskParam], req.user?.id); }
      catch (err) { return next(err); }
    } else {
      if (bufferedUploads >= MAX_BUFFERED_UPLOADS) return next(Object.assign(new Error('同时上传请求过多，请稍后重试'), { status: 429 }));
      bufferedUploads++;
    }
    const maxBytes = (multiple ? 51 : 11) * 1024 * 1024;
    parseBounded(req, res, parse, maxBytes, error => {
      if (!taskParam) bufferedUploads--;
      if (error) return next(error);
      const files = multiple ? (req.files || []) : (req.file ? [req.file] : []);
      try {
        const taskId = taskParam ? req.params[taskParam] : req.body?.taskId;
        assertTaskWritable(taskId, req.user?.id);
        if (!taskParam) {
          const now = new Date();
          const dir = path.resolve(__dirname, '../../../..', dest, `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
          if (files.length) fs.mkdirSync(dir, { recursive: true });
          for (const file of files) {
            file.filename = `${generateId()}${path.extname(file.originalname).toLowerCase()}`;
            file.path = path.join(dir, file.filename);
            fs.writeFileSync(file.path, file.buffer, { flag: 'wx' });
            delete file.buffer;
          }
        }
        next();
      } catch (err) {
        for (const file of files) {
          if (file.path && fs.existsSync(file.path)) fs.unlinkSync(file.path);
          delete file.buffer;
        }
        next(err);
      }
    });
  };
}

module.exports = { authorizedTaskUpload, parseBounded };
