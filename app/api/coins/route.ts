import {getAccountUser} from '../../../lib/account-auth';
import {database} from '../../../db/store';
import {fantasyCards} from '../../../lib/fantasy-store';
import type {CoinPick} from '../../../lib/arena-coins';
import {z} from 'zod';
export const dynamic='force-dynamic';
export async function GET(){try{
  const account=await getAccountUser(),db=database();const count=await db.prepare("SELECT COALESCE((SELECT seq FROM sqlite_sequence WHERE name='account_rewards'),0) AS total").first<{total:number}>();const earlyRemaining=Math.max(0,200-(count?.total??0));
  if(!account)return Response.json({wallet:null,picks:[],history:[],earlyRemaining});
  await fantasyCards(db);const wallet=await db.prepare('SELECT w.balance,r.number AS accountNumber,CASE WHEN r.number<=200 THEN 1 ELSE 0 END AS earlySupporter FROM coin_wallets w JOIN account_rewards r ON r.user=w.user WHERE w.user=?').bind(account.userId).first();
  const [picks,history]=await Promise.all([db.prepare('SELECT * FROM coin_picks WHERE user=? ORDER BY created DESC LIMIT 500').bind(account.userId).all<CoinPick>(),db.prepare('SELECT delta,reason,created FROM coin_ledger WHERE user=? ORDER BY created DESC,id DESC LIMIT 30').bind(account.userId).all()]);return Response.json({wallet,picks:picks.results,history:history.results,earlyRemaining});
}catch(e){console.error('Coins read:',e);return Response.json({error:'Could not load Arena Coins. Please retry.'},{status:503});}}
const input=z.object({event:z.string().max(80),bout:z.string().max(80),fighter:z.string().max(90),amount:z.number().int().min(10).max(1000)});
export async function POST(req:Request){try{
  if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin.'},{status:403});const account=await getAccountUser();if(!account)return Response.json({error:'Sign in to use Arena Coins.'},{status:401});
  const body=await req.text();if(body.length>2048)return Response.json({error:'Request too large.'},{status:413});const parsed=input.safeParse(JSON.parse(body));if(!parsed.success)return Response.json({error:parsed.error.issues[0].message},{status:400});
  const p=parsed.data,db=database(),events=await fantasyCards(db),event=events.find(e=>e.id===p.event);if(!event||event.replay)return Response.json({error:'Coin picks are available on upcoming real cards.'},{status:400});
  if(Date.now()>=event.startsAt)return Response.json({error:'This card has started. Coin picks are locked.'},{status:400});const bout=event.bouts.find(b=>b.id===p.bout&&b.outcome==='pending');if(!bout||![bout.red.id,bout.blue.id].includes(p.fighter))return Response.json({error:'Choose an available fighter in this bout.'},{status:400});
  const duplicate=await db.prepare('SELECT id FROM coin_picks WHERE user=? AND event=? AND bout=?').bind(account.userId,event.id,bout.id).first();if(duplicate)return Response.json({error:'You already backed a fighter in this bout.'},{status:409});
  const result=await db.prepare("INSERT INTO coin_picks (id,user,event,bout,red,blue,fighter,amount,created) SELECT ?,?,?,?,?,?,?,?,? WHERE unixepoch()*1000<? AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=? AND balance>=?)").bind(crypto.randomUUID(),account.userId,event.id,bout.id,bout.red.id,bout.blue.id,p.fighter,p.amount,Date.now(),event.startsAt,account.userId,p.amount).run();
  if(!result.meta.changes)return Response.json({error:'Not enough Arena Coins, or this card just locked.'},{status:400});return Response.json({ok:true});
}catch(e){console.error('Coins save:',e);return Response.json({error:'Could not back this fighter. Refresh your balance and try again.'},{status:400});}}
