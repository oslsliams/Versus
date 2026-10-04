import {settleCoinPicks} from './arena-coins';
import seeds from './fantasy-events.json';
import {parseOfficialCard,type FantasyEvent} from './fantasy';
export async function fantasyCards(db:D1Database,refresh=true):Promise<(FantasyEvent&{syncError:string})[]>{
  await db.batch(seeds.map(e=>db.prepare('INSERT OR IGNORE INTO fantasy_cards (id,data,checked,attempted) VALUES (?,?,?,0)').bind(e.id,JSON.stringify(e),e.checkedAt)));
  const load=async()=>{const r=await db.prepare('SELECT data,checked,attempted,error FROM fantasy_cards').all<{data:string;checked:number;attempted:number;error:string}>();return r.results.filter(r=>seeds.some(e=>e.id===JSON.parse(r.data).id));};
  let stored=await load();
  if(refresh)await Promise.all(stored.map(async row=>{
    const old=JSON.parse(row.data) as FantasyEvent;if(old.replay)return;const now=Date.now();const near=Math.abs(now-old.startsAt)<24*3600_000;const interval=near?5*60_000:now<old.startsAt?3600_000:24*3600_000;if(now-Math.max(row.checked,row.attempted)<interval)return;
    const claimed=await db.prepare('UPDATE fantasy_cards SET attempted=? WHERE id=? AND attempted<?').bind(now,old.id,now-interval).run();if(!claimed.meta.changes)return;
    try{
      const source=new URL(old.source);if(source.hostname!=='www.ufc.com'||!source.pathname.startsWith('/event/'))throw Error('Unsupported card source.');
      const response=await fetch(old.source,{signal:AbortSignal.timeout(7000),headers:{'User-Agent':'VERSUS-fantasy-card-sync/1.0'}});if(!response.ok)throw Error('Official source is temporarily unavailable.');
      const parsed=parseOfficialCard(await response.text());if(parsed.bouts.length<5||!parsed.startsAt)throw Error('Official card could not be verified.');
      const costs=new Map(old.bouts.flatMap(b=>[[b.red.id,b.red.cost],[b.blue.id,b.blue.cost]] as [string,number][]));
      const bouts=parsed.bouts.map(b=>({...b,red:{...b.red,cost:costs.get(b.red.id)??b.red.cost},blue:{...b.blue,cost:costs.get(b.blue.id)??b.blue.cost}}));
      for(const previous of old.bouts)if(!bouts.some(b=>b.id===previous.id&&b.red.id===previous.red.id&&b.blue.id===previous.blue.id))bouts.push({...previous,winner:null,method:'Cancelled or replaced',round:null,outcome:'cancelled'});
      const next={...old,bouts,startsAt:parsed.startsAt,checkedAt:now};await db.prepare("UPDATE fantasy_cards SET data=?,checked=?,error='' WHERE id=?").bind(JSON.stringify(next),now,old.id).run();
    }catch{await db.prepare('UPDATE fantasy_cards SET error=? WHERE id=?').bind('Official update unavailable. Showing the last verified card; pending results earn no points.',old.id).run();}
  }));
  if(refresh)stored=await load();const cards=stored.map(r=>({...JSON.parse(r.data),checkedAt:r.checked,syncError:r.error})) as (FantasyEvent&{syncError:string})[];await settleCoinPicks(db,cards);return cards;
}
