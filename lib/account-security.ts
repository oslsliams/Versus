import {digest,randomToken,sessionCookie,sessionLifetime} from './account-auth';
export function recoveryCode(){return 'VRS-'+randomToken().slice(0,32).toUpperCase().match(/.{8}/g)!.join('-');}
export function normalizeCode(value:string){return value.trim().toUpperCase().replace(/^VRS[- ]?/,'').replace(/[-\s]/g,'');}
export const recoveryDigest=(value:string)=>digest('recovery:'+normalizeCode(value));
export function accountCookie(req:Request,value:string,seconds=sessionLifetime){return `${sessionCookie}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(req.url).protocol==='https:'?'; Secure':''}`;}
export function requestToken(req:Request){return(req.headers.get('cookie')??'').split(';').map(s=>s.trim()).find(s=>s.startsWith(sessionCookie+'='))?.slice(sessionCookie.length+1)??'';}
export async function securityLimit(db:D1Database,req:Request,key:string){const now=Date.now();const keys=await Promise.all(['security-ip:'+(req.headers.get('cf-connecting-ip')??'local-preview'),'security:'+key.toLowerCase().trim()].map(digest));for(const k of keys){const counter=await db.prepare('INSERT INTO auth_limits(key,count,expires) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires<=? THEN 1 ELSE count+1 END,expires=CASE WHEN expires<=? THEN excluded.expires ELSE expires END RETURNING count').bind(k,now+900000,now,now).first<{count:number}>();if(counter&&counter.count>10)return false;}return true;}
export type Credentials={id:string;password_hash:string;salt:string;password_version:number;recovery_hash:string|null};
export async function rotateCredentials(db:D1Database,account:Credentials,passwordHash:string,salt:string,codeHash:string){
 const token=randomToken(),tokenHash=await digest(token),now=Date.now();const results=await db.batch([
 db.prepare('UPDATE auth_accounts SET password_hash=?,salt=?,password_version=password_version+1,recovery_hash=?,recovery_created=? WHERE id=? AND password_version=? AND password_hash=? AND COALESCE(recovery_hash,\'\')=?').bind(passwordHash,salt,codeHash,now,account.id,account.password_version,account.password_hash,account.recovery_hash??''),
 db.prepare('DELETE FROM auth_sessions WHERE user=? AND version<=? AND EXISTS(SELECT 1 FROM auth_accounts WHERE id=? AND password_version=? AND recovery_hash=?)').bind(account.id,account.password_version,account.id,account.password_version+1,codeHash),
 db.prepare('INSERT INTO auth_sessions(token_hash,user,expires,version) SELECT ?,id,?,password_version FROM auth_accounts WHERE id=? AND password_version=? AND recovery_hash=?').bind(tokenHash,now+sessionLifetime*1000,account.id,account.password_version+1,codeHash)
 ]);return results[0].meta.changes?token:null;
}
