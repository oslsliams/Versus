import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';

const db=new DatabaseSync(':memory:');
db.exec('PRAGMA foreign_keys=ON;CREATE TABLE auth_accounts(id TEXT PRIMARY KEY,email TEXT UNIQUE,created INTEGER);CREATE TABLE users(id TEXT PRIMARY KEY,username TEXT,created INTEGER,bio TEXT);CREATE TABLE debates(id TEXT PRIMARY KEY,user TEXT,body TEXT,parent TEXT,created INTEGER);');
for(const [id,name,created] of [['owner','OriginalOwner',1],['first','LegacyName',2],['later','legacyname',3]]){
  db.prepare('INSERT INTO auth_accounts VALUES(?,?,?)').run(id,id+'@example.test',created);
  db.prepare('INSERT INTO users VALUES(?,?,?,?)').run(id,name,created,'Saved profile '+id);
}
for(const name of ['0005_arena_coins.sql','0006_owner.sql','0007_unique_usernames.sql'])db.exec(readFileSync(new URL('../cloudflare-migrations/'+name,import.meta.url),'utf8'));
assert.equal(db.prepare("SELECT username FROM users WHERE id='first'").get().username,'LegacyName');
assert.notEqual(db.prepare("SELECT username FROM users WHERE id='later'").get().username.toLowerCase(),'legacyname');
assert.equal(db.prepare("SELECT bio FROM users WHERE id='later'").get().bio,'Saved profile later');
assert.throws(()=>db.prepare('INSERT INTO users VALUES(?,?,?,?)').run('clone',' LEGACYNAME ',4,''));
assert.throws(()=>db.prepare('UPDATE users SET username=? WHERE id=?').run('originalowner','later'));
db.prepare('INSERT INTO owner_binding VALUES(1,?)').run('owner');
assert.throws(()=>db.prepare('INSERT INTO owner_binding VALUES(1,?)').run('later'));
assert.throws(()=>db.prepare('DELETE FROM auth_accounts WHERE id=?').run('owner'));
const gift=(id,amount)=>db.prepare("INSERT INTO coin_ledger VALUES(?,?,?,'Owner gift',?)").run('gift:'+id,'later',amount,10);
assert.throws(()=>gift('no-audit',100));
db.prepare('INSERT INTO owner_audit VALUES(?,?,?,?,?,?,?)').run('valid','owner','coins','later','{}',100,10);
db.exec('BEGIN');gift('valid',100);db.exec('COMMIT');
assert.equal(db.prepare("SELECT balance FROM coin_wallets WHERE user='later'").get().balance,1100);
assert.throws(()=>gift('valid',100));
assert.equal(db.prepare("SELECT balance FROM coin_wallets WHERE user='later'").get().balance,1100);
db.prepare('INSERT INTO owner_audit VALUES(?,?,?,?,?,?,?)').run('forged','first','coins','later','{}',100,10);
assert.throws(()=>gift('forged',100));
db.prepare('INSERT INTO owner_audit VALUES(?,?,?,?,?,?,?)').run('mismatch','owner','coins','later','{}',50,10);
assert.throws(()=>gift('mismatch',100));
assert.equal(db.prepare("SELECT SUM(delta) AS total FROM coin_ledger WHERE user='later'").get().total,1100);
console.log('PASS: unique usernames, preserved legacy profiles, one owner binding, protected owner account, audited coin gifts, duplicate payout protection, and wallet ledger integrity.');
