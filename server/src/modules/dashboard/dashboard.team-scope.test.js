const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Database = require('better-sqlite3');

// 使用真实 DAO SQL 与一次性内存库，绝不初始化项目业务数据库。
function fixture(t) {
  const db = new Database(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE teams (id TEXT PRIMARY KEY, name TEXT, owner_id TEXT, is_archived INTEGER);
    CREATE TABLE team_members (team_id TEXT, user_id TEXT, role_id TEXT, task_visibility_scope TEXT);
    CREATE TABLE tasks (id TEXT, title TEXT, team_id TEXT, creator_id TEXT, assignee_id TEXT,
      participant_ids TEXT, status TEXT, due_date TEXT, created_at TEXT, updated_at TEXT, completed_at TEXT, is_deleted INTEGER);
    INSERT INTO teams VALUES ('a','Team A','owner',0),('b','Team B','other-owner',0),('archived','Archived','owner',1);
    INSERT INTO team_members VALUES ('a','admin','admin','self'),('a','limited','member','self'),('a','member','member','all');
  `);
  const insert = db.prepare('INSERT INTO tasks VALUES (?,?,?,?,?,?,?,?,?,?,?,?)');
  const tasks = [
    ['related', 'a', 'owner', 'limited', 'in_progress', '2026-11-01', 0],
    ['done', 'a', 'other', 'other', 'done', '2026-10-01', 0],
    ['overdue', 'a', 'other', 'other', 'delayed_in_progress', '2026-10-01', 0],
    ['canceled', 'a', 'other', 'other', 'canceled', '2026-10-01', 0],
    ['deleted', 'a', 'owner', 'limited', 'in_progress', '2026-10-01', 1],
    ['other-team', 'b', 'other', 'other', 'in_progress', '2026-10-01', 0],
    ['personal', null, 'limited', 'limited', 'in_progress', '2026-11-01', 0],
  ];
  tasks.forEach(([id, team, creator, assignee, status, due, deleted]) =>
    insert.run(id, id, team, creator, assignee, '[]', status, due, '2026-10-10', '2026-10-10', '2026-10-10', deleted));
  const sandbox = { module: { exports: {} }, require(id) {
    if (id === '../../db/sqlite') return { getDb: () => db };
    if (id === '../../utils/datetime') return { todayDate: () => '2026-10-20', daysAgoDate: () => '2026-10-01' };
    if (id === '../../services/permissionCache') return { isSuperAdmin: (userId) => userId === 'super' };
    throw new Error(`Unexpected import: ${id}`);
  }};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, 'dashboard.dao.js'), 'utf8'), sandbox);
  return sandbox.module.exports;
}

for (const userId of ['owner', 'admin', 'super']) {
  test(`${userId}: 全队 KPI 与各卡片明细一致，排除删除任务和其他团队`, (t) => {
    const dao = fixture(t);
    const context = { teamId: 'a', userId, scope: 'self' };
    const stats = dao.getDashboardStats(context);
    assert.equal(stats.total, 4);
    const statuses = { all: 'total', unfinished: 'unfinished', in_progress: 'inProgress', done: 'done', overdue: 'overdue' };
    for (const [status, key] of Object.entries(statuses)) {
      const detail = dao.getTasksByStatus({ ...context, status });
      assert.equal(detail.total, stats[key], status);
      assert.equal(detail.list.length, stats[key], status);
      assert.ok(detail.list.every((task) => task.team_id === 'a' && !task.is_deleted));
    }
    assert.equal(dao.getTasksByStatus({ ...context, pageSize: 2, page: 2 }).list.length, 2);
  });
}

test('普通成员遵循团队可见范围，scope=all 不可绕过仅本人限制', (t) => {
  const dao = fixture(t);
  assert.equal(dao.getDashboardStats({ teamId: 'a', userId: 'limited', scope: 'all' }).total, 1);
  assert.equal(dao.getTasksByStatus({ teamId: 'a', userId: 'limited', scope: 'all' }).list[0].id, 'related');
  assert.equal(dao.getDashboardStats({ teamId: 'a', userId: 'member', scope: 'self' }).total, 4);
});

test('团队外用户、匿名和已解散团队均不可读取统计或明细', (t) => {
  const dao = fixture(t);
  for (const method of ['getDashboardStats', 'getTasksByStatus', 'getDashboardTrend', 'getTeamDistribution', 'getOverdueTasks']) {
    for (const userId of ['outsider', undefined]) {
      assert.throws(() => dao[method]({ teamId: 'a', userId, scope: 'all' }), (error) => error.status === 403);
    }
    for (const teamId of ['missing', 'archived']) {
      assert.throws(() => dao[method]({ teamId, userId: 'owner', scope: 'all' }), (error) => error.status === 404);
    }
  }
});

test('未指定团队的个人统计保持原语义，团队统计仍遵循日期过滤', (t) => {
  const dao = fixture(t);
  assert.equal(dao.getDashboardStats({ userId: 'limited', scope: 'self' }).total, 2);
  assert.equal(dao.getDashboardStats({ teamId: 'a', userId: 'admin', startDate: '2026-10-12' }).total, 0);
});
