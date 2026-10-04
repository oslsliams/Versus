import type {Matchup} from './domain';
import {competitors} from './competitors';
const featured=[['pereira','adesanya','A rivalry worth revisiting.','FANTASY REMATCH'],['jones','gsp','Two legacies. One debate.','ALL-TIME · P4P'],['khabib','islam','The ultimate grappling debate.','DREAM MATCHUP'],['silva','topuria','Different eras. Same arena.','ALL-TIME · P4P']];
export const matchups:Matchup[]=featured.map(([a,b,title,label])=>({id:`${a}-${b}`,a,b,title,label,category:'mma',rounds:5,votes:[0,0],scheduled:'Fantasy prediction · 5 rounds'}));
const featuredPairs=new Set(matchups.map(m=>[m.a,m.b].sort().join('|')));
// Preserve existing discussion URLs without allocating every pair of the expanded roster.
// The stat comparison tool resolves all fighters directly by ID.
const legacyRoster=competitors.slice(0,200);
for(let i=0;i<legacyRoster.length;i++)for(let j=i+1;j<legacyRoster.length;j++){const a=legacyRoster[i].id,b=legacyRoster[j].id;if(!featuredPairs.has([a,b].sort().join('|')))matchups.push({id:`${a}--vs--${b}`,a,b,title:'Settle the debate.',label:'FANTASY · P4P',category:'mma',rounds:5,votes:[0,0],scheduled:'Fantasy prediction · 5 rounds'});}
