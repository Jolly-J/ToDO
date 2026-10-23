const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { fixture, stub } = require('./helpers/taskflow-fixture');
const taskDao = require('../src/db/taskDao');
const attachmentDao = require('../src/modules/attachment/attachment.dao');
const comments = require('../src/db/commentDao');
const { assertTaskWritable } = require('../src/modules/attachment/attachment.access');
const { authorizedTaskUpload, parseBounded } = require('../src/modules/attachment/attachment.upload');
const express = require('../node_modules/express');

test('团队读取、self 子孙、个人任务、归档、附件写入及绑定权限矩阵', async () => {
  const f = await fixture();
  let server;
  try {
    f.team();
    f.user('outsider'); f.user('super');
    f.member('self', 'team', 'member', 'self'); f.member('normal'); f.member('admin', 'team', 'admin', 'self');
    const role = f.db.prepare("SELECT id FROM global_roles WHERE code='super_admin'").get();
    f.db.prepare("INSERT INTO user_global_roles(id,user_id,role_id,assigned_at) VALUES('super-role','super',?,'2026')").run(role.id);
    f.task('root', { assignee_id: 'self' });
    f.task('hidden', { parent_id: 'root' });
    f.task('visible', { parent_id: 'root', participant_ids: '["self"]' });
    f.task('grandchild', { parent_id: 'hidden', assignee_id: 'self' });
    f.task('personal', { team_id: null, creator_id: 'self' });
    f.task('canceled', { status: 'canceled', assignee_id: 'self' });
    f.task('deleted', { is_deleted: 1, deleted_by: 'self' });
    assert.throws(() => taskDao.listByTeam('team', { userId: 'outsider' }), { status: 403 });
    assert.throws(() => taskDao.listByTeam('team'), { status: 403 });
    for (const id of ['owner', 'admin', 'super', 'normal']) assert.equal(taskDao.listByTeam('team', { userId:id }).total, 5);
    assert.deepEqual(taskDao.listSubtasks('root', { userId:'self', includeSubtasks:true }).map(task=>task.id), ['visible']);
    assert.equal(taskDao.canUserAccessVisibleTask(taskDao.findById('grandchild'), 'self'), true);
    assert.equal(taskDao.canUserAccessVisibleTask(taskDao.findById('personal'), 'outsider'), false);
    assert.equal(taskDao.canUserAccessVisibleTask(taskDao.findById('personal'), 'self'), true);
    f.db.prepare("UPDATE teams SET is_archived=1 WHERE id='team'").run();
    assert.equal(taskDao.listByTeam('team', { userId:'normal' }).total, 5);
    assert.equal(taskDao.listByTeam('team', { userId:'normal' }).list[0].can_view_team_members, false);
    f.db.prepare("UPDATE teams SET is_archived=0 WHERE id='team'").run();
    for (const [taskId, user, status] of [['root','outsider',403], ['hidden','self',403], ['root','normal',403], ['deleted','self',404], ['canceled','self',409], ['absent','super',404]]) {
      assert.throws(() => assertTaskWritable(taskId, user), { status });
    }
    for (const user of ['self','admin','super']) assertTaskWritable('root', user);
    f.member('wild%card','team','member','self');
    f.task('wildcard-unrelated', { participant_ids:'["wild-other-card"]' });
    assert.equal(taskDao.listByTeam('team',{userId:'wild%card'}).total,0);
    f.task('wildcard-related', { participant_ids:'["wild%card"]' });
    assert.deepEqual(taskDao.listByTeam('team',{userId:'wild%card'}).list.map(task=>task.id),['wildcard-related']);
    const file = name => {
      const filename = path.join(f.dir, name);
      fs.writeFileSync(filename, '合成附件');
      return { filename:name, originalname:name, path:filename, size:12, mimetype:'text/plain' };
    };
    const hiddenAttachment = attachmentDao.createAttachment(file('hidden.txt'), 'hidden', 'owner');
    const ownAttachment = attachmentDao.createAttachment(file('own.txt'), 'root', 'self');
    assert.equal(attachmentDao.resolveDownload(hiddenAttachment.id, 'self'), null);
    assert.ok(attachmentDao.resolveDownload(ownAttachment.id, 'self'));
    f.member('reader');
    f.db.prepare("UPDATE tasks SET participant_ids='[\"reader\"]' WHERE id='root'").run();
    const readerDetail=taskDao.findById('root',{enrich:true,userId:'reader',includeAttachments:true,includeSubtasks:true});
    assert.ok(readerDetail.subtasks.some(task=>task.id==='hidden'));
    assert.equal(readerDetail.subtasks.find(task=>task.id==='hidden').attachments,undefined);
    assert.equal(taskDao.findById('root', { enrich:true, userId:'self', includeAttachments:true, includeSubtasks:true }).subtasks.some(task=>task.id==='hidden'), false);
    f.db.prepare("UPDATE team_members SET task_visibility_scope='self' WHERE user_id='normal'").run();
    // 可看父任务不应继承附件权限到另一条仅基础可见的子任务。
    const detail = taskDao.findById('root', { enrich:true, userId:'owner', includeAttachments:true, includeSubtasks:true });
    assert.equal(detail.subtasks.find(task=>task.id==='hidden').attachments.length, 1);
    const pending = comments.commentAttachmentDao.createPending(file('comment.txt'), 'root', 'self');
    const foreign = comments.commentAttachmentDao.createPending(file('foreign.txt'), 'root', 'owner');
    const otherTask = comments.commentAttachmentDao.createPending(file('other.txt'), 'visible', 'self');
    const create = (id, ids) => comments.create({ id, task_id:'root', user_id:'self', content:'评论' }, ids);
    for (const ids of [[foreign.id], [otherTask.id], ['unknown'], [pending.id, foreign.id]]) {
      assert.throws(() => create('rejected', ids), { status:403 });
      assert.equal(f.db.prepare("SELECT * FROM comments WHERE id='rejected'").get(), undefined);
      assert.equal(comments.commentAttachmentDao.findById(pending.id).comment_id, null);
    }
    create('valid', [pending.id, pending.id]);
    assert.equal(comments.commentAttachmentDao.findById(pending.id).comment_id, 'valid');
    assert.throws(() => create('rebind', [pending.id]), { status:403 });
    assert.equal(comments.commentAttachmentDao.findById(pending.id).comment_id, 'valid');
    f.db.prepare("UPDATE tasks SET assignee_id=NULL WHERE id='root'").run();
    assert.throws(() => attachmentDao.deleteAttachment(ownAttachment.id, 'self'), { status:403 });
    assert.equal(fs.existsSync(ownAttachment.physical_path), true);
    f.member('allreader');
    const childTaskAttachment=attachmentDao.createAttachment(file('child-task.txt'),'visible','self');
    const childCommentAttachment=comments.commentAttachmentDao.createPending(file('child-comment.txt'),'visible','self');
    comments.create({id:'child-comment',task_id:'visible',user_id:'self',content:'子任务评论'},[childCommentAttachment.id]);

    // HTTP harness：只监听临时 loopback；无 app/bootstrap/通知/定时器。
    const app = express();
    app.use((req,res,next) => { req.user={ id:req.headers['x-user'] }; next(); });
    app.use(require('../src/routes/taskCollections'));
    const uploadMiddleware = require('../src/middlewares/upload');
    stub('server/src/middlewares/upload.js', { ...uploadMiddleware, upload: uploadMiddleware.createUploader({ dest:path.join(f.dir,'pending-uploads') }) });
    stub('server/src/modules/attachment/attachment.upload.js', { authorizedTaskUpload: options => authorizedTaskUpload({ ...options, dest:path.join(f.dir,'route-uploads') }) });
    stub('server/src/middlewares/auth.js', { auth(req,res,next) { next(); } });
    app.use('/attachments', require('../src/modules/attachment/attachment.routes'));
    app.use('/tasks', require('../src/routes/tasks'));
    app.use('/legacy-attachments', require('../src/routes/attachments'));
    app.post('/upload', authorizedTaskUpload({ dest:path.join(f.dir,'uploads') }), (req,res)=>res.json({ ok:true }));
    app.use((err,req,res,next)=>res.status(err.status||500).json({ message:err.message }));
    server = await new Promise((resolve, reject) => { const s=app.listen(0,'127.0.0.1',error=>error ? reject(error) : resolve(s)); s.once('error', reject); });
    const base=`http://127.0.0.1:${server.address().port}`;
    for (const view of ['list','board','calendar']) {
      const res=await fetch(`${base}/teams/team/tasks?view=${view}`, { headers:{'x-user':'outsider'} });
      assert.equal(res.status,403);
    }
    for(const endpoint of [`/attachments/${ownAttachment.id}/download`,`/legacy-attachments/${ownAttachment.id}/download`,`/attachments/comment-attachments/${pending.id}/download`]){
      assert.equal((await fetch(base+endpoint,{headers:{'x-user':'allreader'}})).status,404,endpoint);
      for(const user of ['reader','admin','super'])assert.equal((await fetch(base+endpoint,{headers:{'x-user':user}})).status,200,`${user} ${endpoint}`);
    }
    for(const endpoint of [`/attachments/${childTaskAttachment.id}/download`,`/attachments/comment-attachments/${childCommentAttachment.id}/download`]){
      assert.equal((await fetch(base+endpoint,{headers:{'x-user':'self'}})).status,200);
      assert.equal((await fetch(base+endpoint,{headers:{'x-user':'allreader'}})).status,404);
    }
    assert.equal((await fetch(`${base}/attachments/${hiddenAttachment.id}/download`,{headers:{'x-user':'self'}})).status,404);
    for (const user of ['outsider','self']) {
      const body = new FormData();
      body.append('file', new Blob(['test']), 'test.txt'); // 故意将文件放在 taskId 前。
      body.append('taskId','root');
      const res=await fetch(`${base}/upload`, { method:'POST', headers:{'x-user':user}, body });
      assert.equal(res.status,403);
      assert.equal(fs.existsSync(path.join(f.dir,'uploads')), false);
    }
    for (const endpoint of ['/attachments/upload','/attachments/comment-attachments','/attachments/rich-text-images','/tasks/root/attachments']) {
      const body=new FormData();body.append(endpoint.startsWith('/tasks')?'files':'file',new Blob(['test']),'test.txt');body.append('taskId','root');
      const res=await fetch(`${base}${endpoint}`, {method:'POST',headers:{'x-user':'outsider'},body});
      assert.equal(res.status,403,endpoint);
      assert.equal(fs.existsSync(path.join(f.dir,'route-uploads')),false);
    }
    // 新任务预上传保持合法，不要求尚不存在的任务 ID。
    const preupload=new FormData();preupload.append('file',new Blob(['new task attachment']),'new.txt');
    const result=await fetch(`${base}/attachments/task-attachments/pending`,{method:'POST',headers:{'x-user':'owner'},body:preupload});
    assert.equal(result.status,200);
    const body=await result.json();
    assert.equal(body.data.task_id,null);
    assert.equal(body.data.physical_path,undefined);
    assert.equal(attachmentDao.findAttachmentById(body.data.id).user_id,'owner');
  } finally { if (server) await new Promise(resolve=>server.close(resolve)); f.close(); }
});

test('上传总请求流量、内存并发上限及路由任务预授权', async () => {
  const { Readable, PassThrough }=require('node:stream');
  const { createUploader }=require('../src/middlewares/upload');
  const makeHeaders=()=>({'content-type':'multipart/form-data; boundary=taskflow','transfer-encoding':'chunked'});
  const content=Buffer.from('--taskflow\r\nContent-Disposition: form-data; name="file"; filename="x.txt"\r\nContent-Type: text/plain\r\n\r\n'+ 'x'.repeat(2048)+'\r\n--taskflow--\r\n');
  const req=Readable.from([content.subarray(0,80),content.subarray(80)]);req.headers=makeHeaders();
  const error=await new Promise(resolve=>parseBounded(req,{},createUploader({memory:true}).single('file'),128,resolve));
  assert.equal(error.status,413);
  const known={params:{id:'unavailable'},user:{id:'nobody'},pipe(){throw new Error('不能在授权前读取文件');}};
  // 不访问已关闭的合成库；假任务省略 ID 直接拒绝。
  known.params.id='';
  let denied;
  authorizedTaskUpload({taskParam:'id'})(known,{},err=>{denied=err;});
  assert.equal(denied.status,404);
  const uploader=authorizedTaskUpload();
  const held=[new PassThrough(),new PassThrough()];
  const done=held.map(stream=>{stream.headers=makeHeaders();return new Promise(resolve=>uploader(stream,{},resolve));});
  let third;
  uploader({headers:makeHeaders()},{},err=>{third=err;});
  assert.equal(third.status,429);
  held.forEach(stream=>stream.destroy(new Error('synthetic abort')));
  await Promise.all(done);
});
