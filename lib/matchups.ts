import type {Matchup} from './domain';
import {competitors} from './competitors';
const featured=[['pereira','adesanya','A rivalry worth revisiting.','FANTASY REMATCH'],['jones','gsp','Two legacies. One debate.','ALL-TIME · P4P'],['khabib','islam','The ultimate grappling debate.','DREAM MATCHUP'],['silva','topuria','Different eras. Same arena.','ALL-TIME · P4P']];
export const matchups:Matchup[]=featured.map(([a,b,title,label])=>({id:`${a}-${b}`,a,b,title,label,category:'mma',rounds:5,votes:[0,0],scheduled:'Fantasy prediction · 5 rounds'}));
const featuredPairs=new Set(matchups.map(m=>[m.a,m.b].sort().join('|')));
for(let i=0;i<competitors.length;i++)for(let j=i+1;j<competitors.length;j++){const a=competitors[i].id,b=competitors[j].id;if(!featuredPairs.has([a,b].sort().join('|')))matchups.push({id:`${a}--vs--${b}`,a,b,title:'Settle the debate.',label:'FANTASY · P4P',category:'mma',rounds:5,votes:[0,0],scheduled:'Fantasy prediction · 5 rounds'});}
