/**
 * 部门控制器
 */

const { success } = require('../../utils/response');
const departmentDao = require('../../db/departmentDao');

/**
 * GET /api/departments — 部门列表 (扁平)
 */
function listDepartments(req, res) {
  const list = departmentDao.listAll();
  return success(res, { list });
}

/**
 * GET /api/departments/tree — 部门树
 */
function getDepartmentTree(req, res) {
  const tree = departmentDao.buildTree();
  return success(res, { tree });
}

module.exports = {
  listDepartments,
  getDepartmentTree,
};
