export type RoundAction={id:string;round:number;clock:string;text:string;fighter:string|null;updated:string};
export function parseRoundActions(input:any):RoundAction[]{
  if(!Array.isArray(input?.items))throw Error('Round feed unavailable.');
  return input.items.filter((p:any)=>Number.isInteger(p.period?.number)&&p.period.number>=1&&p.period.number<=5).slice(0,1000).map((p:any)=>({id:String(p.id),round:p.period.number,clock:String(p.clock?.displayValue??''),text:String(p.text||p.type?.text||'Source update').slice(0,400),fighter:p.participants?.[0]?.athlete?.id?String(p.participants[0].athlete.id):null,updated:String(p.wallclock??'')}));
}
// A descriptive statistic comparison, never an inferred judge's score.
export function strikeLeader(fighters:{name:string;items:{rows:{label:string;value:string|null}[]}|null}[]){
  if(fighters.length!==2)return null;
  const values=fighters.map(f=>f.items?.rows.find(r=>r.label==='Significant strikes landed')?.value);
  if(values.some(v=>v==null||!/^\d+$/.test(v)))return null;
  const [a,b]=values.map(Number);return a===b?'Significant strikes are level':`${fighters[a>b?0:1].name} leads significant strikes ${Math.max(a,b)}–${Math.min(a,b)}`;
}
