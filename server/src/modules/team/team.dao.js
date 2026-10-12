/**
 * 团队 DAO
 *
 * 负责团队、成员关系和团队任务概览的数据库读写。
 */
const { getDb } = require('../../db/sqlite');
const { generateId } = require('../../utils/uuid');
const { nowIso } = require('../../utils/datetime');

const TEAM_LEVELS = new Set(['company', 'department', 'team', 'group', 'project', 'custom']);
const TEAM_MEMBER_ROLES = new Set(['owner', 'admin', 'member']);
const TEAM_MEMBER_TASK_VISIBILITY_SCOPES = new Set(['all', 'self']);

function createTeamError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

function normalizeUserIds(ids) {
  if (!Array.isArray(ids)) {
    return [];
  }
  return [...new Set(ids.map((item) => String(item || '').trim()).filter(Boolean))];
}

function parseParticipantIds(participantIds) {
  if (!participantIds) {
    return [];
  }

  if (Array.isArray(participantIds)) {
    return participantIds.map((item) => String(item || '').trim()).filter(Boolean);
  }

  try {
    const parsed = JSON.parse(participantIds);
    return Array.isArray(parsed) ? parsed.map((item) => String(item || '').trim()).filter(Boolean) : [];
  } catch (_error) {
    return [];
  }
}

function isOpenTask(task) {
  return task && task.is_deleted === 0 && !['done', 'delayed_done', 'canceled'].includes(task.status);
}

function toTaskPreviewItem(task) {
  return {
    id: task.id,
    title: task.title,
    status: task.status,
  };
}

function getTeamRecord(teamId) {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT
        t.id,
        t.name,
        t.description,
        t.avatar,
        t.level,
        t.owner_id,
        t.is_archived,
        t.created_at,
        t.updated_at
      FROM teams t
      WHERE t.id = ?
      LIMIT 1
    `
    )
    .get(teamId);
}

function getTeamMemberRecord(teamId, userId) {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT tm.*
      FROM team_members tm
      WHERE tm.team_id = ? AND tm.user_id = ?
      LIMIT 1
    `
    )
    .get(teamId, userId);
}

function ensureTeamExists(teamId) {
  const team = getTeamRecord(teamId);
  if (!team) {
    throw createTeamError('TEAM_NOT_FOUND', '团队不存在', 404);
  }
  if (team.is_archived === 1) {
    throw createTeamError('TEAM_NOT_FOUND', '团队已解散', 404);
  }
  return team;
}

function ensureTeamAccessible(teamId, userId) {
  const team = ensureTeamExists(teamId);
  if (!userId) {
    throw createTeamError('FORBIDDEN', '无权限访问团队', 403);
  }

  if (team.owner_id === userId) {
    return team;
  }

  const membership = getTeamMemberRecord(teamId, userId);
  if (!membership) {
    throw createTeamError('FORBIDDEN', '无权限访问团队', 403);
  }

  return team;
}

function getUserRoleInTeam(teamId, userId, teamHint) {
  const team = teamHint || getTeamRecord(teamId);
  if (!team) {
    return null;
  }

  if (team.owner_id === userId) {
    return 'owner';
  }

  const membership = getTeamMemberRecord(teamId, userId);
  return membership ? membership.role_id : null;
}

function ensureCanManageMembers(teamId, operatorId, teamHint) {
  const role = getUserRoleInTeam(teamId, operatorId, teamHint);
  if (role !== 'owner' && role !== 'admin') {
    throw createTeamError('FORBIDDEN', '仅团队创建者或管理员可管理成员', 403);
  }
  return role;
}

function ensureTeamAdmin(teamId, operatorId, teamHint) {
  if (operatorId) {
    try {
      const permissionCache = require('../../services/permissionCache');
      if (permissionCache.isSuperAdmin(operatorId)) {
        return 'admin';
      }
    } catch {
      // 忽略缓存模块异常
    }
  }
  const role = getUserRoleInTeam(teamId, operatorId, teamHint);
  if (role !== 'owner' && role !== 'admin') {
    throw createTeamError('FORBIDDEN', '仅团队创建者或管理员可访问团队驾驶舱', 403);
  }
  return role;
}

function listTeamsWithStats(userId) {
  const db = getDb();
  const baseSql = `
    SELECT
      t.id,
      t.name,
      t.description,
      t.avatar,
      t.level,
      t.owner_id,
      t.is_archived,
      t.created_at,
      t.updated_at,
      (
        SELECT COUNT(1)
        FROM team_members tm
        WHERE tm.team_id = t.id
      ) AS memberCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = t.id AND tk.is_deleted = 0
      ) AS taskCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = t.id AND tk.is_deleted = 0 AND tk.status NOT IN ('done', 'delayed_done', 'canceled')
      ) AS unfinishedCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = t.id AND tk.is_deleted = 0 AND tk.status NOT IN ('done', 'delayed_done', 'canceled')
      ) AS todoCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = t.id AND tk.is_deleted = 0 AND tk.status IN ('done', 'delayed_done')
      ) AS doneCount
    FROM teams t
    WHERE t.is_archived = 0
  `;

  if (!userId) {
    return db.prepare(`${baseSql} ORDER BY t.created_at DESC`).all();
  }

  return db
    .prepare(
      `
      ${baseSql}
      AND (
        t.owner_id = @userId
        OR EXISTS (
          SELECT 1
          FROM team_members tmv
          WHERE tmv.team_id = t.id AND tmv.user_id = @userId
        )
      )
      ORDER BY t.created_at DESC
    `
    )
    .all({ userId });
}

function findTeamById(teamId, userId) {
  const db = getDb();
  const team = db
    .prepare(
      `
      SELECT
        t.id,
        t.name,
        t.description,
        t.avatar,
        t.level,
        t.owner_id,
        t.is_archived,
        t.created_at,
        t.updated_at,
        (
          SELECT COUNT(1)
          FROM team_members tm
          WHERE tm.team_id = t.id
        ) AS memberCount
      FROM teams t
      WHERE t.id = ?
      LIMIT 1
    `
    )
    .get(teamId);

  if (!team || team.is_archived === 1) {
    return null;
  }

  if (!userId) {
    return team;
  }

  if (team.owner_id === userId) {
    return team;
  }

  const membership = getTeamMemberRecord(teamId, userId);
  if (!membership) {
    return null;
  }

  return team;
}

function listTeamMembers(teamId, userId) {
  const team = ensureTeamAccessible(teamId, userId);
  const db = getDb();
  const members = db
    .prepare(
      `
      SELECT
        u.id,
        u.name,
        u.avatar,
        u.mobile,
        u.email,
        u.department_name,
        u.is_dept_manager,
        u.status,
        u.created_at,
        u.updated_at,
        tm.role_id,
        COALESCE(tm.task_visibility_scope, 'all') AS task_visibility_scope,
        tm.joined_at
      FROM team_members tm
      INNER JOIN users u ON u.id = tm.user_id
      WHERE tm.team_id = ?
      ORDER BY
        CASE tm.role_id
          WHEN 'owner' THEN 0
          WHEN 'admin' THEN 1
          ELSE 2
        END,
        tm.joined_at ASC
    `
    )
    .all(teamId);

  if (members.some((item) => item.id === team.owner_id)) {
    return members;
  }

  const owner = db
    .prepare(
      `
      SELECT
        u.id,
        u.name,
        u.avatar,
        u.mobile,
        u.email,
        u.department_name,
        u.is_dept_manager,
        u.status,
        u.created_at,
        u.updated_at
      FROM users u
      WHERE u.id = ?
      LIMIT 1
    `
    )
    .get(team.owner_id);

  if (!owner) {
    return members;
  }

  return [
    {
      ...owner,
      role_id: 'owner',
      task_visibility_scope: 'all',
      joined_at: team.created_at,
    },
    ...members,
  ];
}

function createTeam(data) {
  const ownerId = String(data.ownerId || '').trim();
  const name = String(data.name || '').trim();
  const level = String(data.level || '').trim();
  const description = String(data.description || '').trim();
  const avatar = String(data.avatar || '').trim();

  if (!ownerId) {
    throw createTeamError('MISSING_PARAM', '缺少团队创建者', 400);
  }

  if (!name) {
    throw createTeamError('MISSING_PARAM', '团队名称不能为空', 400);
  }

  if (!TEAM_LEVELS.has(level)) {
    throw createTeamError('INVALID_PARAM', '团队级别不正确', 400);
  }

  const adminUserIds = normalizeUserIds(data.adminUserIds).filter((userId) => userId !== ownerId);
  const memberUserIds = normalizeUserIds(data.memberUserIds).filter(
    (userId) => userId !== ownerId && !adminUserIds.includes(userId)
  );
  const stamp = nowIso();
  const teamId = `team-${generateId()}`;
  const db = getDb();

  db.transaction(() => {
    db.prepare(
      `
      INSERT INTO teams (
        id, name, description, avatar, level, owner_id, is_archived, created_at, updated_at
      ) VALUES (
        @id, @name, @description, @avatar, @level, @owner_id, 0, @created_at, @updated_at
      )
    `
    ).run({
      id: teamId,
      name,
      description: description || null,
      avatar: avatar || null,
      level,
      owner_id: ownerId,
      created_at: stamp,
      updated_at: stamp,
    });

    const insertMember = db.prepare(
      `
      INSERT OR IGNORE INTO team_members (
        id, team_id, user_id, role_id, task_visibility_scope, joined_at
      ) VALUES (
        @id, @team_id, @user_id, @role_id, @task_visibility_scope, @joined_at
      )
    `
    );

    insertMember.run({
      id: `tm-${generateId()}`,
      team_id: teamId,
      user_id: ownerId,
      role_id: 'owner',
      task_visibility_scope: 'all',
      joined_at: stamp,
    });

    for (const userId of adminUserIds) {
      insertMember.run({
        id: `tm-${generateId()}`,
        team_id: teamId,
        user_id: userId,
        role_id: 'admin',
        task_visibility_scope: 'all',
        joined_at: stamp,
      });
    }

    for (const userId of memberUserIds) {
      insertMember.run({
        id: `tm-${generateId()}`,
        team_id: teamId,
        user_id: userId,
        role_id: 'member',
        task_visibility_scope: 'all',
        joined_at: stamp,
      });
    }
  })();

  return findTeamById(teamId, ownerId);
}

function updateTeam(teamId, updates, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  const role = getUserRoleInTeam(teamId, operatorId, team);
  if (role !== 'owner' && role !== 'admin') {
    throw createTeamError('FORBIDDEN', '仅团队创建者或管理员可编辑团队', 403);
  }

  const allowedFields = ['name', 'description', 'avatar', 'level'];
  const setClauses = [];
  const params = {
    id: teamId,
    updated_at: nowIso(),
  };

  for (const field of allowedFields) {
    if (updates[field] === undefined) {
      continue;
    }

    if (field === 'name') {
      const name = String(updates.name || '').trim();
      if (!name) {
        throw createTeamError('MISSING_PARAM', '团队名称不能为空', 400);
      }
      params.name = name;
      setClauses.push('name = @name');
      continue;
    }

    if (field === 'level') {
      const level = String(updates.level || '').trim();
      if (!TEAM_LEVELS.has(level)) {
        throw createTeamError('INVALID_PARAM', '团队级别不正确', 400);
      }
      params.level = level;
      setClauses.push('level = @level');
      continue;
    }

    if (field === 'description' || field === 'avatar') {
      params[field] = updates[field] ? String(updates[field]).trim() : null;
      setClauses.push(`${field} = @${field}`);
    }
  }

  if (setClauses.length === 0) {
    return findTeamById(teamId, operatorId);
  }

  setClauses.push('updated_at = @updated_at');

  getDb()
    .prepare(
      `
      UPDATE teams
      SET ${setClauses.join(', ')}
      WHERE id = @id
    `
    )
    .run(params);

  return findTeamById(teamId, operatorId);
}

function deleteTeam(teamId, operatorId) {
  dissolveTeam(teamId, operatorId);
}

function addMembers(teamId, userIds, roleId, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  ensureCanManageMembers(teamId, operatorId, team);

  const normalizedRoleId = String(roleId || '').trim();
  if (!TEAM_MEMBER_ROLES.has(normalizedRoleId) || normalizedRoleId === 'owner') {
    throw createTeamError('INVALID_PARAM', '成员角色不合法', 400);
  }

  const candidateUserIds = normalizeUserIds(userIds).filter((userId) => userId !== team.owner_id);
  if (candidateUserIds.length === 0) {
    throw createTeamError('MISSING_PARAM', '至少需要一位成员', 400);
  }

  const db = getDb();
  const stamp = nowIso();
  const insertMember = db.prepare(
    `
    INSERT OR IGNORE INTO team_members (
      id, team_id, user_id, role_id, task_visibility_scope, joined_at
    ) VALUES (
      @id, @team_id, @user_id, @role_id, @task_visibility_scope, @joined_at
    )
  `
  );

  db.transaction(() => {
    for (const userId of candidateUserIds) {
      insertMember.run({
        id: `tm-${generateId()}`,
        team_id: teamId,
        user_id: userId,
        role_id: normalizedRoleId,
        task_visibility_scope: 'all',
        joined_at: stamp,
      });
    }
  })();
}

function updateMemberTaskVisibilityScope(teamId, userId, scope, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  ensureCanManageMembers(teamId, operatorId, team);

  if (team.owner_id === userId) {
    throw createTeamError('FORBIDDEN', '不能修改团队创建者可见范围', 403);
  }

  const member = getTeamMemberRecord(teamId, userId);
  if (!member) {
    throw createTeamError('USER_NOT_FOUND', '成员不存在', 404);
  }

  const normalizedScope = String(scope || '').trim();
  if (!TEAM_MEMBER_TASK_VISIBILITY_SCOPES.has(normalizedScope)) {
    throw createTeamError('INVALID_PARAM', '成员可见范围不合法', 400);
  }

  getDb()
    .prepare(
      `
      UPDATE team_members
      SET task_visibility_scope = @task_visibility_scope
      WHERE team_id = @team_id AND user_id = @user_id
    `
    )
    .run({
      team_id: teamId,
      user_id: userId,
      task_visibility_scope: normalizedScope,
    });

  return {
    user_id: userId,
    task_visibility_scope: normalizedScope,
  };
}

function updateTeamBatchTaskVisibilityScope(teamId, scope, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  ensureCanManageMembers(teamId, operatorId, team);

  const normalizedScope = String(scope || '').trim();
  if (!TEAM_MEMBER_TASK_VISIBILITY_SCOPES.has(normalizedScope)) {
    throw createTeamError('INVALID_PARAM', '成员可见范围不合法', 400);
  }

  const info = getDb()
    .prepare(
      `
      UPDATE team_members
      SET task_visibility_scope = @task_visibility_scope
      WHERE team_id = @team_id AND role_id = 'member'
    `
    )
    .run({
      team_id: teamId,
      task_visibility_scope: normalizedScope,
    });

  return {
    team_id: teamId,
    task_visibility_scope: normalizedScope,
    updated_count: info.changes,
  };
}

function updateMemberRole(teamId, userId, roleId, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  ensureCanManageMembers(teamId, operatorId, team);

  const normalizedRoleId = String(roleId || '').trim();
  if (!TEAM_MEMBER_ROLES.has(normalizedRoleId) || normalizedRoleId === 'owner') {
    throw createTeamError('INVALID_PARAM', '成员角色不合法', 400);
  }

  if (team.owner_id === userId) {
    throw createTeamError('FORBIDDEN', '不能修改团队创建者角色', 403);
  }

  const membership = getTeamMemberRecord(teamId, userId);
  if (!membership) {
    throw createTeamError('USER_NOT_FOUND', '成员不存在', 404);
  }

  const previousRoleId = membership.role_id;

  getDb()
    .prepare(
      `
      UPDATE team_members
      SET role_id = @role_id
      WHERE team_id = @team_id AND user_id = @user_id
    `
    )
    .run({
      team_id: teamId,
      user_id: userId,
      role_id: normalizedRoleId,
    });

  return { previousRoleId, newRoleId: normalizedRoleId, teamName: team.name };
}

function listOpenTasksByTeam(teamId) {
  const db = getDb();
  return db
    .prepare(
      `
      SELECT *
      FROM tasks
      WHERE team_id = ? AND is_deleted = 0 AND status NOT IN ('done', 'delayed_done', 'canceled')
      ORDER BY sort_order ASC, created_at DESC
    `
    )
    .all(teamId);
}

function buildMemberTaskCheck(teamId, userId) {
  const openTasks = listOpenTasksByTeam(teamId);
  const responsibleTasks = openTasks.filter((task) => task.assignee_id === userId);
  const participantTasks = openTasks.filter((task) => {
    const participantIds = parseParticipantIds(task.participant_ids);
    return participantIds.includes(userId) && task.assignee_id !== userId;
  });
  const createdTasks = openTasks.filter((task) => task.creator_id === userId);
  const previewMap = new Map();

  for (const task of [...responsibleTasks, ...participantTasks]) {
    previewMap.set(task.id, task);
  }

  const canDirect = responsibleTasks.length === 0 && participantTasks.length === 0;

  return {
    canRemove: canDirect,
    mode: canDirect ? 'direct' : 'task_resolution_required',
    openTaskCount: previewMap.size,
    responsibleTaskCount: responsibleTasks.length,
    participantTaskCount: participantTasks.length,
    createdTaskCount: createdTasks.length,
    reason: canDirect
      ? ''
      : responsibleTasks.length > 0
        ? '该成员仍有未完成负责人任务，需要先转交。'
        : '该成员仍有未完成参与任务，需要先处理参与关系。',
    taskPreview: [...previewMap.values()].map(toTaskPreviewItem),
  };
}

function checkMemberRemoval(teamId, userId, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  ensureCanManageMembers(teamId, operatorId, team);

  if (team.owner_id === userId) {
    return {
      canRemove: false,
      mode: 'forbidden',
      openTaskCount: 0,
      responsibleTaskCount: 0,
      participantTaskCount: 0,
      createdTaskCount: 0,
      reason: '不能移除团队创建者',
      taskPreview: [],
    };
  }

  const member = getTeamMemberRecord(teamId, userId);
  if (!member) {
    throw createTeamError('USER_NOT_FOUND', '成员不存在', 404);
  }

  return buildMemberTaskCheck(teamId, userId);
}

function removeMember(teamId, userId, options, operatorId) {
  const team = ensureTeamAccessible(teamId, operatorId);
  ensureCanManageMembers(teamId, operatorId, team);

  if (team.owner_id === userId) {
    throw createTeamError('FORBIDDEN', '不能移除团队创建者', 403);
  }

  const member = getTeamMemberRecord(teamId, userId);
  if (!member) {
    throw createTeamError('USER_NOT_FOUND', '成员不存在', 404);
  }

  const check = buildMemberTaskCheck(teamId, userId);
  const transferToUserId = String(options?.transferToUserId || '').trim();
  const removeParticipantAssignments = Boolean(options?.removeParticipantAssignments);
  const db = getDb();
  const stamp = nowIso();

  db.transaction(() => {
    if (check.responsibleTaskCount > 0) {
      if (!transferToUserId) {
        throw createTeamError('INVALID_PARAM', '仍有未完成负责人任务，需要先转交', 400);
      }

      if (transferToUserId === userId) {
        throw createTeamError('INVALID_PARAM', '转交对象不能是当前成员', 400);
      }

      const transferTarget = transferToUserId === team.owner_id
        ? true
        : Boolean(getTeamMemberRecord(teamId, transferToUserId));

      if (!transferTarget) {
        throw createTeamError('INVALID_PARAM', '转交对象必须属于当前团队', 400);
      }

      db.prepare(
        `
        UPDATE tasks
        SET assignee_id = @transfer_to_user_id, updated_at = @updated_at
        WHERE team_id = @team_id
          AND is_deleted = 0
          AND status NOT IN ('done', 'delayed_done', 'canceled')
          AND assignee_id = @user_id
      `
      ).run({
        transfer_to_user_id: transferToUserId,
        updated_at: stamp,
        team_id: teamId,
        user_id: userId,
      });
    }

    if (check.participantTaskCount > 0) {
      if (!removeParticipantAssignments) {
        throw createTeamError('INVALID_PARAM', '仍有未完成参与任务，需要先处理参与关系', 400);
      }

      const participantTasks = listOpenTasksByTeam(teamId).filter((task) =>
        parseParticipantIds(task.participant_ids).includes(userId)
      );
      const updateParticipant = db.prepare(
        `
        UPDATE tasks
        SET participant_ids = @participant_ids, updated_at = @updated_at
        WHERE id = @id
      `
      );

      for (const task of participantTasks) {
        const nextParticipantIds = parseParticipantIds(task.participant_ids).filter(
          (participantId) => participantId !== userId
        );

        updateParticipant.run({
          id: task.id,
          participant_ids: JSON.stringify(nextParticipantIds),
          updated_at: stamp,
        });
      }
    }

    db.prepare(
      `
      DELETE FROM team_members
      WHERE team_id = @team_id AND user_id = @user_id
    `
    ).run({
      team_id: teamId,
      user_id: userId,
    });
  })();
}

function checkSelfExit(teamId, userId) {
  const team = ensureTeamAccessible(teamId, userId);

  if (team.owner_id === userId) {
    return {
      canExit: false,
      mode: 'forbidden',
      openTaskCount: 0,
      responsibleTaskCount: 0,
      participantTaskCount: 0,
      createdTaskCount: 0,
      reason: '团队创建者不能直接退出团队。',
      taskPreview: [],
    };
  }

  const membership = getTeamMemberRecord(teamId, userId);
  if (!membership) {
    throw createTeamError('FORBIDDEN', '当前不属于该团队', 403);
  }

  const check = buildMemberTaskCheck(teamId, userId);
  const canExit = check.responsibleTaskCount === 0 && check.participantTaskCount === 0;

  return {
    canExit,
    mode: canExit ? 'direct' : 'blocked',
    openTaskCount: check.openTaskCount,
    responsibleTaskCount: check.responsibleTaskCount,
    participantTaskCount: check.participantTaskCount,
    createdTaskCount: check.createdTaskCount,
    reason: canExit
      ? ''
      : check.responsibleTaskCount > 0
        ? '你仍有未完成负责人任务，请先完成任务或转交职责。'
        : '你仍有未完成参与任务，请先完成任务或请管理员处理参与关系。',
    taskPreview: check.taskPreview,
  };
}

function exitTeam(teamId, userId) {
  const check = checkSelfExit(teamId, userId);

  if (!check.canExit) {
    throw createTeamError('INVALID_PARAM', check.reason || '当前无法退出团队', 400);
  }

  getDb()
    .prepare(
      `
      DELETE FROM team_members
      WHERE team_id = @team_id AND user_id = @user_id
    `
    )
    .run({
      team_id: teamId,
      user_id: userId,
    });
}

function checkTeamDissolve(teamId, userId) {
  const team = ensureTeamAccessible(teamId, userId);
  const unfinishedTaskCount = getDb()
    .prepare(
      `
      SELECT COUNT(1) as count
      FROM tasks
      WHERE team_id = ? AND is_deleted = 0 AND status NOT IN ('done', 'delayed_done', 'canceled')
    `
    )
    .get(teamId).count;
  const isOwner = team.owner_id === userId;

  return {
    canDissolve: isOwner && unfinishedTaskCount === 0,
    unfinishedTaskCount,
    isOwner,
    reason: !isOwner
      ? '仅团队创建者可以解散团队。'
      : unfinishedTaskCount > 0
        ? '当前团队仍有未完成任务，暂时不能解散。'
        : '',
  };
}

function dissolveTeam(teamId, userId) {
  const check = checkTeamDissolve(teamId, userId);
  if (!check.canDissolve) {
    throw createTeamError('FORBIDDEN', check.reason || '当前无法解散团队', 403);
  }

  const db = getDb();
  const stamp = nowIso();
  db.transaction(() => {
    db.prepare('DELETE FROM team_members WHERE team_id = ?').run(teamId);
    db.prepare(
      `
      UPDATE teams
      SET is_archived = 1, updated_at = ?
      WHERE id = ?
    `
    ).run(stamp, teamId);
  })();
}

function getTeamMemberTaskStats(teamId, operatorId) {
  ensureTeamAdmin(teamId, operatorId);
  const db = getDb();
  const team = ensureTeamAccessible(teamId, operatorId);

  const memberStatsSql = `
    SELECT
      u.id AS userId,
      u.name,
      u.avatar,
      u.department_name AS department,
      tm.role_id AS role,
      tm.joined_at AS joinedAt,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = ?
          AND tk.is_deleted = 0
          AND tk.assignee_id = u.id
      ) AS assignedTaskCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = ?
          AND tk.is_deleted = 0
          AND tk.assignee_id = u.id
          AND tk.status IN ('in_progress', 'delayed_in_progress')
      ) AS openTaskCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = ?
          AND tk.is_deleted = 0
          AND tk.assignee_id = u.id
          AND tk.status NOT IN ('done', 'delayed_done', 'canceled')
          AND tk.due_date IS NOT NULL
          AND tk.due_date < date('now', 'localtime')
      ) AS overdueTaskCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = ?
          AND tk.is_deleted = 0
          AND tk.assignee_id = u.id
          AND tk.priority = 'urgent'
          AND tk.status NOT IN ('done', 'delayed_done', 'canceled')
      ) AS urgentTaskCount,
      (
        SELECT COUNT(1)
        FROM tasks tk
        WHERE tk.team_id = ?
          AND tk.is_deleted = 0
          AND tk.assignee_id = u.id
          AND tk.status IN ('done', 'delayed_done')
      ) AS completedTaskCount
    FROM team_members tm
    INNER JOIN users u ON u.id = tm.user_id
    WHERE tm.team_id = ?
  `;

  let rows = db.prepare(memberStatsSql).all(teamId, teamId, teamId, teamId, teamId, teamId);

  // 若 owner 不在 team_members 中，补充 owner 的统计
  if (!rows.some((r) => r.userId === team.owner_id)) {
    const ownerStatSql = `
      SELECT
        u.id AS userId,
        u.name,
        u.avatar,
        u.department_name AS department,
        'owner' AS role,
        t.created_at AS joinedAt,
        (
          SELECT COUNT(1)
          FROM tasks tk
          WHERE tk.team_id = ?
            AND tk.is_deleted = 0
            AND tk.assignee_id = u.id
        ) AS assignedTaskCount,
        (
          SELECT COUNT(1)
          FROM tasks tk
          WHERE tk.team_id = ?
            AND tk.is_deleted = 0
            AND tk.assignee_id = u.id
            AND tk.status IN ('in_progress', 'delayed_in_progress')
        ) AS openTaskCount,
        (
          SELECT COUNT(1)
          FROM tasks tk
          WHERE tk.team_id = ?
            AND tk.is_deleted = 0
            AND tk.assignee_id = u.id
            AND tk.status NOT IN ('done', 'delayed_done', 'canceled')
            AND tk.due_date IS NOT NULL
            AND tk.due_date < date('now', 'localtime')
        ) AS overdueTaskCount,
        (
          SELECT COUNT(1)
          FROM tasks tk
          WHERE tk.team_id = ?
            AND tk.is_deleted = 0
            AND tk.assignee_id = u.id
            AND tk.priority = 'urgent'
            AND tk.status NOT IN ('done', 'delayed_done', 'canceled')
        ) AS urgentTaskCount,
        (
          SELECT COUNT(1)
          FROM tasks tk
          WHERE tk.team_id = ?
            AND tk.is_deleted = 0
            AND tk.assignee_id = u.id
            AND tk.status IN ('done', 'delayed_done')
        ) AS completedTaskCount
      FROM teams t
      INNER JOIN users u ON u.id = t.owner_id
      WHERE t.id = ?
      LIMIT 1
    `;
    const ownerRow = db.prepare(ownerStatSql).get(teamId, teamId, teamId, teamId, teamId, teamId);
    if (ownerRow) {
      rows.push(ownerRow);
    }
  }

  const result = rows.map((row) => {
    const assigned = Number(row.assignedTaskCount) || 0;
    const completed = Number(row.completedTaskCount) || 0;
    return {
      userId: row.userId,
      name: row.name,
      avatar: row.avatar || '',
      department: row.department || '',
      role: row.role || 'member',
      joinedAt: row.joinedAt,
      assignedTaskCount: assigned,
      openTaskCount: Number(row.openTaskCount) || 0,
      overdueTaskCount: Number(row.overdueTaskCount) || 0,
      urgentTaskCount: Number(row.urgentTaskCount) || 0,
      completedTaskCount: completed,
      completionRate: assigned > 0 ? Math.round((completed / assigned) * 100) : 0,
    };
  });

  return result.sort((a, b) => {
    if (b.assignedTaskCount !== a.assignedTaskCount) {
      return b.assignedTaskCount - a.assignedTaskCount;
    }
    if (b.overdueTaskCount !== a.overdueTaskCount) {
      return b.overdueTaskCount - a.overdueTaskCount;
    }
    return (a.name || '').localeCompare(b.name || '');
  });
}

module.exports = {
  listTeamsWithStats,
  findTeamById,
  listTeamMembers,
  createTeam,
  updateTeam,
  deleteTeam,
  addMembers,
  updateMemberRole,
  updateMemberTaskVisibilityScope,
  updateTeamBatchTaskVisibilityScope,
  checkMemberRemoval,
  removeMember,
  checkSelfExit,
  exitTeam,
  checkTeamDissolve,
  dissolveTeam,
  ensureTeamAdmin,
  getTeamMemberTaskStats,
};
