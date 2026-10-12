/**
 * 用户路由
 */

const { Router } = require('express');
const { auth } = require('../../middlewares/auth');
const userController = require('./user.controller');

const router = Router();

router.get('/', auth, userController.listUsers);
router.patch('/me/avatar', auth, userController.updateMyAvatar);
router.get('/:id', auth, userController.getUserDetail);

module.exports = router;
