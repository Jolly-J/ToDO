/**
 * 用户身份映射 DAO
 *
 * 管理 user_identities 表
 * 用于统一浏览器扫码和钉钉内免登的身份映射
 */

const { getDb } = require('./sqlite');
const { generateId } = require('../utils/uuid');
const { nowIso } = require('../utils/datetime');

/**
 * 通过 provider + unionid 查找身份
 * @param {string} provider
 * @param {string} unionid
 * @returns {object|null}
 */
function findByUnionId(provider, unionid) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM user_identities WHERE provider = ? AND unionid = ?'
  ).get(provider, unionid) || null;
}

/**
 * 通过 provider + 第三方 userId 查找身份
 * @param {string} provider
 * @param {string} providerUserId
 * @returns {object|null}
 */
function findByProviderUserId(provider, providerUserId) {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM user_identities WHERE provider = ? AND provider_userid = ?'
  ).get(provider, providerUserId) || null;
}

/**
 * 通过 userId 查找身份
 * @param {string} userId
 * @param {string} [provider='dingtalk']
 * @returns {object|null}
 */
function findByUserId(userId, provider = 'dingtalk') {
  const db = getDb();
  return db.prepare(
    'SELECT * FROM user_identities WHERE user_id = ? AND provider = ?'
  ).get(userId, provider) || null;
}

/**
 * UPSERT 身份映射
 * @param {{ user_id: string, provider?: string, provider_userid?: string, unionid?: string, openid?: string, raw_profile_json?: string }} data
 * @returns {object}
 */
function upsertIdentity(data) {
  const db = getDb();
  const stamp = nowIso();
  const provider = data.provider || 'dingtalk';
  const existing = findByUserId(data.user_id, provider);

  if (existing) {
    db.prepare(`
      UPDATE user_identities SET
        provider_userid = COALESCE(@provider_userid, provider_userid),
        unionid = COALESCE(@unionid, unionid),
        openid = COALESCE(@openid, openid),
        raw_profile_json = COALESCE(@raw_profile_json, raw_profile_json),
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: existing.id,
      provider_userid: data.provider_userid ?? null,
      unionid: data.unionid ?? null,
      openid: data.openid ?? null,
      raw_profile_json: data.raw_profile_json ?? null,
      updated_at: stamp,
    });

    return db.prepare('SELECT * FROM user_identities WHERE id = ?').get(existing.id);
  }

  const id = generateId();
  db.prepare(`
    INSERT INTO user_identities (id, user_id, provider, provider_userid, unionid, openid, raw_profile_json, created_at, updated_at)
    VALUES (@id, @user_id, @provider, @provider_userid, @unionid, @openid, @raw_profile_json, @created_at, @updated_at)
  `).run({
    id,
    user_id: data.user_id,
    provider,
    provider_userid: data.provider_userid || data.user_id,
    unionid: data.unionid || null,
    openid: data.openid || null,
    raw_profile_json: data.raw_profile_json || null,
    created_at: stamp,
    updated_at: stamp,
  });

  return db.prepare('SELECT * FROM user_identities WHERE id = ?').get(id);
}

module.exports = {
  findByUnionId,
  findByProviderUserId,
  findByUserId,
  upsertIdentity,
};
