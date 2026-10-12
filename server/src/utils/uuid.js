/**
 * UUID 生成工具
 *
 * 使用 Node.js 内置 crypto 模块
 */

const { randomUUID } = require('node:crypto');

/**
 * 生成 UUID v4
 * @returns {string}
 */
function generateId() {
  return randomUUID();
}

/**
 * 生成带前缀的 ID
 * @param {string} prefix - 前缀 (如 'gr', 'tr', 'ugr')
 * @returns {string}
 */
function generatePrefixedId(prefix) {
  return `${prefix}-${randomUUID()}`;
}

module.exports = {
  generateId,
  generatePrefixedId,
};
