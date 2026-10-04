const clean=(s:string)=>s.replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&#039;/g,"'").replace(/\s+/g,' ').trim();
const numeric=(s:string)=>{const v=clean(s).replace(/%/g,'').trim();return /^\d+(\.\d+)?$/.test(v)?Number(v):null;};
export function officialMeasurements(html:string){
 const bio=(label:string)=>html.match(new RegExp('c-bio__label">'+label+'</div>\\s*<div class="c-bio__text">([\\s\\S]*?)</div>'))?.[1]??'';
 const stat=(label:string)=>{const match=[...html.matchAll(/c-stat-compare__number">\s*(\d+(?:\.\d+)?)[\s\S]*?c-stat-compare__label">([^<]+)/g)].find(m=>clean(m[2])===label);return match?Number(match[1]):null;};
 const inches=(label:string)=>{const v=numeric(bio(label));return v!==null&&v>=40&&v<=100?Math.round(v*2.54):null;};
 const age=numeric(bio('Age'));const accuracy=html.match(/<title>Striking accuracy (\d+)%<\/title>/)?.[1];
 return{age:age!==null&&age>=16&&age<100?age:null,height:inches('Height'),reach:inches('Reach'),stats:{landed:stat('Sig. Str. Landed'),accuracy:accuracy?Number(accuracy):null,takedowns:stat('Takedown avg'),defense:stat('Takedown Defense')}};
}
