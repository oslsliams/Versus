import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {competitors} from '../lib/competitors.ts';
const json=file=>JSON.parse(readFileSync(new URL('../'+file,import.meta.url),'utf8'));
const portraits=json('lib/fighter-photos.json'),scenes=json('lib/fighter-scenes.json'),provenance=json('public/roster-provenance.json');
const ids=new Set(competitors.map(c=>c.id));
assert.equal(competitors.length,500);assert.equal(ids.size,500);
assert.equal(new Set(competitors.map(c=>c.name)).size,500);
assert.equal(provenance.count,500);assert.equal(provenance.profiles.length,500);
for(const c of competitors){
  assert.match(c.source,/^https:\/\/www\.ufc\.com\/athlete\//);
  assert.ok(c.snapshot&&c.notes.length);
  assert.ok(c.record.every(n=>Number.isInteger(n)&&n>=0));
  for(const key of ['height','reach'])assert.ok(c[key]===null||(Number.isFinite(c[key])&&c[key]>100&&c[key]<250),c.id+' '+key);
  for(const key of ['accuracy','defense'])assert.ok(c.stats[key]===null||(Number.isFinite(c.stats[key])&&c.stats[key]>=0&&c.stats[key]<=100),c.id+' '+key);
  for(const key of ['landed','takedowns'])assert.ok(c.stats[key]===null||(Number.isFinite(c.stats[key])&&c.stats[key]>=0),c.id+' '+key);
  if(c.methods.every(n=>n!==null))assert.equal(c.methods.reduce((sum,n)=>sum+n,0),c.record[0],c.id+' reconciled career finishes');
}
assert.equal(Object.keys(portraits).length,498);
assert.deepEqual(scenes,json('public/fighter-scene-sources.json'));
const trusted=url=>{const parsed=new URL(url);assert.equal(parsed.protocol,'https:');assert.ok(['ufc.com','ufc.com.br'].some(host=>parsed.hostname===host||parsed.hostname.endsWith('.'+host)));};
let photos=0;
for(const [id,shots] of Object.entries(scenes)){assert.ok(ids.has(id));assert.ok(shots.length>0&&shots.length<=3);assert.equal(new Set(shots.map(s=>s.url)).size,shots.length);for(const shot of shots){trusted(shot.url);trusted(shot.source);assert.ok(shot.caption);if(shot.event)assert.ok(shot.caption.includes(shot.event));photos++;}}
assert.equal(photos,58);
console.log('PASS: 500 unique sourced fighters, measured-stat bounds, reconciled methods, 498 portraits, and 58 attributed career photographs.');
