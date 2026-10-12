/**
 * 部门 DAO — 正式持久化层
 *
 * 提供部门 CRUD、UPSERT、树形查询
 * 全部使用 prepared statements
 */

const { getDb } = require('./sqlite');
const { nowIso } = require('../utils/datetime');

/**
 * 通过 ID 查找部门
 * @param {string} departmentId
 * @returns {object|null}
 */
function findById(departmentId) {
  const db = getDb();
  return db.prepare('SELECT * FROM departments WHERE id = ?').get(departmentId) || null;
}

/**
 * 获取全部部门 (扁平列表)
 * @returns {object[]}
 */
function listAll() {
  const db = getDb();
  return db.prepare('SELECT * FROM departments ORDER BY sort_order ASC, name ASC').all();
}

/**
 * 获取子部门
 * @param {string} parentId
 * @returns {object[]}
 */
function listChildren(parentId) {
  const db = getDb();
  return db.prepare('SELECT * FROM departments WHERE parent_id = ? ORDER BY sort_order ASC').all(parentId);
}

/**
 * UPSERT 部门 (钉钉同步)
 * @param {object} dept
 * @returns {object}
 */
function upsertDepartment(dept) {
  const db = getDb();
  const stamp = nowIso();
  const existing = findById(dept.id);

  if (existing) {
    db.prepare(`
      UPDATE departments SET
        name = @name,
        parent_id = @parent_id,
        sort_order = @sort_order
      WHERE id = @id
    `).run({
      id: dept.id,
      name: dept.name,
      parent_id: dept.parent_id || null,
      sort_order: dept.sort_order || 0,
    });
  } else {
    db.prepare(`
      INSERT INTO departments (id, name, parent_id, sort_order, created_at)
      VALUES (@id, @name, @parent_id, @sort_order, @created_at)
    `).run({
      id: dept.id,
      name: dept.name,
      parent_id: dept.parent_id || null,
      sort_order: dept.sort_order || 0,
      created_at: stamp,
    });
  }

  return findById(dept.id);
}

/**
 * 批量 UPSERT 部门 (事务)
 * @param {object[]} departments
 * @returns {number}
 */
function batchUpsert(departments) {
  const db = getDb();
  const upsertFn = db.transaction((depts) => {
    let count = 0;

    for (const dept of depts) {
      upsertDepartment(dept);
      count++;
    }

    return count;
  });

  return upsertFn(departments);
}

/**
 * 构建树形结构
 * @returns {object[]}
 */
function buildTree() {
  const all = listAll();
  const map = new Map();
  const roots = [];

  for (const dept of all) {
    map.set(dept.id, { ...dept, children: [] });
  }

  for (const dept of all) {
    const node = map.get(dept.id);

    if (dept.parent_id && map.has(dept.parent_id)) {
      map.get(dept.parent_id).children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

module.exports = {
  findById,
  listAll,
  listChildren,
  upsertDepartment,
  batchUpsert,
  buildTree,
};
