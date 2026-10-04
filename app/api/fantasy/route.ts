import {getAccountUser} from '../../../lib/account-auth';
import {database} from '../../../db/store';
import {fantasyCards} from '../../../lib/fantasy-store';
import {scoreLineup,validateLineup,type FantasyLineup} from '../../../lib/fantasy';
import {z} from 'zod';
export const dynamic='force-dynamic';
type Row={user:string;event:string;name:string;fighters:string;captain:string;updated:number;username:string;avatar:string;accent:string};
export async function GET(){try{
  const account=await getAccountUser(),db=database();const events=await fantasyCards(db);const saved=await db.prepare('SELECT f.*,u.username,u.avatar,u.accent FROM fantasy_lineups f JOIN users u ON u.id=f.user ORDER BY f.updated LIMIT 10000').all<Row>();
  const entries=saved.results.map(row=>{const event=events.find(e=>e.id===row.event);if(!event)return null;const lineup={name:row.name,fighters:JSON.parse(row.fighters),captain:row.captain} as FantasyLineup;const locked=!event.replay&&Date.now()>=event.startsAt;const score=scoreLineup(event,lineup);return{user:row.user,event:row.event,name:row.name,username:row.username,avatar:row.avatar,accent:row.accent,mine:account?.userId===row.user,total:score.total,settled:score.settled,...(account?.userId===row.user||locked?{lineup,rows:score.rows}:{})};}).filter(e=>e&&(!events.find(c=>c.id===e.event)?.replay||e.mine));
  return Response.json({events,entries,signedIn:!!account});
}catch(e){console.error('Fantasy read:',e);return Response.json({error:'Could not load fantasy cards. Try again shortly.'},{status:503});}}
const draft=z.object({event:z.string().max(80),name:z.string().trim().min(3).max(36),fighters:z.array(z.string().max(90)).length(5),captain:z.string().max(90)});
export async function POST(req:Request){try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});
  const account=await getAccountUser();if(!account)return Response.json({error:'Sign in to save your lineup.'},{status:401});const p=draft.safeParse(await req.json());if(!p.success)return Response.json({error:p.error.issues[0].message},{status:400});
  const db=database(),events=await fantasyCards(db);const event=events.find(e=>e.id===p.data.event);if(!event)return Response.json({error:'Unknown event.'},{status:400});const error=validateLineup(event,p.data);if(error)return Response.json({error},{status:400});
  const now=Date.now();const result=await db.prepare('INSERT INTO fantasy_lineups (user,event,name,fighters,captain,created,updated) SELECT ?,?,?,?,?,?,? WHERE ?=1 OR unixepoch()*1000<? ON CONFLICT(user,event) DO UPDATE SET name=excluded.name,fighters=excluded.fighters,captain=excluded.captain,updated=excluded.updated WHERE ?=1 OR unixepoch()*1000<?').bind(account.userId,event.id,p.data.name,JSON.stringify(p.data.fighters),p.data.captain,now,now,event.replay?1:0,event.startsAt,event.replay?1:0,event.startsAt).run();
  if(!result.meta.changes)return Response.json({error:'This card just locked. Your previous lineup is unchanged.'},{status:409});return Response.json({ok:true});
}catch(e){console.error('Fantasy save:',e);return Response.json({error:'Could not save your lineup. Your selections are still here.'},{status:503});}}
