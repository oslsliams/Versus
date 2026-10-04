CREATE TABLE moment_catalog(id TEXT PRIMARY KEY,fighter TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0));
INSERT INTO moment_catalog VALUES
('volkanovski-276','alexander-volkanovski',150),('merab-306','merab-dvalishvili',150),('yan-251','petr-yan',200),('volkov-overeem','alexander-volkov',100),
('holloway-last-second','max-holloway',450),('pereira-300','alex-pereira',400),('topuria-298','ilia-topuria',350),('edwards-278','leon-edwards',350),('adesanya-287','israel-adesanya',350),('allen-muniz','brendan-allen',100),('jiri-275','jiri-prochazka',300),('zhang-275','zhang-weili',250),('pereira-281','alex-pereira',300),('zhang-300','zhang-weili',200);
CREATE TABLE moment_purchases(user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,card TEXT NOT NULL REFERENCES moment_catalog(id),price INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user,card));
CREATE TRIGGER check_moment_purchase BEFORE INSERT ON moment_purchases BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM moment_catalog WHERE id=NEW.card AND price=NEW.price) THEN RAISE(ABORT,'Invalid Moment price') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user AND balance>=NEW.price) THEN RAISE(ABORT,'Not enough Arena Coins') END);
END;
CREATE TRIGGER debit_moment_purchase AFTER INSERT ON moment_purchases BEGIN
 UPDATE coin_wallets SET balance=balance-NEW.price WHERE user=NEW.user;
 INSERT INTO coin_ledger VALUES('moment-buy:'||NEW.user||':'||NEW.card,NEW.user,-NEW.price,'Moment collected: '||NEW.card,NEW.created);
END;
CREATE TABLE moment_plays(
 user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,event TEXT NOT NULL REFERENCES fantasy_cards(id),slot INTEGER NOT NULL CHECK(slot BETWEEN 0 AND 2),card TEXT NOT NULL REFERENCES moment_catalog(id),fighter TEXT NOT NULL,bout TEXT NOT NULL,red TEXT NOT NULL,blue TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN('pending','settled')),payout INTEGER NOT NULL DEFAULT 0 CHECK(payout IN(0,40,65,80)),result TEXT NOT NULL DEFAULT '',created INTEGER NOT NULL,settled INTEGER,
 PRIMARY KEY(user,event,slot),UNIQUE(user,event,fighter),UNIQUE(user,event,bout),CHECK(fighter=red OR fighter=blue)
);
CREATE INDEX moments_pending ON moment_plays(state,event);
CREATE TRIGGER check_moment_play BEFORE INSERT ON moment_plays BEGIN
 SELECT (CASE WHEN NEW.state!='pending' OR NEW.payout!=0 OR NEW.settled IS NOT NULL THEN RAISE(ABORT,'Invalid Moment play') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM moment_purchases p JOIN moment_catalog c ON c.id=p.card WHERE p.user=NEW.user AND p.card=NEW.card AND c.fighter=NEW.fighter) THEN RAISE(ABORT,'Moment not owned') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM fantasy_cards f,json_each(f.data,'$.bouts') b WHERE f.id=NEW.event AND json_extract(f.data,'$.replay')=0 AND json_extract(f.data,'$.startsAt')>((julianday('now')-2440587.5)*86400000) AND NEW.created<json_extract(f.data,'$.startsAt') AND json_extract(b.value,'$.id')=NEW.bout AND json_extract(b.value,'$.red.id')=NEW.red AND json_extract(b.value,'$.blue.id')=NEW.blue AND json_extract(b.value,'$.outcome')='pending') THEN RAISE(ABORT,'Moment event locked or unavailable') END);
END;
CREATE TRIGGER lock_moment_delete BEFORE DELETE ON moment_plays WHEN EXISTS(SELECT 1 FROM auth_accounts WHERE id=OLD.user) BEGIN
 SELECT (CASE WHEN OLD.state!='pending' OR EXISTS(SELECT 1 FROM fantasy_cards WHERE id=OLD.event AND json_extract(data,'$.startsAt')<=((julianday('now')-2440587.5)*86400000)) THEN RAISE(ABORT,'Moment lineup locked') END);
END;
CREATE TRIGGER protect_moment_play BEFORE UPDATE ON moment_plays BEGIN
 SELECT (CASE WHEN OLD.state!='pending' OR NEW.state!='settled' OR NEW.user!=OLD.user OR NEW.event!=OLD.event OR NEW.slot!=OLD.slot OR NEW.card!=OLD.card OR NEW.fighter!=OLD.fighter OR NEW.bout!=OLD.bout OR NEW.red!=OLD.red OR NEW.blue!=OLD.blue OR NEW.created!=OLD.created OR NEW.settled IS NULL THEN RAISE(ABORT,'Moment play is final') END);
END;
CREATE TRIGGER reward_moment_play AFTER UPDATE ON moment_plays WHEN OLD.state='pending' AND NEW.state='settled' BEGIN
 UPDATE coin_wallets SET balance=balance+NEW.payout WHERE user=NEW.user;
 INSERT INTO coin_ledger VALUES('moment-reward:'||NEW.user||':'||NEW.event||':'||NEW.slot,NEW.user,NEW.payout,'Moment performance: '||NEW.card||' · '||NEW.result,NEW.settled);
END;
