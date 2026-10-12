#!/usr/bin/env node

/**
 * TaskFlow API 回归测试脚本
 *
 * 在 PM2 (npm run up) 运行形态下执行
 * 用法: node scripts/api-regression.js [--base http://localhost:8344]
 */

const BASE = process.argv.find(a => a.startsWith('--base='))?.split('=')[1] || 'http://localhost:8344';

let pass = 0;
let fail = 0;
const failures = [];

async function test(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    fail++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}: ${err.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

async function get(path) {
  const r = await fetch(`${BASE}${path}`);
  return { status: r.status, body: await r.json() };
}

async function getAuth(path, token) {
  const r = await fetch(`${BASE}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: r.status, body: await r.json() };
}

async function postAuth(path, body, token) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: r.status, body: await r.json() };
}

async function run() {
  console.log(`\n🔍 TaskFlow API 回归测试 → ${BASE}\n`);

  // ──────────────────────────────────────────
  // 1. 公开接口
  // ──────────────────────────────────────────
  console.log('── 公开接口 ──');

  await test('GET /api/health → 200', async () => {
    const { status, body } = await get('/api/health');
    assert(status === 200, `status=${status}`);
    assert(body.code === 0, `code=${body.code}`);
    assert(body.data.status === 'ok');
  });

  await test('GET /api/auth/me → 401 (无token)', async () => {
    const { status, body } = await get('/api/auth/me');
    assert(status === 401, `status=${status}`);
    assert(body.code === 40100, `code=${body.code}`);
  });

  await test('GET /api/nonexistent → 401', async () => {
    const { status, body } = await get('/api/nonexistent');
    assert(status === 401, `status=${status}`);
    assert(body.code === 40100, `code=${body.code}`);
  });

  // ──────────────────────────────────────────
  // 2. 需要获取 token (通过临时方式)
  // ──────────────────────────────────────────
  let token;
  try {
    // 从项目根目录加载 JWT 工具生成测试 token
    const path = require('path');
    const rootDir = path.resolve(__dirname, '..');

    // 加载环境
    try { require(path.join(rootDir, 'server/src/bootstrap/env')).loadEnv(); } catch (_) {}
    const jwt = require(path.join(rootDir, 'server/src/utils/jwt'));
    token = jwt.sign({ id: 'u1', name: '张三' });
  } catch (err) {
    console.log(`\n⚠️ 无法生成 JWT token (${err.message})，跳过受保护接口测试`);
    printSummary();
    return;
  }

  // ──────────────────────────────────────────
  // 3. 认证接口
  // ──────────────────────────────────────────
  console.log('\n── 认证接口 ──');

  await test('GET /api/auth/me → 用户信息', async () => {
    const { status, body } = await getAuth('/api/auth/me', token);
    assert(status === 200, `status=${status}`);
    assert(body.data.user.id === 'u1');
    assert(body.data.globalPermissions.length > 0, '权限为空');
    assert(body.data.isSuperAdmin === true, '非超管');
  });

  // ──────────────────────────────────────────
  // 4. 用户/部门
  // ──────────────────────────────────────────
  console.log('\n── 用户/部门 ──');

  await test('GET /api/users → 用户列表', async () => {
    const { status, body } = await getAuth('/api/users?page=1&pageSize=5', token);
    assert(status === 200, `status=${status}`);
    assert(body.data.total > 0, `用户数=${body.data.total}`);
    assert(body.data.list.length > 0, '列表为空');
  });

  await test('GET /api/users/u1 → 用户详情', async () => {
    const { status, body } = await getAuth('/api/users/u1', token);
    assert(status === 200);
    assert(body.data.name === '张三', `name=${body.data.name}`);
    assert(body.data.roles?.length > 0, '角色为空');
  });

  await test('GET /api/departments → 部门列表', async () => {
    const { status, body } = await getAuth('/api/departments', token);
    assert(status === 200);
    assert(Array.isArray(body.data.list));
  });

  // ──────────────────────────────────────────
  // 5. 任务
  // ──────────────────────────────────────────
  console.log('\n── 任务 ──');

  await test('GET /api/my-tasks → 我的任务', async () => {
    const { body } = await getAuth('/api/my-tasks?scope=assigned&status=all', token);
    assert(body.code === 0);
    assert(body.data.summary !== undefined, '缺少 summary');
  });

  await test('GET /api/teams/t1/tasks → Team 任务', async () => {
    const { body } = await getAuth('/api/teams/t1/tasks', token);
    assert(body.code === 0);
    assert(Array.isArray(body.data.list));
  });

  await test('GET /api/teams/t1/tasks?view=board → 看板', async () => {
    const { body } = await getAuth('/api/teams/t1/tasks?view=board', token);
    assert(body.code === 0);
    assert(body.data.todo !== undefined);
    assert(body.data.in_progress !== undefined);
    assert(body.data.done !== undefined);
  });

  // ──────────────────────────────────────────
  // 6. 驾驶舱
  // ──────────────────────────────────────────
  console.log('\n── 驾驶舱 ──');

  await test('GET /api/dashboard/stats → 统计', async () => {
    const { body } = await getAuth('/api/dashboard/stats', token);
    assert(body.code === 0);
    assert(body.data.total !== undefined, '缺少 total');
  });

  await test('GET /api/dashboard/trend → 趋势', async () => {
    const { body } = await getAuth('/api/dashboard/trend', token);
    assert(body.code === 0);
    assert(Array.isArray(body.data));
    assert(body.data.length > 0, '趋势为空');
  });

  await test('GET /api/dashboard/team-distribution → 团队分布', async () => {
    const { body } = await getAuth('/api/dashboard/team-distribution', token);
    assert(body.code === 0);
    assert(Array.isArray(body.data));
  });

  await test('GET /api/dashboard/overdue → 逾期', async () => {
    const { body } = await getAuth('/api/dashboard/overdue', token);
    assert(body.code === 0);
    assert(Array.isArray(body.data));
  });

  // ──────────────────────────────────────────
  // 7. 通知
  // ──────────────────────────────────────────
  console.log('\n── 通知 ──');

  await test('GET /api/notifications → 通知列表', async () => {
    const { status, body } = await getAuth('/api/notifications', token);
    assert(status === 200);
    assert(Array.isArray(body.data.list));
  });

  await test('GET /api/notifications/unread-count → 未读数', async () => {
    const { status, body } = await getAuth('/api/notifications/unread-count', token);
    assert(status === 200);
    assert(body.data.count !== undefined);
  });

  // ──────────────────────────────────────────
  // 8. 管理端
  // ──────────────────────────────────────────
  console.log('\n── 管理端 ──');

  await test('GET /api/admin/global-roles → 全局角色', async () => {
    const { status, body } = await getAuth('/api/admin/global-roles', token);
    assert(status === 200);
    assert(body.data.list.length >= 4, `角色数=${body.data.list.length}`);
  });

  printSummary();
}

function printSummary() {
  console.log(`\n${'─'.repeat(40)}`);
  console.log(`✅ 通过: ${pass}  ❌ 失败: ${fail}  合计: ${pass + fail}`);

  if (failures.length > 0) {
    console.log('\n失败详情:');
    failures.forEach(f => console.log(`  - ${f.name}: ${f.error}`));
  }

  console.log('');
  process.exit(fail > 0 ? 1 : 0);
}

run().catch(err => {
  console.error('回归脚本异常:', err);
  process.exit(2);
});
