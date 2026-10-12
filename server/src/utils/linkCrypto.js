/**
 * 通知链接加密工具
 *
 * 使用 AES-256-GCM 对通知跳转链接中的 taskId、teamId 进行加密，
 * 防止用户通过篡改 URL 参数遍历他人任务。
 *
 * 密钥来源：环境变量 NOTIFICATION_LINK_SECRET（32 字节 hex）
 */

const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');
const logger = require('./logger');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * 获取加密密钥（32 字节）
 * @returns {Buffer}
 */
function getKey() {
  const secret = process.env.NOTIFICATION_LINK_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('NOTIFICATION_LINK_SECRET 未配置或长度不足 32 字符');
  }
  return Buffer.from(secret.slice(0, 32), 'utf8');
}

/**
 * 加密链接参数
 *
 * @param {object} payload - 需要加密的数据，如 { taskId, teamId }
 * @returns {string} Base64url 编码的加密 token
 */
function encryptLinkToken(payload) {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // 格式: iv(12) + authTag(16) + ciphertext
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return combined.toString('base64url');
}

/**
 * 解密链接 token
 *
 * @param {string} token - Base64url 编码的加密 token
 * @returns {object|null} 解密后的 payload，失败返回 null
 */
function decryptLinkToken(token) {
  try {
    const key = getKey();
    const combined = Buffer.from(token, 'base64url');

    if (combined.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
      return null;
    }

    const iv = combined.subarray(0, IV_LENGTH);
    const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
  } catch (error) {
    logger.warn('链接 token 解密失败', {
      action: 'link.decrypt.failed',
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  encryptLinkToken,
  decryptLinkToken,
};
