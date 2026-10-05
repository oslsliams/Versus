CREATE TABLE activity_rules(kind TEXT PRIMARY KEY,label TEXT NOT NULL,amount INTEGER NOT NULL,daily_limit INTEGER NOT NULL);
INSERT INTO activity_rules VALUES ('daily','Daily check-in',40,1),('comment','Useful comment',15,3),('suggestion','Community suggestion',35,1),('support','Support another fan’s idea',5,3),('lineup','Save a real-event lineup',35,1),('pick','Back a fighter',5,3),('ranking','Publish a ranking',20,1),('favorite','Choose your first favorite',20,1),('profile','Add your first bio',25,1);
CREATE TABLE activity_rewards(user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,kind TEXT NOT NULL REFERENCES activity_rules(kind),reference TEXT NOT NULL,amount INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user,kind,reference));
CREATE INDEX activity_rewards_daily ON activity_rewards(user,kind,created);
CREATE TRIGGER activity_reward_guard BEFORE INSERT ON activity_rewards BEGIN
 SELECT RAISE(ABORT,'Invalid reward') WHERE NEW.amount!=(SELECT amount FROM activity_rules WHERE kind=NEW.kind);
 SELECT RAISE(ABORT,'Invalid reward time') WHERE NEW.created<unixepoch()*1000-60000 OR NEW.created>unixepoch()*1000+60000;
 SELECT RAISE(IGNORE) WHERE EXISTS(SELECT 1 FROM activity_rewards WHERE user=NEW.user AND kind=NEW.kind AND reference=NEW.reference);
 SELECT RAISE(IGNORE) WHERE (SELECT COUNT(*) FROM activity_rewards WHERE user=NEW.user AND kind=NEW.kind AND created>=CAST(strftime('%s','now','start of day') AS INTEGER)*1000)>=(SELECT daily_limit FROM activity_rules WHERE kind=NEW.kind);
END;
CREATE TRIGGER credit_activity_reward AFTER INSERT ON activity_rewards BEGIN
 UPDATE coin_wallets SET balance=balance+NEW.amount WHERE user=NEW.user;
 INSERT INTO coin_ledger VALUES('activity:'||NEW.user||':'||NEW.kind||':'||NEW.reference,NEW.user,NEW.amount,(SELECT label FROM activity_rules WHERE kind=NEW.kind),NEW.created);
END;
CREATE TABLE event_comments(id TEXT PRIMARY KEY,user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,event TEXT NOT NULL,body TEXT NOT NULL CHECK(length(body) BETWEEN 10 AND 1200),created INTEGER NOT NULL,hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN(0,1)));
CREATE INDEX event_comments_event ON event_comments(event,created);
CREATE TABLE live_feed_cache(key TEXT PRIMARY KEY,data TEXT NOT NULL,checked INTEGER NOT NULL DEFAULT 0,attempted INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '');
CREATE TRIGGER reward_event_comment AFTER INSERT ON event_comments WHEN length(trim(NEW.body))>=30 AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'comment',lower(trim(NEW.body)),15,unixepoch()*1000); END;
CREATE TRIGGER reward_debate AFTER INSERT ON debates WHEN length(trim(NEW.body))>=30 AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'comment',lower(trim(NEW.body)),15,unixepoch()*1000); END;
CREATE TRIGGER reward_suggestion AFTER INSERT ON community_suggestions WHEN length(trim(NEW.body))>=30 AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'suggestion',lower(trim(NEW.title)),35,unixepoch()*1000); END;
CREATE TRIGGER reward_support AFTER INSERT ON suggestion_votes WHEN EXISTS(SELECT 1 FROM community_suggestions WHERE id=NEW.suggestion AND user!=NEW.user AND status!='Hidden') AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'support',NEW.suggestion,5,unixepoch()*1000); END;
CREATE TRIGGER reward_lineup AFTER INSERT ON fantasy_lineups WHEN EXISTS(SELECT 1 FROM fantasy_cards WHERE id=NEW.event AND json_extract(data,'$.replay')=0 AND json_extract(data,'$.startsAt')>unixepoch()*1000) AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'lineup',NEW.event,35,unixepoch()*1000); END;
CREATE TRIGGER reward_pick AFTER INSERT ON coin_picks WHEN 1 AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'pick',NEW.event||':'||NEW.bout,5,unixepoch()*1000); END;
CREATE TRIGGER reward_ranking AFTER INSERT ON rankings WHEN 1 AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.user,'ranking',lower(trim(NEW.title)),20,unixepoch()*1000); END;
CREATE TRIGGER reward_favorite AFTER UPDATE OF favoriteFighter ON users WHEN NEW.favoriteFighter!='' AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.id) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.id,'favorite','first',20,unixepoch()*1000); END;
CREATE TRIGGER reward_profile AFTER UPDATE OF bio ON users WHEN length(trim(NEW.bio))>=20 AND EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.id) BEGIN INSERT OR IGNORE INTO activity_rewards VALUES(NEW.id,'profile','first',25,unixepoch()*1000); END;
