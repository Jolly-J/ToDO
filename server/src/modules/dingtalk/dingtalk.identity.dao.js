/**
 * 钉钉身份映射 DAO
 *
 * 封装 user_identities 表查询，提供系统 userId → 钉钉 unionId 的映射能力。
 * 通知渠道适配器在发送前需要先将系统用户 ID 转换为钉钉身份标识。
 */

const { getDb } = require('../../db/sqlite');
const logger = require('../../utils/logger');

/**
 * 根据系统 userId 获取钉钉身份
 * @param {string} userId
 * @returns {{ unionId: string|null, providerUserId: string|null } | null}
 */
function getIdentityByUserId(userId) {
  if (!userId) return null;
  const row = getDb().prepare(
    "SELECT unionid, provider_userid FROM user_identities WHERE user_id = ? AND provider = 'dingtalk' LIMIT 1"
  ).get(userId);
  if (!row) {
    return null;
  }

  return {
    unionId: row.unionid || null,
    providerUserId: row.provider_userid || null,
  };
}

/**
 * 根据系统 userId 获取钉钉 unionId
 * @param {string} userId
 * @returns {string|null}
 */
function getUnionIdByUserId(userId) {
  return getIdentityByUserId(userId)?.unionId || null;
}

/**
 * 批量获取钉钉身份
 * @param {string[]} userIds
 * @returns {Map<string, { unionId: string|null, providerUserId: string|null }>} userId → identity
 */
function getIdentitiesByUserIds(userIds) {
  const result = new Map();
  if (!userIds?.length) return result;

  const db = getDb();
  const placeholders = userIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT user_id, unionid, provider_userid FROM user_identities WHERE user_id IN (${placeholders}) AND provider = 'dingtalk'`
  ).all(...userIds);

  for (const row of rows) {
    if (row.unionid || row.provider_userid) {
      result.set(row.user_id, {
        unionId: row.unionid || null,
        providerUserId: row.provider_userid || null,
      });
    }
  }

  if (result.size < userIds.length) {
    const missing = userIds.filter(id => !result.has(id));
    logger.warn('部分用户缺少钉钉身份映射', {
      action: 'dingtalk.identity.missing',
      missingCount: missing.length,
      missingUserIds: missing.slice(0, 5),
    });
  }

  return result;
}

/**
 * 批量获取钉钉 unionId
 * @param {string[]} userIds
 * @returns {Map<string, string>} userId → unionId
 */
function getUnionIdsByUserIds(userIds) {
  const identityMap = getIdentitiesByUserIds(userIds);
  const result = new Map();

  for (const [userId, identity] of identityMap.entries()) {
    if (identity.unionId) {
      result.set(userId, identity.unionId);
    }
  }

  return result;
}

/**
 * 根据钉钉 providerUserId 批量反查系统用户 ID
 * @param {string[]} providerUserIds
 * @returns {Map<string, string>} providerUserId → userId
 */
function getUserIdsByProviderUserIds(providerUserIds) {
  const result = new Map();
  if (!providerUserIds?.length) return result;

  const db = getDb();
  const placeholders = providerUserIds.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT user_id, provider_userid FROM user_identities WHERE provider_userid IN (${placeholders}) AND provider = 'dingtalk'`
  ).all(...providerUserIds);

  for (const row of rows) {
    if (row.provider_userid) {
      result.set(row.provider_userid, row.user_id);
    }
  }
  return result;
}

module.exports = {
  getIdentityByUserId,
  getIdentitiesByUserIds,
  getUserIdsByProviderUserIds,
  getUnionIdByUserId,
  getUnionIdsByUserIds,
};
