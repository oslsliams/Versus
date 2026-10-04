import {cachedFeed} from './live-feed';
import {parseOfficialCard,type FantasyEvent} from './fantasy';
export function parseEventLinks(html:string){
  const urls=[...new Set([...html.matchAll(/href="(\/event\/[a-z0-9-]+)"/g)].map(m=>'https://www.ufc.com'+m[1]))];
  if(!urls.length)throw Error('Event schedule unavailable.');return urls.slice(0,16);
}
export function eventName(html:string,slug:string){const title=html.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/)?.[1]??html.match(/<title>([^<]+)/)?.[1]??slug.replaceAll('-',' ');return title.replace(/\s*[|].*$/,'').replace(/&amp;/g,'&').trim().slice(0,160);}
export async function discoverCards(db:D1Database,origin?:string){
  const feed=await cachedFeed(db,'ufc-event-discovery','https://www.ufc.com/events',3600000,parseEventLinks,false,origin);
  if(!feed.items)return;
  const existing=await db.prepare('SELECT data FROM fantasy_cards').all<{data:string}>();const sources=new Set(existing.results.map(r=>(JSON.parse(r.data) as FantasyEvent).source));
  // Bound source requests per run; cards with no announced bouts remain undiscovered
  // until a future run, rather than becoming invented draft boards.
  const candidates=feed.items.filter(url=>!sources.has(url)).slice(0,8);
  for(let i=0;i<candidates.length;i+=2)await Promise.all(candidates.slice(i,i+2).map(async source=>{
    const slug=new URL(source).pathname.split('/').at(-1)!;
    const parsed=await cachedFeed(db,'ufc-new-card:'+slug,source,3600000,(html:string)=>({card:parseOfficialCard(html),name:eventName(html,slug)}),false,origin);
    if(!parsed.items?.card.startsAt||parsed.items.card.startsAt<Date.now()||!parsed.items.card.bouts.length)return;
    const main=parsed.items.card.bouts[0];const name=parsed.items.name==='UFC Fight Night'?`UFC Fight Night: ${main.red.name} vs ${main.blue.name}`:parsed.items.name;
    const event:FantasyEvent={id:slug,name,kind:/fight-night/.test(slug)?'Fight Night':'Premium',location:'See official UFC event details',source,startsAt:parsed.items.card.startsAt,replay:false,checkedAt:parsed.checkedAt,bouts:parsed.items.card.bouts};
    await db.prepare('INSERT OR IGNORE INTO fantasy_cards(id,data,checked,attempted) VALUES(?,?,?,0)').bind(event.id,JSON.stringify(event),event.checkedAt).run();
  }));
}
