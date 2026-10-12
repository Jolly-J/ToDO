const { getDb } = require('../db/sqlite');
const permissionCache = require('../services/permissionCache');

const USERS = [
  ['u1', '张三'],
  ['u2', '李四'],
  ['u3', '王五'],
  ['u4', '赵六'],
  ['u5', '钱七'],
  ['u6', '孙八'],
  ['u7', '周九'],
  ['u8', '吴十'],
  ['u9', '郑十一'],
  ['u10', '王十二'],
];

const TEAMS = [
  ['t1', '前端开发组', 'u1'],
  ['t2', '后端开发组', 'u2'],
  ['t3', '产品规划组', 'u3'],
  ['t4', '质量保障组', 'u4'],
  ['t5', '流程治理组', 'u1'],
];

function ensureUser(userId, name) {
  const db = getDb();
  const stamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO users (id, name, avatar, job_number, mobile, email, department_name, is_dept_manager, status, created_at, updated_at)
    VALUES (@id, @name, '', '', '', '', '测试部门', 0, 1, @stamp, @stamp)
    ON CONFLICT(id) DO UPDATE SET status = 1, name = excluded.name, updated_at = excluded.updated_at
  `).run({ id: userId, name, stamp });
}

function ensureTeam(teamId, name, ownerId) {
  const db = getDb();
  const stamp = new Date().toISOString();
  db.prepare(`
    INSERT INTO teams (id, name, description, avatar, level, owner_id, is_archived, created_at, updated_at)
    VALUES (@id, @name, '', '', 'team', @ownerId, 0, @stamp, @stamp)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, owner_id = excluded.owner_id, is_archived = 0, updated_at = excluded.updated_at
  `).run({ id: teamId, name, ownerId, stamp });
  db.prepare(`
    INSERT INTO team_members (id, team_id, user_id, role_id, joined_at)
    VALUES (@id, @teamId, @ownerId, 'tr-owner', @stamp)
    ON CONFLICT(id) DO UPDATE SET role_id = 'tr-owner', joined_at = excluded.joined_at
  `).run({ id: `${teamId}:${ownerId}:owner`, teamId, ownerId, stamp });
}

function ensureLegacyTaskReferences() {
  for (const [userId, name] of USERS) {
    ensureUser(userId, name);
  }

  for (const [teamId, name, ownerId] of TEAMS) {
    ensureTeam(teamId, name, ownerId);
  }

  permissionCache.clearAll();
}

module.exports = {
  ensureLegacyTaskReferences,
};
