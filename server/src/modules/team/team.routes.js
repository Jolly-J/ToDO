/**
 * 团队路由模块
 *
 * 注册团队、成员管理和解散相关接口。
 */
const express = require('express');
const { auth } = require('../../middlewares/auth');
const teamController = require('./team.controller');

const router = express.Router();

router.use(auth);

router.get('/teams', teamController.listTeams);
router.get('/teams/:id', teamController.getTeam);
router.post('/teams', teamController.createTeam);
router.patch('/teams/:id', teamController.updateTeam);
router.patch('/teams/:id/task-visibility-scope', teamController.updateTeamBatchTaskVisibilityScope);
router.delete('/teams/:id', teamController.deleteTeam);
router.get('/teams/:id/members', teamController.getTeamMembers);
router.get('/teams/:id/cockpit/member-tasks', teamController.getCockpitMemberTasks);
router.post('/teams/:id/members', teamController.addTeamMembers);
router.patch('/teams/:id/members/:userId', teamController.updateTeamMemberRole);
router.patch('/teams/:id/members/:userId/task-visibility-scope', teamController.updateTeamMemberTaskVisibilityScope);
router.get('/teams/:id/members/:userId/removal-check', teamController.checkMemberRemoval);
router.post('/teams/:id/members/:userId/remove', teamController.removeMember);
router.get('/teams/:id/members/me/exit-check', teamController.checkMyExit);
router.post('/teams/:id/members/me/exit', teamController.exitTeam);
router.get('/teams/:id/dissolve-check', teamController.checkTeamDissolve);
router.post('/teams/:id/dissolve', teamController.dissolveTeam);

module.exports = router;
