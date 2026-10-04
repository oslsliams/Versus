import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {competitors} from '../lib/competitors.ts';
import {moments} from '../lib/moments.ts';
import {officialMeasurements} from '../lib/official-profile.ts';
const measurements=officialMeasurements('<div class="c-bio__label">Height</div><div class="c-bio__text">65.00</div><div class="c-stat-compare__number">75<div class="c-stat-compare__percent">%</div></div><div class="c-stat-compare__label">Takedown Defense</div><div class="c-stat-compare__number">0</div><div class="c-stat-compare__label">Takedown avg</div>');assert.equal(measurements.height,165);assert.equal(measurements.stats.defense,75);assert.equal(measurements.stats.takedowns,0);assert.equal(measurements.reach,null);
const ranks=JSON.parse(readFileSync(new URL('../lib/ufc-rankings.json',import.meta.url),'utf8'));
assert.equal(ranks.entries.length,176);assert.equal(new Set(ranks.entries.map(e=>e.id)).size,176);
for(const e of ranks.entries){assert.ok(competitors.some(c=>c.id===e.id),'Missing '+e.name);assert.ok(moments.some(m=>m.portrait===e.id),'Missing Moment '+e.name);assert.ok(e.ranks.length);}
const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON;CREATE TABLE auth_accounts(id TEXT PRIMARY KEY);CREATE TABLE moment_purchases(user TEXT,card TEXT,PRIMARY KEY(user,card));');sql.exec(readFileSync(new URL('../cloudflare-migrations/0018_profile_showcase.sql',import.meta.url),'utf8'));
sql.exec("INSERT INTO auth_accounts VALUES('owner'),('other');INSERT INTO moment_purchases VALUES('owner','card1'),('owner','card2');");
const add=sql.prepare('INSERT INTO profile_showcase_cards VALUES(?,?,?)');add.run('owner',1,'card1');
assert.throws(()=>add.run('owner',2,'card1'));assert.throws(()=>add.run('owner',7,'card2'));assert.throws(()=>add.run('owner',2,'unowned'));assert.throws(()=>add.run('other',1,'card1'));
sql.exec("DELETE FROM moment_purchases WHERE user='owner' AND card='card1'");assert.equal(sql.prepare('SELECT COUNT(*) n FROM profile_showcase_cards').get().n,0);
console.log('PASS: every one of 176 current ranked fighters has a profile and Moment; showcase ownership, slot limits, duplicates and deletion integrity enforced in the database.');
