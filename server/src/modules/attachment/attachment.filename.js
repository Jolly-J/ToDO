/**
 * 附件文件名工具
 *
 * 负责修正上传文件名编码并生成安全的下载响应头。
 */
const path = require('node:path');

function looksLikeLatin1Mojibake(name) {
  return /[ÃÂâäåæçéèêëïîìôöûüÿ]/.test(name) || /(?:ä¸|æ|ç|é|å)/.test(name);
}

function normalizeUploadedOriginalName(name) {
  if (!name || typeof name !== 'string') {
    return '';
  }

  const sanitizedName = path.basename(name).replace(/\0/g, '').trim();

  if (!sanitizedName || /^[\x00-\x7F]+$/.test(sanitizedName)) {
    return sanitizedName;
  }

  if (!looksLikeLatin1Mojibake(sanitizedName)) {
    return sanitizedName;
  }

  const decodedName = Buffer.from(sanitizedName, 'latin1').toString('utf8');

  if (decodedName && /[\u3400-\u9fff]/.test(decodedName)) {
    return decodedName;
  }

  return sanitizedName;
}

function normalizeAttachmentRecord(attachment) {
  if (!attachment) {
    return attachment;
  }

  return {
    ...attachment,
    original_name: normalizeUploadedOriginalName(attachment.original_name || ''),
  };
}

function toAsciiFallback(name) {
  const normalizedName = normalizeUploadedOriginalName(name || '') || 'attachment';
  const ext = path.extname(normalizedName);
  const base = path.basename(normalizedName, ext)
    .replace(/[^\x20-\x7E]+/g, '_')
    .replace(/["\\;]/g, '_')
    .trim();

  return `${base || 'attachment'}${ext}`;
}

function buildAttachmentContentDisposition(name) {
  const normalizedName = normalizeUploadedOriginalName(name || '') || 'attachment';
  const fallback = toAsciiFallback(normalizedName);

  return `attachment; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(normalizedName)}`;
}

module.exports = {
  buildAttachmentContentDisposition,
  normalizeAttachmentRecord,
  normalizeUploadedOriginalName,
};
