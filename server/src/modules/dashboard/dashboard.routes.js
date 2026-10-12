/**
 * 仪表盘路由模块
 *
 * 注册仪表盘统计、趋势和逾期任务相关接口。
 */
const express = require('express');
const { auth } = require('../../middlewares/auth');
const dashboardController = require('./dashboard.controller');

const router = express.Router();

router.use(auth);

router.get('/stats', dashboardController.getStats);
router.get('/trend', dashboardController.getTrend);
router.get('/team-distribution', dashboardController.getTeamDistribution);
router.get('/overdue', dashboardController.getOverdue);
router.get('/tasks', dashboardController.getTasksByStatus);

module.exports = router;
