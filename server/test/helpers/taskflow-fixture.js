/** 隔离合成库：不加载真实环境、日志文件、通知、调度器或默认数据库路径。 */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Database = require('../../node_modules/better-sqlite3');
const knex = require('../../node_modules/knex');
const root = path.resolve(__dirname, '../../..');
let activeDb;
function stub(relative, exports) {
  const filename = require.resolve(path.join(root, relative));
  require.cache[filename] = { id: filename, filename, loaded: true, exports };
}
stub('server/src/bootstrap/env.js', { loadEnv() {} });
stub('server/src/utils/logger.js', { debug() {}, info() {}, warn() {}, error() {} });
stub('server/src/db/sqlite.js', { getDb: () => {
  if (!activeDb) throw new Error('合成库尚未配置');
  return activeDb;
} });
stub('server/src/modules/notification/notification.cache.js', { stakeholderCache: { invalidate() {} } });
stub('server/src/modules/notification/notification.aggregation.js', { enqueueTaskChanges() {} });
stub('server/src/modules/notification/notification.events.js', { emit() {} });
stub('server/src/modules/notification/notification.todoLifecycle.js', { closeTaskTodosForAssigneeInBackground() {} });

function config(filename) {
  return {
    client: 'sqlite3', connection: { filename }, useNullAsDefault: true,
    migrations: { directory: path.join(root, 'server/src/migrations'), disableTransactions: true },
    pool: { min: 1, max: 1, afterCreate: (conn, cb) => conn.run('PRAGMA foreign_keys = ON', cb) },
  };
}

async function fixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'taskflow-test-'));
  const filename = path.join(dir, 'test.db');
  const k = knex(config(filename));
  try { await require('../../src/db/migrationRunner').runAtomicMigrations(k); }
  finally { await k.destroy(); }
  const db = new Database(filename);
  db.pragma('foreign_keys = ON');
  activeDb = db;
  require('../../src/db/seedRoles').seedRoles(db);
  const permissions = require('../../src/services/permissionCache');
  permissions.clearAll();
  const stamp = '2026-10-01T00:00:00.000Z';
  function user(id) {
    db.prepare('INSERT OR IGNORE INTO users (id,name,created_at,updated_at) VALUES (?,?,?,?)').run(id, `用户${id}`, stamp, stamp);
  }
  function team(id = 'team', owner = 'owner') {
    user(owner);
    db.prepare("INSERT INTO teams (id,name,owner_id,created_at,updated_at,level) VALUES (?,?,?,?,?,'team')").run(id, id, owner, stamp, stamp);
  }
  function member(id, teamId = 'team', role = 'member', scope = 'all') {
    user(id);
    const r = db.prepare('SELECT id FROM team_roles WHERE code = ?').get(role);
    db.prepare('INSERT INTO team_members (id,team_id,user_id,role_id,joined_at,task_visibility_scope) VALUES (?,?,?,?,?,?)').run(`${teamId}-${id}`, teamId, id, r?.id || role, stamp, scope);
    permissions.clearAll();
  }
  function task(id, patch = {}) {
    const row = { id, title: id, description: '合成描述', status: 'in_progress', priority: 'medium', team_id: 'team', creator_id: 'owner', assignee_id: null, participant_ids: '[]', created_at: stamp, updated_at: stamp, ...patch };
    const keys = Object.keys(row);
    db.prepare(`INSERT INTO tasks (${keys.join(',')}) VALUES (${keys.map(key => `@${key}`).join(',')})`).run(row);
    return db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  }
  return { db, dir, filename, user, team, member, task, use(db) { activeDb = db; permissions.clearAll(); }, close() { db.close(); fs.rmSync(dir, { recursive: true, force: true }); } };
}

module.exports = { fixture, config, stub, root };
