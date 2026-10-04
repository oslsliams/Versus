import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync,readdirSync} from 'node:fs';
const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;');
for(const name of readdirSync(new URL('../cloudflare-migrations/',import.meta.url)).sort())db.exec(readFileSync(new URL('../cloudflare-migrations/'+name,import.meta.url),'utf8'));
const now=Math.floor(Date.now()/1000)*1000;
for(const id of ['alice','bob']){db.prepare('INSERT INTO auth_accounts(id,email,password_hash,salt,created) VALUES(?,?,?,?,?)').run(id,id+'@test.invalid','hash','salt',now);db.prepare('INSERT INTO users(id,username,favorites,created,active) VALUES(?,?,?,?,?)').run(id,id,'["mma"]',now,now);}
const balance=user=>db.prepare('SELECT balance FROM coin_wallets WHERE user=?').get(user).balance;
const claimed=kind=>db.prepare('SELECT COUNT(*) AS n FROM activity_rewards WHERE user=? AND kind=?').get('alice',kind).n;
db.prepare("INSERT OR IGNORE INTO activity_rewards VALUES('alice','daily',?,40,?)").run(String(Math.floor(now/86400000)),now);
db.prepare("INSERT OR IGNORE INTO activity_rewards VALUES('alice','daily',?,40,?)").run(String(Math.floor(now/86400000)),now);
assert.equal(balance('alice'),1040);assert.equal(claimed('daily'),1);
assert.throws(()=>db.prepare("INSERT INTO activity_rewards VALUES('alice','daily','forged',999,?)").run(now));
assert.throws(()=>db.prepare("INSERT INTO activity_rewards VALUES('bob','daily','past',40,?)").run(now-86400000));
for(let n=0;n<5;n++)db.prepare('INSERT INTO event_comments(id,user,event,body,created) VALUES(?,?,?,?,?)').run('c'+n,'alice','card','A respectful and different useful comment number '+n,now);
assert.equal(claimed('comment'),3);assert.equal(balance('alice'),1085);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM event_comments').get().n,5);
db.prepare("INSERT INTO event_comments(id,user,event,body,created) VALUES('duplicate','bob','card',?,?)").run('A useful same comment repeated for the duplicate content test.',now);
db.prepare("INSERT INTO debates(id,user,matchup,body,created) VALUES('repeated','bob','matchup',?,?)").run('A useful same comment repeated for the duplicate content test.',now);assert.equal(balance('bob'),1015);
db.prepare("INSERT INTO community_suggestions VALUES('idea','bob','Add useful things','This is a useful suggestion with plenty of detail.','Feature','Open',?)").run(now);
db.prepare("INSERT INTO suggestion_votes VALUES('idea','alice')").run();db.prepare("DELETE FROM suggestion_votes WHERE user='alice'").run();db.prepare("INSERT INTO suggestion_votes VALUES('idea','alice')").run();assert.equal(claimed('support'),1);
db.prepare("INSERT INTO suggestion_votes VALUES('idea','bob')").run();assert.equal(db.prepare("SELECT COUNT(*) AS n FROM activity_rewards WHERE user='bob' AND kind='support'").get().n,0);
db.prepare('INSERT INTO fantasy_cards(id,data) VALUES(?,?)').run('real',JSON.stringify({replay:false,startsAt:now+86400000}));db.prepare('INSERT INTO fantasy_cards(id,data) VALUES(?,?)').run('replay',JSON.stringify({replay:true,startsAt:now-86400000}));
for(const event of ['real','replay'])db.prepare('INSERT INTO fantasy_lineups VALUES(?,?,?,?,?,?,?)').run('alice',event,'My team','["a","b","c","d","e"]','a',now,now);assert.equal(claimed('lineup'),1);
db.prepare("UPDATE fantasy_lineups SET name='Changed team' WHERE user='alice'").run();assert.equal(claimed('lineup'),1);
db.prepare("UPDATE users SET bio='This is my first interesting bio.',favoriteFighter='pereira' WHERE id='alice'").run();db.prepare("UPDATE users SET bio='',favoriteFighter='' WHERE id='alice'").run();db.prepare("UPDATE users SET bio='Another interesting bio about fighting.',favoriteFighter='jones' WHERE id='alice'").run();assert.equal(claimed('favorite'),1);assert.equal(claimed('profile'),1);
// Reward limits must never prevent the underlying wager debit or ledger entry.
const before=balance('alice');for(let n=0;n<5;n++)db.prepare('INSERT INTO coin_picks(id,user,event,bout,red,blue,fighter,amount,created) VALUES(?,?,?,?,?,?,?,?,?)').run('pick'+n,'alice','real','bout'+n,'red','blue','red',10,now);assert.equal(claimed('pick'),3);assert.equal(balance('alice'),before-50+15);assert.equal(db.prepare("SELECT COUNT(*) AS n FROM coin_ledger WHERE reason='Fighter backed'").get().n,5);
assert.equal(balance('alice'),db.prepare("SELECT SUM(delta) AS n FROM coin_ledger WHERE user='alice'").get().n);
console.log('PASS: atomic rewards, fixed amounts, real-time dates, daily caps, duplicate content, vote toggles, self-support, replay exclusion, one-time milestones, and wager debit/ledger integrity after reward caps.');
