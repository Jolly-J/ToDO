const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const { execFileSync } = require('node:child_process');
const { performance } = require('node:perf_hooks');
const { fixture, root } = require('./helpers/taskflow-fixture');
const dao = require('../src/db/taskDao');

test('实际驱动批量补充保持响应、排序、summary，测量 1000/1500/3000 合成任务', async () => {
  const f = await fixture();
  try {
    f.team(); f.member('owner', 'team', 'owner');
    const filename = `${root}/server/src/db/taskDao.js`;
    const baseline = new Module(filename, module);
    baseline.filename = filename;
    baseline.paths = Module._nodeModulePaths(`${root}/server/src/db`);
    baseline._compile(execFileSync('git', ['show', 'dc6b30d131386c531b2e5a46e986088eb291d1ea:server/src/db/taskDao.js'], { cwd: root, encoding: 'utf8' }), filename);
    const old = baseline.exports;
    let queries = 0;
    const prepare = f.db.prepare.bind(f.db);
    f.db.prepare = sql => { queries++; return prepare(sql); };
    const measure = fn => {
      queries = 0;
      const before = process.memoryUsage().heapUsed;
      const start = performance.now();
      const value = fn();
      return { value, sql: queries, ms: performance.now() - start, heapDelta: process.memoryUsage().heapUsed - before, bytes: Buffer.byteLength(JSON.stringify(value)) };
    };
    let inserted = 0;
    for (const size of [1000, 1500, 3000]) {
      f.db.transaction(() => {
        for (let i = inserted; i < size; i++) {
          f.user(`u${i}`);
          f.task(`t${i}`, { assignee_id: 'owner', participant_ids: JSON.stringify([`u${i}`, `u${i}`, 'missing']), parent_id: i % 4 === 1 ? `t${i - 1}` : null, status: i % 3 ? 'in_progress' : 'done', sort_order: i % 10 });
        }
      })();
      inserted = size;
      for (const method of ['listByTeam', 'listMyTasks', 'listDeletedBy']) {
        const args = method === 'listByTeam' ? ['team', { userId: 'owner' }] : ['owner'];
        if (method === 'listDeletedBy') f.db.prepare("UPDATE tasks SET is_deleted=1, deleted_by='owner'").run();
        const before = measure(() => old[method](...args));
        const after = measure(() => dao[method](...args));
        assert.deepEqual(after.value, before.value);
        assert.equal(after.bytes, before.bytes);
        const times = [];
        const oldTimes = [];
        for (let j = 0; j < 7; j++) {
          oldTimes.push(measure(() => old[method](...args)).ms);
          times.push(measure(() => dao[method](...args)).ms);
        }
        const median = values => values.sort((a,b) => a-b)[3];
        console.log(JSON.stringify({ synthetic: true, driver: 'better-sqlite3', sqlite: f.db.prepare('select sqlite_version() AS v').get().v, size, method, firstBeforeMs: before.ms, firstAfterMs: after.ms, beforeSQL: before.sql, afterSQL: after.sql, warm7BeforeMedianMs: median(oldTimes), warm7AfterMedianMs: median(times), bytes: after.bytes, afterHeapDelta: after.heapDelta, rss: process.memoryUsage().rss }));
        if (method === 'listDeletedBy') f.db.prepare('UPDATE tasks SET is_deleted=0, deleted_by=NULL').run();
      }
    }
    // 有效评论、任务附件；筛选之外及已删祖先；统计不得受到列表筛选影响。
    f.db.prepare("UPDATE tasks SET is_deleted=1 WHERE id='t0'").run();
    f.db.prepare("INSERT INTO comments(id,task_id,user_id,content,created_at,updated_at) VALUES('c','t1','owner','正文','2026','2026')").run();
    f.db.prepare("INSERT INTO task_attachments(id,task_id,user_id,filename,original_name,file_size,created_at) VALUES('a','t1','owner','a.txt','a.txt',1,'2026')").run();
    for (const filters of [{ keyword: 't1' }, { status: 'done' }, { priority: 'high' }, { dueStartDate: '2099' }]) {
      assert.deepEqual(dao.listByTeam('team', { userId:'owner', ...filters }), old.listByTeam('team', { userId:'owner', ...filters }));
      assert.deepEqual(dao.listMyTasks('owner', filters), old.listMyTasks('owner', filters));
    }
    f.task('unrelated', { creator_id:'someone', assignee_id:null });
    f.task('participating', { creator_id:'someone', assignee_id:null, participant_ids:'["owner"]' });
    f.task('personal', { team_id:null, creator_id:'owner' });
    for (const scope of ['all','assigned','created','participating','shared']) {
      assert.deepEqual(dao.listMyTasks('owner',{scope,status:'unfinished'}),old.listMyTasks('owner',{scope,status:'unfinished'}));
    }
    // 使用相同真实 schema 测量新索引的查询计划和局部收益，不把排序成本混入批量补充收益。
    f.db.exec('DROP INDEX idx_tasks_team_active_order');
    const sql='SELECT * FROM tasks WHERE team_id=? AND is_deleted=0 ORDER BY sort_order ASC, created_at DESC';
    const beforePlan=f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all('team');
    const rawMedian=()=>{
      const times=[];
      for(let i=0;i<15;i++){const start=performance.now();f.db.prepare(sql).all('team');times.push(performance.now()-start);}
      return times.sort((a,b)=>a-b)[7];
    };
    const beforeMs=rawMedian();
    f.db.exec('CREATE INDEX idx_tasks_team_active_order ON tasks(team_id,sort_order ASC,created_at DESC) WHERE is_deleted=0');
    const afterPlan=f.db.prepare(`EXPLAIN QUERY PLAN ${sql}`).all('team');
    const afterMs=rawMedian();
    assert.ok(beforePlan.some(row=>row.detail.includes('TEMP B-TREE')));
    assert.ok(afterPlan.some(row=>row.detail.includes('idx_tasks_team_active_order')));
    assert.ok(!afterPlan.some(row=>row.detail.includes('TEMP B-TREE')));
    console.log(JSON.stringify({synthetic:true,index:'idx_tasks_team_active_order',rawQueryWarm15BeforeMedianMs:beforeMs,rawQueryWarm15AfterMedianMs:afterMs,beforePlan,afterPlan}));
  } finally { f.close(); }
});
