/**
 * 部门路由
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const departmentController = require('./department.controller');

const router = Router();

router.get('/', auth, departmentController.listDepartments);
router.get('/tree', auth, departmentController.getDepartmentTree);

module.exports = router;
