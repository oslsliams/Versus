import {momentBonus,type MomentPlay} from './moments';
import type {FantasyEvent} from './fantasy';
export async function settleMoments(db:D1Database,events:FantasyEvent[],now=Date.now()){
 const pending=await db.prepare("SELECT * FROM moment_plays WHERE state='pending'").all<MomentPlay>();const updates=[];
 for(const play of pending.results){const event=events.find(e=>e.id===play.event);if(!event||event.replay||now<event.startsAt||play.created>=event.startsAt)continue;const bout=event.bouts.find(b=>b.id===play.bout&&b.red.id===play.red&&b.blue.id===play.blue);if(!bout)continue;const bonus=momentBonus(bout,play.fighter);if(!bonus)continue;updates.push(db.prepare("UPDATE moment_plays SET state='settled',payout=?,result=?,settled=? WHERE user=? AND event=? AND slot=? AND state='pending'").bind(bonus.payout,bonus.result,now,play.user,play.event,play.slot));}
 for(let i=0;i<updates.length;i+=50)await db.batch(updates.slice(i,i+50));
}
