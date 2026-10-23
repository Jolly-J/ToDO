const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const Database = require('../node_modules/better-sqlite3');
const { fixture } = require('./helpers/taskflow-fixture');
const { backupBundle, restoreBundle, hash } = require('../src/db/backupBundle');
const attachments = require('../src/modules/attachment/attachment.dao');
const comments = require('../src/db/commentDao');

test('恢复拒绝漏项、重复、未知记录、穿越及符号链接；清理恢复附件不影响源文件', async () => {
  const f=await fixture();
  try {
    f.team();f.member('owner','team','owner');f.task('task');
    const file=name=>{const filename=path.join(f.dir,name);fs.writeFileSync(filename,name);return {path:filename,filename:name,originalname:name,size:name.length,mimetype:'text/plain'};};
    attachments.createAttachment(file('task.txt'),'task','owner');
    const bound=comments.commentAttachmentDao.createPending(file('bound.txt'),'task','owner');
    comments.create({id:'comment',task_id:'task',user_id:'owner',content:'有效正文'},[bound.id]);
    const orphan=comments.commentAttachmentDao.createPending(file('orphan.txt'),'task','owner');
    f.db.prepare("UPDATE comment_attachments SET created_at='2000-01-01T00:00:00.000Z'").run();
    const bundle=path.join(f.dir,'bundle');const manifest=await backupBundle(f.db,bundle);
    const originals=manifest.files.map(entry=>[entry.originalPath,hash(entry.originalPath)]);
    const sourceRows=f.db.prepare('SELECT * FROM comment_attachments ORDER BY id').all();
    const cases={
      omitted(m){m.files=m.files.filter(entry=>entry.id!==orphan.id);},
      duplicate(m){m.files.push({...m.files[0]});},
      duplicateRecord(m,dir){const extra={...m.files[0],file:'attachments/999'};fs.copyFileSync(path.join(dir,m.files[0].file),path.join(dir,extra.file));m.files.push(extra);},
      unknown(m){m.files[0].id='unknown-id';},
      traversal(m){m.files[0].file='../outside.txt';},
      absolute(m){m.files[0].file=originals[0][0];},
      fileSymlink(m,dir){const filename=path.join(dir,m.files[0].file);fs.unlinkSync(filename);fs.symlinkSync(originals[0][0],filename);},
      directorySymlink(m,dir){const moved=path.join(f.dir,'outside-attachments');fs.renameSync(path.join(dir,'attachments'),moved);fs.symlinkSync(moved,path.join(dir,'attachments'));},
    };
    for(const [name,mutate] of Object.entries(cases)){
      const variant=path.join(f.dir,name);fs.cpSync(bundle,variant,{recursive:true});
      const changed=JSON.parse(JSON.stringify(manifest));mutate(changed,variant);
      fs.writeFileSync(path.join(variant,'manifest.json'),JSON.stringify(changed));
      const target=path.join(f.dir,`restore-${name}`);
      assert.throws(()=>restoreBundle(variant,target),undefined,name);
      assert.equal(fs.existsSync(target),false,`${name} 必须在建立恢复目录前失败`);
      for(const [filename,digest] of originals)assert.equal(hash(filename),digest,`${name} 不得改源文件`);
      assert.deepEqual(f.db.prepare('SELECT * FROM comment_attachments ORDER BY id').all(),sourceRows);
    }
    const restoredFile=restoreBundle(bundle,path.join(f.dir,'valid'));
    const restored=new Database(restoredFile);
    try {
      const root=fs.realpathSync(path.dirname(restoredFile));
      for(const table of ['task_attachments','comment_attachments'])for(const row of restored.prepare(`SELECT physical_path FROM ${table}`).all()){
        assert.ok(row.physical_path.startsWith(root+path.sep));assert.equal(fs.realpathSync(row.physical_path),row.physical_path);
      }
      f.use(restored);
      assert.equal(comments.commentAttachmentDao.cleanupOrphaned(24),1);
      assert.equal(comments.commentAttachmentDao.findById(bound.id).comment_id,'comment');
      for(const [filename,digest] of originals)assert.equal(hash(filename),digest);
      assert.equal(fs.existsSync(orphan.physical_path),true);
    } finally {restored.close();f.use(f.db);}
  } finally {f.close();}
});

test('大文件哈希以固定 64KiB 分块，不调用 readFileSync 读取整文件', async () => {
  const f=await fixture();
  try {
    const filename=path.join(f.dir,'large.bin');
    const block=Buffer.alloc(64*1024,0x5a);
    const expected=crypto.createHash('sha256');
    const fd=fs.openSync(filename,'wx');
    try {for(let i=0;i<256;i++){fs.writeSync(fd,block);expected.update(block);}}finally{fs.closeSync(fd);}
    const readFile=fs.readFileSync;const read=fs.readSync;let maxRead=0;
    fs.readFileSync=()=>{throw new Error('禁止整文件读入内存');};
    fs.readSync=(fd,buffer,offset,length,position)=>{maxRead=Math.max(maxRead,length);return read(fd,buffer,offset,length,position);};
    try {assert.equal(hash(filename),expected.digest('hex'));assert.equal(maxRead,64*1024);}
    finally {fs.readFileSync=readFile;fs.readSync=read;}
  } finally {f.close();}
});
