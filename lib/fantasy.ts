export type FantasyFighter={id:string;name:string;photo:string;source:string;cost:number};
export type FantasyBout={id:string;red:FantasyFighter;blue:FantasyFighter;division:string;winner:string|null;method:string;round:number|null;outcome:'pending'|'finished'|'draw'|'nc'|'cancelled'};
export type FantasyEvent={id:string;name:string;kind:'Fight Night'|'Premium';location:string;source:string;startsAt:number;replay:boolean;checkedAt:number;bouts:FantasyBout[]};
export type FantasyLineup={fighters:string[];captain:string;name:string};
export const fantasyRules={size:5,budget:60,captain:1.5,win:30,finish:20,submission:5,roundOne:10,roundTwo:5,draw:10};
const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#039;|&apos;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const trustedPhoto=(s:string)=>{try{const u=new URL(s);return u.protocol==='https:'&&(u.hostname==='ufc.com'||u.hostname.endsWith('.ufc.com'))?s:'';}catch{return '';}};
/** Only the official card's explicit corner outcomes can settle a bout. */
export function parseOfficialCard(html:string):{bouts:FantasyBout[];startsAt:number|null}{
  const chunks=html.split(/<div class="c-listing-fight"\s+data-fmid="/).slice(1);const bouts:FantasyBout[]=[];
  for(const chunk of chunks){
    const id=chunk.match(/^(\d+)"/)?.[1];if(!id)continue;
    const corner=(color:string)=>{const image=chunk.match(new RegExp('class="c-listing-fight__corner-image--'+color+'"([\\s\\S]*?)class="c-listing-fight__corner-body--'+color+'"'))?.[1]??'';const body=chunk.match(new RegExp('class="c-listing-fight__corner-body--'+color+'"([\\s\\S]*?)</div>\\s*</div>'))?.[1]??'';const name=chunk.match(new RegExp('class="c-listing-fight__corner-name c-listing-fight__corner-name--'+color+'"[^>]*>([\\s\\S]*?)</a>'))?.[1]??'';const source=image.match(/href="(https:\/\/www\.ufc\.com\/athlete\/[^"?#]+)"/)?.[1]??'';const rank=chunk.match(new RegExp('class="c-listing-fight__class c-listing-fight__class--mobile"([\\s\\S]*?)class="c-listing-fight__content-row"'))?.[1]??'';const ranks=[...rank.matchAll(/class="js-listing-fight__corner-rank[^"]*"[^>]*>([\s\S]*?)<\/div>/g)].map(x=>clean(x[1]));const r=ranks[color==='red'?0:1];const n=Number(r?.replace('#',''));const cost=r==='C'?16:n>0&&n<=5?15:n>0&&n<=10?13:n>0?12:10;return{fighter:{id:source.split('/').at(-1)??'',name:clean(name),photo:trustedPhoto(clean(image.match(/<img[^>]+src="([^"]+)"/)?.[1]??'')),source,cost},outcome:body.match(/c-listing-fight__outcome--(win|loss|draw|no-contest|nc)/)?.[1]??''};};
    const red=corner('red'),blue=corner('blue');if(!red.fighter.id||!blue.fighter.id||!red.fighter.name||!blue.fighter.name)continue;
    const method=clean(chunk.match(/class="c-listing-fight__result-text method">([\s\S]*?)<\/div>/)?.[1]??'');const round=Number(clean(chunk.match(/class="c-listing-fight__result-text round">([\s\S]*?)<\/div>/)?.[1]??''))||null;
    const winner=red.outcome==='win'?red.fighter.id:blue.outcome==='win'?blue.fighter.id:null;const isNC=/no.?contest/i.test(method)||['nc','no-contest'].includes(red.outcome);const draw=red.outcome==='draw'||blue.outcome==='draw'||/draw/i.test(method);
    bouts.push({id,red:red.fighter,blue:blue.fighter,division:clean(chunk.match(/class="c-listing-fight__class-text">([\s\S]*?)<\/div>/)?.[1]??''),winner,method,round,outcome:winner&&method&&round?'finished':isNC?'nc':draw?'draw':'pending'});
  }
  const times=[...html.matchAll(/class="c-event-fight-card-broadcaster__time[^"\n]*"[^>]*data-timestamp="(\d+)"/g)].map(x=>Number(x[1])*1000);
  return{bouts,startsAt:times.length?Math.min(...times):null};
}
export function validateLineup(event:FantasyEvent,lineup:FantasyLineup,now=Date.now()):string|null{
  if(!event.replay&&now>=event.startsAt)return'This card has started. Lineups are locked.';
  if(lineup.fighters.length!==fantasyRules.size||new Set(lineup.fighters).size!==fantasyRules.size)return'Draft five different fighters.';
  if(!lineup.fighters.includes(lineup.captain))return'Choose a captain from your lineup.';
  let cost=0;const used=new Set<string>();
  for(const id of lineup.fighters){const bout=event.bouts.find(b=>b.outcome!=='cancelled'&&(b.red.id===id||b.blue.id===id));if(!bout)return'A selected fighter is no longer available on this card.';if(used.has(bout.id))return'Choose only one fighter per bout.';used.add(bout.id);cost+=(bout.red.id===id?bout.red:bout.blue).cost;}
  return cost>fantasyRules.budget?'Your lineup exceeds 60 credits.':null;
}
export function fighterPoints(bout:FantasyBout,id:string):{points:number;parts:string[];settled:boolean}{
  if(bout.outcome==='pending')return{points:0,parts:['Awaiting official result'],settled:false};
  if(bout.outcome==='draw')return{points:10,parts:['Draw +10'],settled:true};
  if(bout.outcome==='nc'||bout.outcome==='cancelled')return{points:0,parts:[bout.outcome==='nc'?'No contest · 0':'Cancelled / withdrawn · 0'],settled:true};
  if(bout.winner!==id)return{points:0,parts:['Loss · 0'],settled:true};
  let points=30;const parts=['Win +30'];const submission=/submission/i.test(bout.method),finish=submission||/\bKO\b|\bTKO\b/i.test(bout.method);
  if(finish){points+=20;parts.push('Finish +20');if(submission){points+=5;parts.push('Submission +5');}if(bout.round===1){points+=10;parts.push('Round 1 +10');}else if(bout.round===2){points+=5;parts.push('Round 2 +5');}}
  return{points,parts,settled:true};
}
export function scoreLineup(event:FantasyEvent,lineup:FantasyLineup){const rows=lineup.fighters.map(id=>{const bout=event.bouts.find(b=>b.red.id===id||b.blue.id===id);const fighter=bout?(bout.red.id===id?bout.red:bout.blue):null;const score=bout?fighterPoints(bout,id):{points:0,parts:['Withdrawn · 0'],settled:true};const multiplier=id===lineup.captain?1.5:1;return{id,name:fighter?.name??id,photo:fighter?.photo??'',...score,points:score.points*multiplier,captain:multiplier>1};});return{total:rows.reduce((s,r)=>s+r.points,0),settled:rows.filter(r=>r.settled).length,rows};}
