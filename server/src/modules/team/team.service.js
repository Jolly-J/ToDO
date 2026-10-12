/**
 * 团队服务层
 *
 * 负责组合团队 DAO 并在关键操作后发布团队通知事件。
 */
const teamDao = require('./team.dao');
const notificationEvents = require('../notification/notification.events');

function getTeams(userId) {
  return teamDao.listTeamsWithStats(userId);
}

function getTeamDetail(teamId, userId) {
  return teamDao.findTeamById(teamId, userId);
}

function getTeamMembers(teamId, userId) {
  return teamDao.listTeamMembers(teamId, userId);
}

function createTeam(payload) {
  const team = teamDao.createTeam(payload);

  notificationEvents.emit('team.created', {
    bizType: 'team',
    bizId: team.id,
    actorId: payload.ownerId,
    data: { teamName: team.name, eventType: 'team.created' },
  });

  return team;
}

function updateTeam(teamId, payload, operatorId) {
  return teamDao.updateTeam(teamId, payload, operatorId);
}

function deleteTeam(teamId, operatorId) {
  return teamDao.deleteTeam(teamId, operatorId);
}

function addMembers(teamId, userIds, roleId, operatorId) {
  return teamDao.addMembers(teamId, userIds, roleId, operatorId);
}

function updateMemberRole(teamId, userId, roleId, operatorId) {
  const { previousRoleId, newRoleId, teamName } = teamDao.updateMemberRole(teamId, userId, roleId, operatorId);

  // 升级为管理员：通知被升级的人
  if (newRoleId === 'admin' && previousRoleId !== 'admin') {
    notificationEvents.emit('team.admin_changed', {
      bizType: 'team',
      bizId: teamId,
      actorId: operatorId,
      data: {
        eventType: 'team.admin_changed',
        changeType: 'granted',
        changedUserId: userId,
        teamName,
      },
    });
  }

  // 降级为普通成员：通知被降级的人
  if (previousRoleId === 'admin' && newRoleId !== 'admin') {
    notificationEvents.emit('team.admin_changed', {
      bizType: 'team',
      bizId: teamId,
      actorId: operatorId,
      data: {
        eventType: 'team.admin_changed',
        changeType: 'revoked',
        changedUserId: userId,
        teamName,
      },
    });
  }
}

function updateMemberTaskVisibilityScope(teamId, userId, scope, operatorId) {
  return teamDao.updateMemberTaskVisibilityScope(teamId, userId, scope, operatorId);
}

function updateTeamBatchTaskVisibilityScope(teamId, scope, operatorId) {
  return teamDao.updateTeamBatchTaskVisibilityScope(teamId, scope, operatorId);
}

function checkMemberRemoval(teamId, userId, operatorId) {
  return teamDao.checkMemberRemoval(teamId, userId, operatorId);
}

function removeMember(teamId, userId, options, operatorId) {
  return teamDao.removeMember(teamId, userId, options, operatorId);
}

function checkMyExit(teamId, userId) {
  return teamDao.checkSelfExit(teamId, userId);
}

function exitTeam(teamId, userId) {
  return teamDao.exitTeam(teamId, userId);
}

function checkTeamDissolve(teamId, userId) {
  return teamDao.checkTeamDissolve(teamId, userId);
}

function dissolveTeam(teamId, userId) {
  // 解散前先拿成员列表，解散后成员记录会被删除
  const members = teamDao.listTeamMembers(teamId, userId);
  const memberIds = members.map(m => m.id);
  const team = teamDao.findTeamById(teamId, userId);

  teamDao.dissolveTeam(teamId, userId);

  notificationEvents.emit('team.dissolved', {
    bizType: 'team',
    bizId: teamId,
    actorId: userId,
    data: { eventType: 'team.dissolved', teamName: team?.name || '', memberIds },
  });
}

function getCockpitMemberTasks(teamId, operatorId) {
  return teamDao.getTeamMemberTaskStats(teamId, operatorId);
}

module.exports = {
  getTeams,
  getTeamDetail,
  getTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  addMembers,
  updateMemberRole,
  updateMemberTaskVisibilityScope,
  updateTeamBatchTaskVisibilityScope,
  checkMemberRemoval,
  removeMember,
  checkMyExit,
  exitTeam,
  checkTeamDissolve,
  dissolveTeam,
  getCockpitMemberTasks,
};
