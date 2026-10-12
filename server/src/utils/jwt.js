/**
 * JWT 签发与验签工具
 *
 * 使用 jsonwebtoken，密钥从环境变量读取
 */

const jwt = require('jsonwebtoken');

const DEFAULT_EXPIRES_IN = '7d';

function getSecret() {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET 环境变量未设置');
  }
  return secret;
}

function getExpiresIn() {
  return process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;
}

/**
 * 签发 JWT
 * @param {{ id: string, name: string }} payload - 用户信息
 * @param {object} [options] - jsonwebtoken 选项
 * @returns {string} token
 */
function sign(payload, options = {}) {
  const tokenPayload = {
    sub: payload.id,
    name: payload.name,
  };

  return jwt.sign(tokenPayload, getSecret(), {
    expiresIn: getExpiresIn(),
    ...options,
  });
}

/**
 * 校验 JWT
 * @param {string} token
 * @returns {{ sub: string, name: string, iat: number, exp: number }}
 * @throws {Error} 无效或过期
 */
function verify(token) {
  return jwt.verify(token, getSecret());
}

/**
 * 从 Authorization header 提取 Bearer token
 * @param {string} authHeader - Authorization header 值
 * @returns {string|null}
 */
function extractBearerToken(authHeader) {
  if (!authHeader || typeof authHeader !== 'string') {
    return null;
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
}

module.exports = {
  sign,
  verify,
  extractBearerToken,
};
