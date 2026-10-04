// Runs only against the local Cloudflare preview, using disposable accounts.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes,pbkdf2Sync} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:5173',ids=[];const prefix='MomentsQA_'+randomBytes(3).toString('hex'),password='QA-'+randomUUID();let ip=0;
function sql(text){const file=new URL('moments-qa.sql',root);writeFileSync(file,text);try{const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.cloudflare.json','--file',fileURLToPath(file)],{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);return r.stdout;}finally{unlinkSync(file);}}
async function req(path,body,cookie,origin=base){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'CF-Connecting-IP':`198.51.100.${++ip%250+1}`,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}return{status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function register(suffix){const r=await req('/api/account',{action:'register',username:prefix+suffix,password});assert.equal(r.status,200);const me=(await req('/api/arena',null,r.cookie)).data.me;ids.push(me.id);return{id:me.id,cookie:r.cookie};}

try{
 const a=await register('_a'),b=await register('_b');
 assert.equal((await req('/api/moments')).status,200);assert.equal((await req('/api/moments')).data.balance,null);
 assert.equal((await req('/api/moments',{action:'buy',card:'allen-muniz'})).status,401);
 assert.equal((await req('/api/moments',{action:'buy',card:'allen-muniz'},a.cookie,'https://foreign.example')).status,403);
 const initial=(await req('/api/moments',null,a.cookie)).data.balance;
 assert.equal((await req('/api/moments',{action:'buy',card:'allen-muniz',price:1,user:b.id},a.cookie)).status,400);
 assert.equal((await req('/api/moments',{action:'buy',card:'imaginary'},a.cookie)).status,404);
 const purchases=await Promise.all([req('/api/moments',{action:'buy',card:'allen-muniz'},a.cookie),req('/api/moments',{action:'buy',card:'allen-muniz'},a.cookie)]);assert(purchases.every(r=>r.status===200));
 let collection=(await req('/api/moments',null,a.cookie)).data;assert.equal(collection.balance,initial-100);assert.deepEqual(collection.owned,['allen-muniz']);assert.equal((await req('/api/moments',null,b.cookie)).data.owned.length,0);
 const event=collection.events.find(e=>e.id==='allen-duncan');assert(event);const lineup={action:'lineup',event:event.id,cards:['allen-muniz']};
 assert.equal((await req('/api/moments',lineup,b.cookie)).status,400);assert.equal((await req('/api/moments',{...lineup,user:b.id},a.cookie)).status,400);
 assert.equal((await req('/api/moments',{...lineup,cards:['allen-muniz','allen-muniz']},a.cookie)).status,400);
 assert.equal((await req('/api/moments',lineup,a.cookie)).status,200);collection=(await req('/api/moments',null,a.cookie)).data;assert.equal(collection.plays.length,1);assert.equal(collection.plays[0].user,a.id);assert.equal(collection.plays[0].fighter,'brendan-allen');assert.equal(collection.plays[0].state,'pending');
 assert.equal((await req('/api/moments',{...lineup,cards:[]},a.cookie)).status,200);assert.equal((await req('/api/moments',null,a.cookie)).data.plays.length,0);
 assert.equal((await req('/api/moments',{...lineup,event:collection.events.find(e=>e.replay).id},a.cookie)).status,400);
 const publicBoard=await req('/api/leaderboard');assert.equal(publicBoard.status,200);assert.equal(publicBoard.data.me,null);assert(publicBoard.data.leaders.every(p=>!('email' in p)&&!('password_hash' in p)));assert.equal((await req('/api/leaderboard?scope=friends')).status,401);
 const mine=(await req('/api/leaderboard?scope=friends',null,a.cookie)).data;assert.equal(mine.me.id,a.id);assert.equal(mine.me.balance,initial-100);assert.equal(mine.leaders.length,1);assert.equal(mine.me.rank,1);
 await req('/api/social',{action:'request',target:b.id},a.cookie);await req('/api/social',{action:'accept',target:a.id},b.cookie);assert.equal((await req('/api/leaderboard?scope=friends',null,a.cookie)).data.leaders.length,2);
 await req('/api/social',{action:'block',target:b.id},a.cookie);assert.equal((await req('/api/leaderboard?scope=friends',null,a.cookie)).data.leaders.length,1);
 console.log('PASS: guest browsing, auth/origin protection, actor and price forgery rejection, concurrent one-time purchases, private ownership, owned-only lineups, duplicate rejection, persistence/clear, replay exclusion, safe leaderboard fields, personal rank, friends and blocking.');
}finally{if(ids.length)sql(ids.map(id=>`DELETE FROM follows WHERE user='${id}' OR target='${id}';DELETE FROM auth_accounts WHERE id='${id}';DELETE FROM users WHERE id='${id}';`).join(''));}
