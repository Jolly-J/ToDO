const test = require('node:test');
const assert = require('node:assert/strict');
const { performance } = require('node:perf_hooks');
const { fixture } = require('./helpers/taskflow-fixture');
const express = require('../node_modules/express');

test('1500 合成任务隔离 HTTP：真实路由/权限/驱动，全量响应测量', async () => {
  const f=await fixture();
  let server;
  try {
    f.team(); f.member('owner','team','owner');
    f.db.transaction(()=>{for(let i=0;i<1500;i++){f.user(`user${i}`);f.task(`task${i}`,{assignee_id:'owner',participant_ids:JSON.stringify([`user${i}`]),description:'合成描述'.repeat(20)});}})();
    const app=express();
    app.use((req,res,next)=>{req.user={id:'owner'};next();});
    app.use(require('../src/routes/taskCollections'));
    server=await new Promise((resolve,reject)=>{const s=app.listen(0,'127.0.0.1',error=>error?reject(error):resolve(s));s.once('error',reject);});
    const base=`http://127.0.0.1:${server.address().port}`;
    for(const endpoint of ['/teams/team/tasks?view=list','/my-tasks?scope=all']) {
      const times=[];let bytes=0;const heapBefore=process.memoryUsage().heapUsed;
      for(let i=0;i<8;i++){
        const start=performance.now();const response=await fetch(base+endpoint);assert.equal(response.status,200);
        const body=await response.arrayBuffer();bytes=body.byteLength;times.push(performance.now()-start);
        assert.equal(JSON.parse(Buffer.from(body).toString()).data.list.length,1500);
      }
      const firstMs=times.shift();const medianMs=times.sort((a,b)=>a-b)[3];
      console.log(JSON.stringify({synthetic:true,layer:'isolated HTTP loopback',size:1500,endpoint,firstMs,warm7MedianMs:medianMs,responseBytes:bytes,heapBefore,heapAfter:process.memoryUsage().heapUsed,rss:process.memoryUsage().rss}));
    }
  } finally {if(server)await new Promise(resolve=>server.close(resolve));f.close();}
});
