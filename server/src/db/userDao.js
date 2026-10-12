/**
 * 用户 DAO — 正式持久化层
 *
 * 提供用户 CRUD、UPSERT、分页查询、状态管理
 * 全部使用 prepared statements
 */

const { getDb } = require('./sqlite');
const { generateId } = require('../utils/uuid');
const { nowIso } = require('../utils/datetime');

/**
 * 通过 ID 查找用户
 * @param {string} userId
 * @returns {object|null}
 */
function findById(userId) {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) || null;
}

/**
 * 通过 ID 列表批量查找用户
 * @param {string[]} userIds
 * @returns {object[]}
 */
function findByIds(userIds) {
  if (!userIds || userIds.length === 0) {
    return [];
  }

  const db = getDb();
  const placeholders = userIds.map(() => '?').join(', ');
  return db.prepare(`SELECT * FROM users WHERE id IN (${placeholders})`).all(...userIds);
}

/**
 * 分页查询用户列表
 * @param {{ keyword?: string, departmentId?: string, status?: number, page?: number, pageSize?: number }} filters
 * @returns {{ list: object[], total: number, page: number, pageSize: number }}
 */
function listUsers(filters = {}) {
  const db = getDb();
  const page = Math.max(1, Number(filters.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Number(filters.pageSize) || 20));
  const offset = (page - 1) * pageSize;

  const conditions = [];
  const params = [];

  if (filters.keyword) {
    conditions.push('(u.name LIKE ? OR u.job_number LIKE ? OR u.mobile LIKE ? OR u.email LIKE ?)');
    const kw = `%${filters.keyword}%`;
    params.push(kw, kw, kw, kw);
  }

  if (filters.departmentId) {
    conditions.push('u.department_id = ?');
    params.push(filters.departmentId);
  }

  if (filters.status !== undefined && filters.status !== null) {
    conditions.push('u.status = ?');
    params.push(Number(filters.status));
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const total = db.prepare(`SELECT COUNT(*) as count FROM users u ${whereClause}`).get(...params).count;

  const list = db.prepare(`
    SELECT u.* FROM users u ${whereClause}
    ORDER BY u.created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, pageSize, offset);

  return { list, total, page, pageSize };
}

/**
 * UPSERT 用户 (钉钉同步/首次登录建档)
 * @param {object} userData
 * @returns {object}
 */
function upsertUser(userData) {
  const db = getDb();
  const stamp = nowIso();
  const existing = findById(userData.id);

  if (existing) {
    // 防覆盖核心保护：若用户已拥有自定义头像 (avatar_type === 'custom')，同步与日常登录不覆盖其头像与配置
    const isCustomAvatar = existing.avatar_type === 'custom';
    const targetAvatar = isCustomAvatar ? existing.avatar : (userData.avatar || existing.avatar);
    const targetAvatarType = isCustomAvatar ? 'custom' : (existing.avatar_type || (userData.avatar ? 'dingtalk' : 'default'));
    const targetAvatarConfig = isCustomAvatar ? existing.avatar_config : (userData.avatar_config !== undefined ? userData.avatar_config : existing.avatar_config);

    db.prepare(`
      UPDATE users SET
        name = COALESCE(@name, name),
        avatar = @avatar,
        avatar_type = @avatar_type,
        avatar_config = @avatar_config,
        job_number = COALESCE(@job_number, job_number),
        mobile = COALESCE(@mobile, mobile),
        email = COALESCE(@email, email),
        department_id = COALESCE(@department_id, department_id),
        department_name = COALESCE(@department_name, department_name),
        is_dept_manager = COALESCE(@is_dept_manager, is_dept_manager),
        status = COALESCE(@status, status),
        updated_at = @updated_at
      WHERE id = @id
    `).run({
      id: userData.id,
      name: userData.name ?? null,
      avatar: targetAvatar ?? null,
      avatar_type: targetAvatarType,
      avatar_config: targetAvatarConfig ?? null,
      job_number: userData.job_number ?? null,
      mobile: userData.mobile ?? null,
      email: userData.email ?? null,
      department_id: userData.department_id ?? null,
      department_name: userData.department_name ?? null,
      is_dept_manager: userData.is_dept_manager ?? null,
      status: userData.status ?? null,
      updated_at: stamp,
    });

    return findById(userData.id);
  }

  const initialAvatarType = userData.avatar_type || (userData.avatar ? 'dingtalk' : 'default');
  const initialAvatarConfig = typeof userData.avatar_config === 'object' && userData.avatar_config !== null
    ? JSON.stringify(userData.avatar_config)
    : (userData.avatar_config || null);

  db.prepare(`
    INSERT INTO users (id, name, avatar, avatar_type, avatar_config, job_number, mobile, email, department_id, department_name, is_dept_manager, status, created_at, updated_at)
    VALUES (@id, @name, @avatar, @avatar_type, @avatar_config, @job_number, @mobile, @email, @department_id, @department_name, @is_dept_manager, @status, @created_at, @updated_at)
  `).run({
    id: userData.id,
    name: userData.name || '',
    avatar: userData.avatar || '',
    avatar_type: initialAvatarType,
    avatar_config: initialAvatarConfig,
    job_number: userData.job_number || '',
    mobile: userData.mobile || '',
    email: userData.email || '',
    department_id: userData.department_id || null,
    department_name: userData.department_name || '',
    is_dept_manager: userData.is_dept_manager || 0,
    status: userData.status ?? 1,
    created_at: stamp,
    updated_at: stamp,
  });

  return findById(userData.id);
}

/**
 * 更新用户自定义头像与配置
 * @param {string} userId
 * @param {{ avatar: string, avatarConfig: object|string, avatarType?: string }} payload
 * @returns {object|null}
 */
function updateUserAvatar(userId, { avatar, avatarConfig, avatarType = 'custom' }) {
  const db = getDb();
  const stamp = nowIso();
  const configStr = typeof avatarConfig === 'object' && avatarConfig !== null
    ? JSON.stringify(avatarConfig)
    : (avatarConfig || null);

  const result = db.prepare(`
    UPDATE users SET
      avatar = ?,
      avatar_config = ?,
      avatar_type = ?,
      updated_at = ?
    WHERE id = ?
  `).run(avatar, configStr, avatarType, stamp, userId);

  if (result.changes === 0) {
    return null;
  }

  return findById(userId);
}

/**
 * 更新用户状态 (启用/禁用)
 * @param {string} userId
 * @param {number} status - 1=活跃 0=已禁用
 * @returns {object|null}
 */
function updateStatus(userId, status) {
  const db = getDb();
  const result = db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?')
    .run(status, nowIso(), userId);

  if (result.changes === 0) {
    return null;
  }

  return findById(userId);
}

/**
 * 批量标记用户为失活
 * @param {string[]} userIds
 * @returns {number} 受影响行数
 */
function disableUsers(userIds) {
  if (!userIds || userIds.length === 0) {
    return 0;
  }

  const db = getDb();
  const stamp = nowIso();
  const placeholders = userIds.map(() => '?').join(', ');

  return db.prepare(
    `UPDATE users SET status = 0, updated_at = ? WHERE id IN (${placeholders}) AND status = 1`
  ).run(stamp, ...userIds).changes;
}

/**
 * 获取部门下所有用户 ID
 * @param {string} departmentId
 * @returns {string[]}
 */
function getUserIdsByDepartment(departmentId) {
  const db = getDb();
  return db.prepare('SELECT id FROM users WHERE department_id = ? AND status = 1')
    .all(departmentId)
    .map(row => row.id);
}

/**
 * 获取用户简要信息 (名片)
 * @param {string} userId
 * @returns {{ id: string, name: string, avatar: string } | null}
 */
function getUserProfile(userId) {
  const db = getDb();
  return db.prepare('SELECT id, name, avatar FROM users WHERE id = ?').get(userId) || null;
}

/**
 * 查询全部启用用户（不分页，供全员推送收集收件人使用）
 * @returns {object[]}
 */
function findActiveUsers() {
  return getDb().prepare('SELECT * FROM users WHERE status = 1').all();
}

module.exports = {
  findById,
  findByIds,
  findActiveUsers,
  listUsers,
  upsertUser,
  updateUserAvatar,
  updateStatus,
  disableUsers,
  getUserIdsByDepartment,
  getUserProfile,
};
