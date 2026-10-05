import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';

// D1's remote file importer must see END; only at the end of a trigger.
// Earlier migrations wrap CASE expressions in parentheses (END);).
// Whole-file SQLite execution alone misses this import compatibility problem.
const directory=new URL('../cloudflare-migrations/',import.meta.url);
const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON');
let triggers=0;
for(const name of readdirSync(directory).filter(name=>name.endsWith('.sql')).sort()){
  const sql=readFileSync(new URL(name,directory),'utf8');
  for(const match of sql.matchAll(/CREATE TRIGGER\b[\s\S]*?\bEND\s*;/gi)){
    const trigger=match[0];
    assert.doesNotMatch(trigger,/\bCASE\b[^;]*\bEND\s*;/i,`${name}: parenthesize CASE expressions inside triggers or use SELECT RAISE ... WHERE`);
    triggers++;
  }
  db.exec(sql);
}
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger'").get().count,triggers);
assert.equal(db.prepare("SELECT COUNT(*) AS count FROM sqlite_master WHERE type='trigger' AND name='activity_reward_guard'").get().count,1);
db.close();
console.log(`PASS: all migrations apply; ${triggers} triggers have unambiguous remote-import terminators.`);
