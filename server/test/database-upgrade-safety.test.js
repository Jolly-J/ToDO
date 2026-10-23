const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const Database = require('../node_modules/better-sqlite3');
const knex = require('../node_modules/knex');
const { fixture, config, stub, root } = require('./helpers/taskflow-fixture');
const { runAtomicMigrations } = require('../src/db/migrationRunner');
const { backupBundle, restoreBundle, hash } = require('../src/db/backupBundle');
const { prepareDatabasePath } = require('../src/db/databasePath');

const migrationsDir = path.join(root, 'server/src/migrations');
const files = fs.readdirSync(migrationsDir).filter(name=>name.endsWith('.js')).sort();
const snapshot = db => Object.fromEntries(['tasks','comments','task_attachments','comment_attachments','knex_migrations'].map(table=>[table,db.prepare(`SELECT * FROM ${table} ORDER BY id`).all()]));

async function oldDatabase(filename, before) {
  const cfg = config(filename);
  delete cfg.migrations.directory;
  cfg.migrations.migrationSource = {
    getMigrations: () => Promise.resolve(files.filter(name=>name < before)),
    getMigrationName: name => name,
    getMigration: name => require(path.join(migrationsDir,name)),
  };
  const k = knex(cfg);
  try { await runAtomicMigrations(k); } finally { await k.destroy(); }
  const db = new Database(filename);
  const stamp='2026-10-01T00:00:00.000Z';
  db.exec(`INSERT INTO users(id,name,created_at,updated_at) VALUES('u','合成用户','${stamp}','${stamp}');
    INSERT INTO teams(id,name,level,owner_id,created_at,updated_at) VALUES('team','合成团队','team','u','${stamp}','${stamp}');
    INSERT INTO tasks(id,title,status,priority,team_id,creator_id,participant_ids,created_at,updated_at) VALUES('task','任务','in_progress','medium','team','u','[]','${stamp}','${stamp}');
    INSERT INTO comments(id,task_id,user_id,content,created_at,updated_at) VALUES('comment','task','u','原始评论内容','${stamp}','${stamp}');`);
  for (const table of ['task_attachments','comment_attachments']) {
    const file=path.join(path.dirname(filename),`${table}.txt`);
    fs.writeFileSync(file,`${table} 合成文件正文`);
    const fields={ id:table,task_id:'task',user_id:'u',filename:`${table}.txt`,original_name:'原名.txt',file_size:fs.statSync(file).size,mime_type:'text/plain',physical_path:file,created_at:stamp };
    if (table==='comment_attachments') fields.comment_id='comment';
    const keys=Object.keys(fields);
    db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(key=>`@${key}`).join(',')})`).run(fields);
  }
  const result=snapshot(db);
  db.close();
  return result;
}

function stagePattern(table, kind, stage) {
  const identifier = kind === 'knex' ? '[`"\\[]?_knex_temp_alter' : table + '_new';
  return {
    CREATE: new RegExp('^CREATE TABLE ' + identifier, 'i'),
    COPY: new RegExp('^INSERT INTO ' + identifier, 'i'),
    DROP: new RegExp('^DROP TABLE [`"\\[]?' + table + '[`"\\]]?;?$', 'i'),
    RENAME: new RegExp('^ALTER TABLE ' + identifier + '.+RENAME TO', 'i'),
    LEDGER: /^insert into [`"]?knex_migrations[`"]? /i,
  }[stage];
}

test('历史附件和任务重建各阶段失败：记录/关联/文件哈希及账本原子回滚，之后可重试', async () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taskflow-upgrade-'));
  try {
    for (const [before,table,kind] of [['20260416000002','task_attachments','handwritten'],['20260829000001','tasks','handwritten'],['20260829000002','tasks','knex']]) {
      const seed=path.join(dir,`seed-${table}-${kind}.db`);
      const expected=await oldDatabase(seed,before);
      const fileHashes=expected.task_attachments.concat(expected.comment_attachments).map(row=>[row.physical_path,hash(row.physical_path)]);
      for (const stage of ['CREATE','COPY','DROP','RENAME','LEDGER']) {
        const filename=path.join(dir,`${table}-${kind}-${stage}.db`);
        fs.copyFileSync(seed,filename);
        const k=knex(config(filename));
        const clientPrototype=k.client.constructor.prototype;
        const original=clientPrototype._query;
        let fired=false;
        clientPrototype._query=async function(conn,query) {
          const sql=query.sql.trim();
          const value=await original.call(this,conn,query);
          if (!fired && stagePattern(table,kind,stage).test(sql)) {
            fired=true;
            console.log(JSON.stringify({migrationBoundary:before,kind,stage,sql}));
            throw new Error(`injected-after-${stage}`);
          }
          return value;
        };
        try {
          await assert.rejects(runAtomicMigrations(k),new RegExp(`injected-after-${stage}`));
          assert.equal(fired,true,`${table} ${stage} 故障必须实际触发`);
          assert.equal((await k.raw('PRAGMA foreign_keys'))[0].foreign_keys,1);
        } finally { clientPrototype._query=original; await k.destroy(); }
        const failed=new Database(filename);
        assert.deepEqual(snapshot(failed),expected,`${table} ${stage} 原始行和账本必须全部保留`);
        assert.equal(failed.prepare("SELECT count(*) AS c FROM sqlite_master WHERE name LIKE '%_new' OR name LIKE '_knex_temp_alter%'").get().c,0);
        assert.deepEqual(failed.pragma('foreign_key_check'),[]);
        assert.equal(failed.pragma('integrity_check',{simple:true}),'ok');
        failed.close();
        for (const [file,digest] of fileHashes) assert.equal(hash(file),digest);
        const retry=knex(config(filename));
        try { await runAtomicMigrations(retry); await runAtomicMigrations(retry); } finally { await retry.destroy(); }
        const upgraded=new Database(filename);
        for (const name of ['comments','task_attachments','comment_attachments']) assert.deepEqual(snapshot(upgraded)[name],expected[name]);
        assert.equal(upgraded.prepare('SELECT COUNT(*) AS c FROM knex_migrations').get().c,files.length);
        assert.deepEqual(upgraded.pragma('foreign_key_check'),[]);
        assert.equal(upgraded.pragma('integrity_check',{simple:true}),'ok');
        upgraded.close();
      }
      if (table==='tasks') for (const stage of ['DROP','LEDGER']) {
        const filename=path.join(dir,`crash-${kind}-${stage}.db`);
        fs.copyFileSync(seed,filename);
        const script=path.join(dir,`crash-${kind}-${stage}.js`);
        fs.writeFileSync(script,`
          const {config}=require(${JSON.stringify(path.join(root,'server/test/helpers/taskflow-fixture'))});
          const knex=require(${JSON.stringify(path.join(root,'server/node_modules/knex'))});
          const {runAtomicMigrations}=require(${JSON.stringify(path.join(root,'server/src/db/migrationRunner'))});
          const k=knex(config(${JSON.stringify(filename)}));
          const proto=k.client.constructor.prototype;
          const original=proto._query;
          proto._query=async function(conn,q){const result=await original.call(this,conn,q);
            if (new RegExp(${JSON.stringify(stagePattern(table,kind,stage).source)},'i').test(q.sql.trim())) process.kill(process.pid,'SIGKILL');
            return result;
          };
          runAtomicMigrations(k).then(()=>k.destroy()).catch(error=>{console.error(error.message);process.exit(2);});
        `);
        const result=spawnSync(process.execPath,[script],{encoding:'utf8',timeout:10000});
        assert.equal(result.signal,'SIGKILL',`${stage}: ${result.stderr}`);
        console.log(JSON.stringify({migrationBoundary:before,kind,stage,signal:result.signal}));
        const recovered=new Database(filename);
        assert.deepEqual(snapshot(recovered),expected);
        assert.deepEqual(recovered.pragma('foreign_key_check'),[]);
        assert.equal(recovered.pragma('integrity_check',{simple:true}),'ok');
        recovered.close();
        const retry=knex(config(filename));
        try {await runAtomicMigrations(retry);} finally {await retry.destroy();}
      }
    }
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});

test('完整旧账本→新索引→重复执行/重启与可逆索引；备份恢复下载及 app 启动清理', async () => {
  const f=await fixture();
  try {
    f.team(); f.member('owner','team','owner'); f.task('task');
    const db=f.db;
    const taskDao=require('../src/db/taskDao');
    const attachmentDao=require('../src/modules/attachment/attachment.dao');
    const comments=require('../src/db/commentDao');
    const makeFile=name=>{const filename=path.join(f.dir,name);fs.writeFileSync(filename,name);return {path:filename,filename:name,originalname:name,size:name.length,mimetype:'text/plain'};};
    const att=attachmentDao.createAttachment(makeFile('task.txt'),'task','owner');
    const pending=comments.commentAttachmentDao.createPending(makeFile('comment.txt'),'task','owner');
    comments.create({id:'comment',task_id:'task',user_id:'owner',content:'评论正文'},[pending.id]);
    const orphan=comments.commentAttachmentDao.createPending(makeFile('orphan.txt'),'task','owner');
    db.prepare("UPDATE comment_attachments SET created_at='2000-01-01T00:00:00.000Z'").run();
    const baseline=snapshot(db);
    const indexName='20261023000001_add_task_list_order_index.js';
    db.exec('DROP INDEX idx_tasks_team_active_order');
    db.prepare('DELETE FROM knex_migrations WHERE name=?').run(indexName);
    const knexConfig=require('../knexfile');
    const originalFilename=knexConfig.connection.filename;
    const originalPath=process.env.DB_PATH;
    knexConfig.connection.filename=f.filename;
    process.env.DB_PATH=f.filename;
    try {
      await require('../src/db/initDb').initDb();
      assert.deepEqual((await require('../src/db/migrationRunner').runMigrations()).executed,[]);
    } finally {
      await require('../src/db/migrationRunner').closeKnex();
      knexConfig.connection.filename=originalFilename;
      if (originalPath===undefined) delete process.env.DB_PATH; else process.env.DB_PATH=originalPath;
    }
    const k=knex(config(f.filename));
    try {
      const first=await runAtomicMigrations(k);
      assert.deepEqual(first[1],[]);
      assert.deepEqual((await runAtomicMigrations(k))[1],[]);
      await require(path.join(migrationsDir,indexName)).down(k);
      await require(path.join(migrationsDir,indexName)).up(k);
    } finally { await k.destroy(); }
    for (const table of ['comments','task_attachments','comment_attachments']) assert.deepEqual(snapshot(db)[table],baseline[table]);
    const restart=knex(config(f.filename));
    try { assert.deepEqual((await runAtomicMigrations(restart))[1],[]); } finally { await restart.destroy(); }
    const bundle=path.join(f.dir,'bundle');
    await backupBundle(db,bundle);
    const restoredFile=restoreBundle(bundle,path.join(f.dir,'restored'));
    const restored=new Database(restoredFile);
    try {
      f.use(restored);
      const download=attachmentDao.resolveDownload(att.id,'owner');
      assert.equal(hash(download.physical_path),hash(att.physical_path));
      assert.equal(hash(comments.commentAttachmentDao.resolveDownload(pending.id,'owner').physical_path),hash(pending.physical_path));
      assert.equal(taskDao.findById('task').title,'task');
      assert.deepEqual(restored.prepare('SELECT * FROM comments').all(),db.prepare('SELECT * FROM comments').all());
      // 真正调用 app.startServer；只替换 HTTP、路由装配和定时器，保留启动时的真实 cleanup。
      let listens=0, intervals=0;
      const fakeApp={ disable(){}, set(){}, use(){} };
      fakeApp.listen=()=>{ throw new Error('HTTP 必须被 stub'); };
      const fakeExpress=()=>fakeApp;
      fakeExpress.json=()=>()=>{}; fakeExpress.urlencoded=()=>()=>{}; fakeExpress.static=()=>()=>{};
      fakeApp.listen=(port,host,cb)=>{listens++;const server={address:()=>({port}),on(){}};queueMicrotask(cb);return server;};
      stub('server/node_modules/express/index.js',fakeExpress);
      stub('server/src/routes/index.js',{registerApiRoutes(){}});
      stub('server/src/middlewares/requestLogger.js',{createRequestLogger:()=>()=>{}});
      stub('server/src/utils/logger.js',{setLogLevel(){},debug(){},info(){},warn(){},error(){}});
      const originalInterval=global.setInterval;
      global.setInterval=()=>{intervals++;return {synthetic:true};};
      try { await require('../src/app').startServer(12345); }
      finally { global.setInterval=originalInterval;require('../src/utils/cleanup').stopCleanupScheduler(); }
      assert.equal(listens,1);assert.equal(intervals,1);
      assert.equal(comments.commentAttachmentDao.findById(orphan.id),null);
      assert.equal(fs.existsSync(comments.commentAttachmentDao.findById(pending.id).physical_path),true);
      assert.equal(hash(comments.commentAttachmentDao.findById(pending.id).physical_path),hash(pending.physical_path));
      assert.equal(hash(attachmentDao.resolveDownload(att.id,'owner').physical_path),hash(att.physical_path));
      assert.deepEqual(restored.prepare('SELECT * FROM comments').all(),db.prepare('SELECT * FROM comments').all());
      assert.equal(comments.commentAttachmentDao.findById(pending.id).comment_id,'comment');
      assert.deepEqual(restored.pragma('foreign_key_check'),[]);
    } finally { restored.close(); f.use(db); }
  } finally { f.close(); }
});

test('默认旧库在任何迁移前选择，显式测试路径不搬库，双库时停止而不覆盖', () => {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'taskflow-path-'));
  try {
    const legacy=path.join(dir,'taskflow.db');const target=path.join(dir,'server/data/taskflow.db');
    fs.writeFileSync(legacy,'synthetic');
    prepareDatabasePath(path.join(dir,'explicit.db'),{rootDir:dir,explicit:true});
    assert.equal(fs.readFileSync(legacy,'utf8'),'synthetic');
    prepareDatabasePath(target,{rootDir:dir,explicit:false});
    assert.equal(fs.readFileSync(target,'utf8'),'synthetic');
    fs.writeFileSync(legacy,'other');
    assert.throws(()=>prepareDatabasePath(target,{rootDir:dir,explicit:false}),/同时存在旧库/);
    assert.equal(fs.readFileSync(legacy,'utf8'),'other');assert.equal(fs.readFileSync(target,'utf8'),'synthetic');
  } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
