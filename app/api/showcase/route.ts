import {database} from '../../../db/store';
import {getAccountUser} from '../../../lib/account-auth';
import {z} from 'zod';
export const dynamic='force-dynamic';
const headers={'Cache-Control':'private, no-store'};
export async function GET(req:Request){try{
 const me=await getAccountUser(),id=new URL(req.url).searchParams.get('user')??me?.userId;if(!id||id.length>100)return Response.json({error:'Choose a profile.'},{status:400,headers});const db=database();
 if(me&&await db.prepare('SELECT 1 FROM account_blocks WHERE (user=? AND target=?) OR (user=? AND target=?)').bind(me.userId,id,id,me.userId).first())return Response.json({error:'Profile unavailable.'},{status:404,headers});
 const cards=await db.prepare('SELECT card FROM profile_showcase_cards WHERE user=? ORDER BY slot').bind(id).all<{card:string}>(),settings=await db.prepare('SELECT caption FROM profile_showcase_settings WHERE user=?').bind(id).first<{caption:string}>();
 const mine=me?.userId===id,owned=mine?(await db.prepare('SELECT card FROM moment_purchases WHERE user=? ORDER BY created DESC,card').bind(id).all<{card:string}>()).results.map(r=>r.card):[];
 return Response.json({cards:cards.results.map(r=>r.card),caption:settings?.caption??'',mine,owned},{headers});
 }catch{return Response.json({error:'Could not load this card showcase.'},{status:503,headers});}}
const input=z.object({cards:z.array(z.string().min(1).max(40)).max(6).refine(c=>new Set(c).size===c.length),caption:z.string().trim().max(80)}).strict();
export async function POST(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)return Response.json({error:'Invalid request origin.'},{status:403,headers});try{
 const me=await getAccountUser();if(!me)return Response.json({error:'Sign in to edit your showcase.'},{status:401,headers});const body=await req.text();if(body.length>1500)return Response.json({error:'Request too large.'},{status:413,headers});const p=input.safeParse(JSON.parse(body));if(!p.success)return Response.json({error:'Choose up to six different owned cards and a caption under 80 characters.'},{status:400,headers});
 const db=database();const owned=await db.prepare('SELECT card FROM moment_purchases WHERE user=?').bind(me.userId).all<{card:string}>();if(p.data.cards.some(c=>!owned.results.some(o=>o.card===c)))return Response.json({error:'You can display only cards you own.'},{status:400,headers});
 await db.batch([db.prepare('DELETE FROM profile_showcase_cards WHERE user=?').bind(me.userId),...p.data.cards.map((card,i)=>db.prepare('INSERT INTO profile_showcase_cards(user,slot,card) VALUES(?,?,?)').bind(me.userId,i+1,card)),db.prepare('INSERT INTO profile_showcase_settings(user,caption) VALUES(?,?) ON CONFLICT(user) DO UPDATE SET caption=excluded.caption').bind(me.userId,p.data.caption)]);
 return Response.json({ok:true},{headers});
 }catch{return Response.json({error:'Your showcase could not be saved. Please retry.'},{status:400,headers});}}
