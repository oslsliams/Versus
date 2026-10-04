import {database} from '../../../db/store';
import {cloudflareAccounts, digest, equalHash, passwordHash, randomToken, sessionCookie, sessionLifetime} from '../../../lib/account-auth';
import {z} from 'zod';
export const dynamic='force-dynamic';
const input=z.discriminatedUnion('action',[
  z.object({action:z.literal('register'),email:z.string().email().max(254).transform(x=>x.toLowerCase().trim()),password:z.string().min(12).max(128),username:z.string().trim().min(3).max(24).regex(/^[a-zA-Z0-9_ ]+$/)}),
  z.object({action:z.literal('login'),email:z.string().email().max(254).transform(x=>x.toLowerCase().trim()),password:z.string().min(1).max(128)}),
  z.object({action:z.literal('logout')})
]);
function cookie(request:Request, value:string, seconds:number){return `${sessionCookie}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(request.url).protocol==='https:'?'; Secure':''}`;}
export async function POST(request:Request){
  if(!cloudflareAccounts())return Response.json({error:'Accounts are available on the Cloudflare version.'},{status:404});
  if(request.headers.get('origin')!==new URL(request.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
  try {
    const body=await request.text();if(body.length>4096)return Response.json({error:'Request too large.'},{status:413});
    let json:unknown;try{json=JSON.parse(body);}catch{return Response.json({error:'Invalid request.'},{status:400});}
    const parsed=input.safeParse(json);if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
    const p=parsed.data;const db=database();const now=Date.now();
    if(p.action==='logout'){
      const token=(request.headers.get('cookie')??'').split(';').map(x=>x.trim()).find(x=>x.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1);
      if(token&&/^[a-f0-9]{64}$/.test(token))await db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').bind(await digest(token)).run();
      return Response.json({ok:true},{headers:{'Set-Cookie':cookie(request,'',0),'Cache-Control':'no-store'}});
    }
    // Atomic counters limit both a trusted Cloudflare client IP and the account email.
    const keys=await Promise.all(['ip:'+(request.headers.get('cf-connecting-ip')??'local-preview'),'email:'+p.email].map(digest));
    for(const key of keys){
      const counter=await db.prepare('INSERT INTO auth_limits (key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END, expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(key,now+15*60*1000,now,now).first<{count:number}>();
      if(counter&&counter.count>10)return Response.json({error:'Too many attempts. Try again in 15 minutes.'},{status:429,headers:{'Retry-After':'900'}});
    }
    let id:string;
    if(p.action==='register'){
      const existing=await db.prepare('SELECT id FROM auth_accounts WHERE email=?').bind(p.email).first();
      if(existing)return Response.json({error:'Unable to create this account. Try signing in instead.'},{status:400});
      id=crypto.randomUUID();const salt=randomToken();const hash=await passwordHash(p.password,salt);
      await db.batch([
        db.prepare('INSERT INTO auth_accounts (id,email,password_hash,salt,created) VALUES (?,?,?,?,?)').bind(id,p.email,hash,salt,now),
        db.prepare('INSERT INTO users (id,username,favorites,created,active) VALUES (?,?,?,?,?)').bind(id,p.username,'["mma"]',now,now)
      ]);
    }else{
      const account=await db.prepare('SELECT id,password_hash,salt FROM auth_accounts WHERE email=?').bind(p.email).first<{id:string;password_hash:string;salt:string}>();
      const hash=await passwordHash(p.password,account?.salt??'missing-account-dummy-salt');
      if(!account||!equalHash(hash,account.password_hash))return Response.json({error:'Email or password is incorrect.'},{status:401});id=account.id;
    }
    const token=randomToken();await db.batch([
      db.prepare('DELETE FROM auth_sessions WHERE expires<?').bind(now),
      db.prepare('INSERT INTO auth_sessions (token_hash,user,expires) VALUES (?,?,?)').bind(await digest(token),id,now+sessionLifetime*1000)
    ]);
    return Response.json({ok:true},{headers:{'Set-Cookie':cookie(request,token,sessionLifetime),'Cache-Control':'no-store'}});
  }catch{ return Response.json({error:'Could not complete sign-in. Please try again.'},{status:503}); }
}
