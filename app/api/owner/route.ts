import {ownerIdentity} from '../../../lib/owner';
import {database} from '../../../db/store';
import {z} from 'zod';
export const dynamic='force-dynamic';
const cache={'Cache-Control':'no-store'};
export async function GET(){try{
  if(!await ownerIdentity())return Response.json({error:'Owner access required.'},{status:403,headers:cache});
  const db=database();const [stats,users,debates,audit,announcement]=await Promise.all([
    db.prepare('SELECT (SELECT COUNT(*) FROM auth_accounts) AS accounts,(SELECT COUNT(*) FROM fantasy_lineups) AS lineups,(SELECT COUNT(*) FROM coin_picks) AS picks,(SELECT COALESCE(SUM(balance),0) FROM coin_wallets) AS coins').first(),
    db.prepare('SELECT u.id,u.username,COALESCE(p.approved,0) AS approved,CASE WHEN o.user IS NOT NULL THEN 1 ELSE 0 END AS owner,w.balance FROM users u JOIN auth_accounts a ON a.id=u.id LEFT JOIN account_privileges p ON p.user=u.id LEFT JOIN owner_binding o ON o.user=u.id LEFT JOIN coin_wallets w ON w.user=u.id ORDER BY u.created DESC LIMIT 1000').all(),
    db.prepare('SELECT d.id,d.body,d.hidden,d.created,u.username FROM debates d JOIN users u ON u.id=d.user ORDER BY d.created DESC LIMIT 100').all(),
    db.prepare('SELECT a.action,a.target,a.detail,a.created,u.username FROM owner_audit a LEFT JOIN users u ON u.id=a.target ORDER BY a.created DESC LIMIT 30').all(),
    db.prepare("SELECT value FROM owner_settings WHERE key='announcement'").first<{value:string}>()
  ]);return Response.json({stats,users:users.results,debates:debates.results,audit:audit.results,announcement:announcement?.value??''},{headers:cache});
}catch(e){console.error('Owner read:',e);return Response.json({error:'Could not load owner controls.'},{status:503,headers:cache});}}
const action=z.discriminatedUnion('action',[
  z.object({action:z.literal('approve'),target:z.string().uuid(),approved:z.boolean()}),
  z.object({action:z.literal('coins'),target:z.string().uuid(),amount:z.number().int().min(1).max(10000)}),
  z.object({action:z.literal('announcement'),text:z.string().trim().max(240)}),
  z.object({action:z.literal('moderate'),target:z.string().uuid(),hidden:z.boolean()})
]);
const input=z.object({requestId:z.string().uuid(),command:action});
export async function POST(req:Request){
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
  try{
    const owner=await ownerIdentity();if(!owner)return Response.json({error:'Owner access required.'},{status:403});
    const body=await req.text();if(body.length>2048)return Response.json({error:'Request too large.'},{status:413});
    const parsed=input.safeParse(JSON.parse(body));if(!parsed.success)return Response.json({error:'Invalid owner command.'},{status:400});
    const {requestId,command:c}=parsed.data;const target='target' in c?c.target:'site';const detail=JSON.stringify(c);const db=database();
    const previous=await db.prepare('SELECT owner,detail FROM owner_audit WHERE id=?').bind(requestId).first<{owner:string;detail:string}>();
    if(previous)return Response.json(previous.owner===owner&&previous.detail===detail?{ok:true}:{error:'Command ID already used.'},{status:previous.owner===owner&&previous.detail===detail?200:409});
    if(c.action==='approve'||c.action==='coins'){
      if(!await db.prepare('SELECT id FROM auth_accounts WHERE id=?').bind(c.target).first())return Response.json({error:'Account not found.'},{status:404});
      if(c.action==='coins'&&!await db.prepare('SELECT user FROM coin_wallets WHERE user=?').bind(c.target).first())return Response.json({error:'Wallet not found.'},{status:404});
      if(c.action==='approve'&&!c.approved&&c.target===owner)return Response.json({error:'Your owner approval is permanent.'},{status:400});
    }
    if(c.action==='moderate'&&!await db.prepare('SELECT id FROM debates WHERE id=?').bind(c.target).first())return Response.json({error:'Argument not found.'},{status:404});
    const now=Date.now();const statements=[db.prepare('INSERT INTO owner_audit(id,owner,action,target,detail,amount,created) VALUES (?,?,?,?,?,?,?)').bind(requestId,owner,c.action,target,detail,c.action==='coins'?c.amount:null,now)];
    switch(c.action){
      case 'approve':statements.push(db.prepare('INSERT INTO account_privileges(user,approved) VALUES (?,?) ON CONFLICT(user) DO UPDATE SET approved=excluded.approved').bind(c.target,c.approved?1:0));break;
      case 'coins':statements.push(db.prepare("INSERT INTO coin_ledger(id,user,delta,reason,created) VALUES (?,?,?,'Owner gift',?)").bind('gift:'+requestId,c.target,c.amount,now));break;
      case 'announcement':statements.push(db.prepare("INSERT INTO owner_settings(key,value) VALUES ('announcement',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").bind(c.text));break;
      case 'moderate':statements.push(db.prepare('UPDATE debates SET hidden=? WHERE id=?').bind(c.hidden?1:0,c.target));break;
    }
    try{await db.batch(statements);}catch(e){const committed=await db.prepare('SELECT owner,detail FROM owner_audit WHERE id=?').bind(requestId).first<{owner:string;detail:string}>();if(!committed||committed.owner!==owner||committed.detail!==detail)throw e;}
    return Response.json({ok:true});
  }catch(e){console.error('Owner save:',e);return Response.json({error:'Could not apply that owner command.'},{status:400});}
}
