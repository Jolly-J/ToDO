/**
 * 用户部门关系 DAO
 *
 * 管理 user_departments 表
 * 支持多部门归属与主部门标记
 */

const { getDb } = require('./sqlite');
const { generateId } = require('../utils/uuid');
const { nowIso } = require('../utils/datetime');

/**
 * 获取用户的所有部门关系
 * @param {string} userId
 * @returns {object[]}
 */
function listByUserId(userId) {
  const db = getDb();
  return db.prepare(`
    SELECT ud.*, d.name as department_name
    FROM user_departments ud
    LEFT JOIN departments d ON ud.department_id = d.id
    WHERE ud.user_id = ?
    ORDER BY ud.is_primary DESC
  `).all(userId);
}

/**
 * 获取部门的所有用户 ID
 * @param {string} departmentId
 * @returns {string[]}
 */
function listUserIdsByDepartment(departmentId) {
  const db = getDb();
  return db.prepare('SELECT user_id FROM user_departments WHERE department_id = ?')
    .all(departmentId)
    .map(row => row.user_id);
}

/**
 * UPSERT 用户部门关系
 * @param {{ user_id: string, department_id: string, is_primary?: number }} data
 * @returns {object}
 */
function upsertRelation(data) {
  const db = getDb();
  const stamp = nowIso();

  db.prepare(`
    INSERT INTO user_departments (id, user_id, department_id, is_primary, created_at)
    VALUES (@id, @user_id, @department_id, @is_primary, @created_at)
    ON CONFLICT(user_id, department_id) DO UPDATE SET
      is_primary = @is_primary
  `).run({
    id: generateId(),
    user_id: data.user_id,
    department_id: data.department_id,
    is_primary: data.is_primary || 0,
    created_at: stamp,
  });

  return db.prepare(
    'SELECT * FROM user_departments WHERE user_id = ? AND department_id = ?'
  ).get(data.user_id, data.department_id);
}

/**
 * 批量同步用户部门关系 (事务)
 * 先删除旧关系再插入新关系
 * @param {string} userId
 * @param {Array<{ department_id: string, is_primary?: number }>} departments
 */
function syncUserDepartments(userId, departments) {
  const db = getDb();

  const syncFn = db.transaction(() => {
    db.prepare('DELETE FROM user_departments WHERE user_id = ?').run(userId);

    for (const dept of departments) {
      upsertRelation({
        user_id: userId,
        department_id: dept.department_id,
        is_primary: dept.is_primary || 0,
      });
    }
  });

  syncFn();
}

module.exports = {
  listByUserId,
  listUserIdsByDepartment,
  upsertRelation,
  syncUserDepartments,
};
