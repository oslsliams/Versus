// Only disposable local accounts. Existing users and wallets are never edited.
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {writeFileSync,unlinkSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {moments} from '../lib/moments.ts';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:5173',ids=[],prefix='ShowcaseQA_'+randomBytes(3).toString('hex');let ip=30;
async function req(path,body,cookie,origin=base){const r=await fetch(base+path,{method:body?'POST':'GET',headers:{Origin:origin,'CF-Connecting-IP':`198.51.100.${++ip%250+1}`,...(body?{'Content-Type':'application/json'}:{}),...(cookie?{Cookie:cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});const raw=await r.text();let data;try{data=JSON.parse(raw);}catch{data={error:raw.slice(0,200)};}return{status:r.status,data,cookie:r.headers.get('set-cookie')?.split(';')[0]};}
async function register(n){const r=await req('/api/account',{action:'register',username:prefix+n,password:'QA-'+randomUUID()});assert.equal(r.status,200);const me=(await req('/api/arena',null,r.cookie)).data.me;ids.push(me.id);return{id:me.id,cookie:r.cookie};}
try{const a=await register('_a'),b=await register('_b');const card=moments.find(m=>m.id.startsWith('ranked-'));
assert.equal((await req('/api/showcase',{cards:[],caption:''})).status,401);assert.equal((await req('/api/showcase',{cards:[],caption:''},a.cookie,'https://evil.example')).status,403);
assert.equal((await req('/api/showcase',{cards:[card.id],caption:'Unowned'},a.cookie)).status,400);
assert.equal((await req('/api/moments',{action:'buy',card:card.id},a.cookie)).status,200);
assert.equal((await req('/api/showcase',{cards:[card.id,card.id],caption:''},a.cookie)).status,400);
assert.equal((await req('/api/showcase',{cards:[card.id],caption:'My favorite UFC memory'},a.cookie)).status,200);
const own=(await req('/api/showcase?user='+a.id,null,a.cookie)).data;assert.deepEqual(own.cards,[card.id]);assert.ok(own.owned.includes(card.id));
const publicView=(await req('/api/showcase?user='+a.id,null,b.cookie)).data;assert.deepEqual(publicView.cards,[card.id]);assert.deepEqual(publicView.owned,[]);assert.equal(publicView.mine,false);
assert.equal((await req('/api/showcase',{cards:[card.id],caption:'Forged ownership'},b.cookie)).status,400);
assert.equal((await req('/api/showcase',{cards:[],caption:''},a.cookie)).status,200);assert.deepEqual((await req('/api/showcase?user='+a.id)).data.cards,[]);
console.log('PASS: owned card purchases, persisted/public showcase, origin and login checks, duplicate/unowned rejection, private inventory, clear and reload.');
}finally{if(ids.length){const file=new URL('showcase-qa.sql',root);writeFileSync(file,ids.map(id=>`DELETE FROM auth_accounts WHERE id='${id}';DELETE FROM users WHERE id='${id}';`).join(''));try{const r=spawnSync(process.execPath,['--import','./scripts/sites-env.mjs','node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.cloudflare.json','--file',fileURLToPath(file)],{cwd:root,encoding:'utf8'});if(r.status!==0)throw Error(r.stdout+r.stderr);}finally{unlinkSync(file);}}}

