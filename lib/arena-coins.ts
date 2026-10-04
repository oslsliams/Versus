import type {FantasyEvent} from './fantasy';
export type CoinPick={id:string;user:string;event:string;bout:string;red:string;blue:string;fighter:string;amount:number;state:'pending'|'won'|'lost'|'refunded';payout:number;result:string;created:number;settled:number|null};
export function coinOutcome(pick:CoinPick,event:FantasyEvent,now=Date.now()){
  if(event.replay||now<event.startsAt)return null;
  const bout=event.bouts.find(b=>b.id===pick.bout&&b.red.id===pick.red&&b.blue.id===pick.blue);
  if(!bout||bout.outcome==='pending')return null;
  if(['draw','nc','cancelled'].includes(bout.outcome))return{state:'refunded',payout:pick.amount,result:bout.method||bout.outcome};
  if(bout.outcome!=='finished'||!bout.winner)return null;
  return{state:bout.winner===pick.fighter?'won':'lost',payout:bout.winner===pick.fighter?pick.amount*2:0,result:bout.method};
}
export async function settleCoinPicks(db:D1Database,events:FantasyEvent[]){
  const now=Date.now();const statements=events.filter(e=>!e.replay&&now>=e.startsAt).flatMap(event=>event.bouts.flatMap(bout=>{
    if(['draw','nc','cancelled'].includes(bout.outcome))return[db.prepare("UPDATE coin_picks SET state='refunded',payout=amount,result=?,settled=? WHERE event=? AND bout=? AND red=? AND blue=? AND state='pending'").bind(bout.method||bout.outcome,now,event.id,bout.id,bout.red.id,bout.blue.id)];
    if(bout.outcome!=='finished'||!bout.winner)return[];
    return[db.prepare("UPDATE coin_picks SET state=CASE WHEN fighter=? THEN 'won' ELSE 'lost' END,payout=CASE WHEN fighter=? THEN amount*2 ELSE 0 END,result=?,settled=? WHERE event=? AND bout=? AND red=? AND blue=? AND state='pending'").bind(bout.winner,bout.winner,bout.method,now,event.id,bout.id,bout.red.id,bout.blue.id)];
  }));
  for(let i=0;i<statements.length;i+=50)await db.batch(statements.slice(i,i+50));
}
