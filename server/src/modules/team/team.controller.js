/**
 * 团队控制器
 *
 * 负责处理团队相关请求并将领域错误转换为统一响应。
 */
const teamService = require('./team.service');
const { success, error } = require('../../utils/response');
const logger = require('../../utils/logger');

function handleTeamError(res, err) {
  if (!err || typeof err !== 'object') {
    return error(res, 'INTERNAL_ERROR', '团队操作失败');
  }

  if (err.code === 'TEAM_NOT_FOUND') {
    return error(res, 'TEAM_NOT_FOUND', err.message || '团队不存在');
  }

  if (err.code === 'USER_NOT_FOUND') {
    return error(res, 'USER_NOT_FOUND', err.message || '成员不存在');
  }

  if (err.code === 'FORBIDDEN') {
    return error(res, 'FORBIDDEN', err.message || '无权限操作');
  }

  if (err.code === 'MISSING_PARAM') {
    return error(res, 'MISSING_PARAM', err.message || '缺少必要参数');
  }

  if (err.code === 'INVALID_PARAM') {
    return error(res, 'INVALID_PARAM', err.message || '参数错误');
  }

  return error(res, 'INTERNAL_ERROR', err.message || '团队操作失败');
}

function listTeams(req, res) {
  try {
    const teams = teamService.getTeams(req.user?.id);
    return success(res, teams);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function getTeam(req, res) {
  try {
    const team = teamService.getTeamDetail(req.params.id, req.user?.id);

    if (!team) {
      return error(res, 'TEAM_NOT_FOUND', '团队不存在');
    }

    return success(res, team);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function createTeam(req, res) {
  try {
    const team = teamService.createTeam({
      name: req.body?.name,
      level: req.body?.level,
      description: req.body?.description,
      avatar: req.body?.avatar,
      ownerId: req.user?.id,
      adminUserIds: req.body?.admin_user_ids,
      memberUserIds: req.body?.member_user_ids,
    });

    return success(res, team, '创建成功', 201);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function updateTeam(req, res) {
  try {
    const team = teamService.updateTeam(req.params.id, req.body || {}, req.user?.id);
    return success(res, team, '更新成功');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function deleteTeam(req, res) {
  try {
    teamService.deleteTeam(req.params.id, req.user?.id);
    return success(res, null, '团队已删除');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function getTeamMembers(req, res) {
  try {
    const members = teamService.getTeamMembers(req.params.id, req.user?.id);
    return success(res, members);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function addTeamMembers(req, res) {
  try {
    teamService.addMembers(req.params.id, req.body?.user_ids, req.body?.role_id, req.user?.id);
    const members = teamService.getTeamMembers(req.params.id, req.user?.id);
    return success(res, members, '成员已添加');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function updateTeamMemberRole(req, res) {
  try {
    teamService.updateMemberRole(req.params.id, req.params.userId, req.body?.role_id, req.user?.id);
    logger.info('团队角色变更', {
      action: 'team.member.role_change',
      teamId: req.params.id,
      targetUserId: req.params.userId,
      roleId: req.body?.role_id,
      operatorId: req.user?.id,
    });
    return success(res, null, '角色已更新');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function updateTeamMemberTaskVisibilityScope(req, res) {
  try {
    const result = teamService.updateMemberTaskVisibilityScope(
      req.params.id,
      req.params.userId,
      req.body?.task_visibility_scope,
      req.user?.id
    );
    logger.info('团队成员任务可见范围变更', {
      action: 'team.member.task_visibility_scope_change',
      teamId: req.params.id,
      targetUserId: req.params.userId,
      taskVisibilityScope: req.body?.task_visibility_scope,
      operatorId: req.user?.id,
    });
    return success(res, result, '可见范围已更新');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function updateTeamBatchTaskVisibilityScope(req, res) {
  try {
    const result = teamService.updateTeamBatchTaskVisibilityScope(
      req.params.id,
      req.body?.task_visibility_scope,
      req.user?.id
    );
    logger.info('团队任务可见范围批量调整', {
      action: 'team.batch_task_visibility_scope_change',
      teamId: req.params.id,
      taskVisibilityScope: req.body?.task_visibility_scope,
      updatedCount: result.updated_count,
      operatorId: req.user?.id,
    });
    return success(res, result, '团队任务可见范围已更新');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function checkMemberRemoval(req, res) {
  try {
    const result = teamService.checkMemberRemoval(req.params.id, req.params.userId, req.user?.id);
    return success(res, result);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function removeMember(req, res) {
  try {
    teamService.removeMember(req.params.id, req.params.userId, req.body || {}, req.user?.id);
    logger.info('团队成员移除', {
      action: 'team.member.remove',
      teamId: req.params.id,
      targetUserId: req.params.userId,
      operatorId: req.user?.id,
    });
    return success(res, null, '成员已移除');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function checkMyExit(req, res) {
  try {
    const result = teamService.checkMyExit(req.params.id, req.user?.id);
    return success(res, result);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function exitTeam(req, res) {
  try {
    teamService.exitTeam(req.params.id, req.user?.id);
    logger.info('退出团队', {
      action: 'team.member.exit',
      teamId: req.params.id,
      userId: req.user?.id,
    });
    return success(res, null, '已退出团队');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function checkTeamDissolve(req, res) {
  try {
    const result = teamService.checkTeamDissolve(req.params.id, req.user?.id);
    return success(res, result);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function dissolveTeam(req, res) {
  try {
    teamService.dissolveTeam(req.params.id, req.user?.id);
    logger.info('团队解散', {
      action: 'team.dissolve',
      teamId: req.params.id,
      operatorId: req.user?.id,
    });
    return success(res, null, '团队已解散');
  } catch (err) {
    return handleTeamError(res, err);
  }
}

function getCockpitMemberTasks(req, res) {
  try {
    const stats = teamService.getCockpitMemberTasks(req.params.id, req.user?.id);
    return success(res, stats);
  } catch (err) {
    return handleTeamError(res, err);
  }
}

module.exports = {
  listTeams,
  getTeam,
  createTeam,
  updateTeam,
  deleteTeam,
  getTeamMembers,
  addTeamMembers,
  updateTeamMemberRole,
  updateTeamMemberTaskVisibilityScope,
  updateTeamBatchTaskVisibilityScope,
  checkMemberRemoval,
  removeMember,
  checkMyExit,
  exitTeam,
  checkTeamDissolve,
  dissolveTeam,
  getCockpitMemberTasks,
};
