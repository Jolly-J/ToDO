/**
 * 认证路由
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const authController = require('./auth.controller');

const router = Router();

// 公开接口 — 无需鉴权
router.post('/login', authController.dingtalkLogin);
router.post('/dingtalk/login', authController.dingtalkLogin);
router.post('/dingtalk/auto-login', authController.dingtalkAutoLogin);

// 受保护接口
router.get('/me', auth, authController.me);
router.post('/logout', auth, authController.logout);

module.exports = router;
