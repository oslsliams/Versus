CREATE TABLE account_rewards (
  number INTEGER PRIMARY KEY AUTOINCREMENT,
  user TEXT NOT NULL UNIQUE REFERENCES auth_accounts(id) ON DELETE CASCADE,
  created INTEGER NOT NULL
);
CREATE TABLE coin_wallets (
  user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK(balance>=0)
);
CREATE TABLE coin_ledger (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created INTEGER NOT NULL
);
CREATE INDEX coin_ledger_user ON coin_ledger(user,created);
CREATE TABLE coin_picks (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  bout TEXT NOT NULL,
  red TEXT NOT NULL,
  blue TEXT NOT NULL,
  fighter TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK(amount BETWEEN 10 AND 1000),
  state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','won','lost','refunded')),
  payout INTEGER NOT NULL DEFAULT 0,
  result TEXT NOT NULL DEFAULT '',
  created INTEGER NOT NULL,
  settled INTEGER,
  UNIQUE(user,event,bout),
  CHECK(fighter=red OR fighter=blue)
);
CREATE INDEX coin_picks_pending ON coin_picks(state,event);
CREATE TRIGGER grant_account_coins AFTER INSERT ON account_rewards BEGIN
  INSERT INTO coin_wallets(user,balance) VALUES(NEW.user,CASE WHEN NEW.number<=200 THEN 1000 ELSE 100 END);
  INSERT INTO coin_ledger(id,user,delta,reason,created) VALUES('welcome:'||NEW.user,NEW.user,CASE WHEN NEW.number<=200 THEN 1000 ELSE 100 END,CASE WHEN NEW.number<=200 THEN 'Early Supporter welcome gift' ELSE 'Welcome coins' END,NEW.created);
END;
-- Existing real accounts retain their chronological place. Demo profiles are excluded.
INSERT INTO account_rewards(user,created) SELECT id,created FROM auth_accounts ORDER BY created,rowid;
CREATE TRIGGER enroll_new_account AFTER INSERT ON auth_accounts BEGIN
  INSERT INTO account_rewards(user,created) VALUES(NEW.id,NEW.created);
END;
CREATE TRIGGER check_coin_pick BEFORE INSERT ON coin_picks BEGIN
  SELECT (CASE WHEN NEW.state!='pending' OR NEW.payout!=0 THEN RAISE(ABORT,'Invalid starting state') END);
  SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user AND balance>=NEW.amount) THEN RAISE(ABORT,'Not enough Arena Coins') END);
END;
CREATE TRIGGER debit_coin_pick AFTER INSERT ON coin_picks BEGIN
  UPDATE coin_wallets SET balance=balance-NEW.amount WHERE user=NEW.user;
  INSERT INTO coin_ledger(id,user,delta,reason,created) VALUES('pick:'||NEW.id,NEW.user,-NEW.amount,'Fighter backed',NEW.created);
END;
CREATE TRIGGER protect_coin_pick BEFORE UPDATE ON coin_picks BEGIN
  SELECT (CASE WHEN OLD.state!='pending' OR NEW.state='pending' OR NEW.user!=OLD.user OR NEW.amount!=OLD.amount OR NEW.fighter!=OLD.fighter OR NEW.event!=OLD.event OR NEW.bout!=OLD.bout OR NEW.red!=OLD.red OR NEW.blue!=OLD.blue OR NEW.id!=OLD.id THEN RAISE(ABORT,'Pick is final') END);
  SELECT (CASE WHEN NEW.payout!=(CASE NEW.state WHEN 'won' THEN OLD.amount*2 WHEN 'refunded' THEN OLD.amount ELSE 0 END) THEN RAISE(ABORT,'Invalid coin payout') END);
END;
CREATE TRIGGER credit_coin_pick AFTER UPDATE ON coin_picks WHEN OLD.state='pending' AND NEW.state!='pending' BEGIN
  UPDATE coin_wallets SET balance=balance+NEW.payout WHERE user=NEW.user;
  INSERT INTO coin_ledger(id,user,delta,reason,created) VALUES('settle:'||NEW.id,NEW.user,NEW.payout,CASE NEW.state WHEN 'won' THEN 'Correct fighter pick' WHEN 'refunded' THEN 'Fighter pick refunded' ELSE 'Fighter pick settled' END,NEW.settled);
END;
