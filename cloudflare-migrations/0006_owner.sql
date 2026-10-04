CREATE TABLE owner_binding (
  singleton INTEGER PRIMARY KEY CHECK(singleton=1),
  user TEXT NOT NULL UNIQUE REFERENCES auth_accounts(id) ON DELETE RESTRICT
);
CREATE TABLE account_privileges (
  user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
  approved INTEGER NOT NULL DEFAULT 0 CHECK(approved IN (0,1))
);
CREATE TABLE owner_settings (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE owner_audit (
  id TEXT PRIMARY KEY,
  owner TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE RESTRICT,
  action TEXT NOT NULL,
  target TEXT NOT NULL,
  detail TEXT NOT NULL,
  amount INTEGER,
  created INTEGER NOT NULL
);
ALTER TABLE debates ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0 CHECK(hidden IN (0,1));
CREATE TRIGGER credit_owner_gift AFTER INSERT ON coin_ledger WHEN NEW.reason='Owner gift' BEGIN
  SELECT (CASE WHEN NEW.delta NOT BETWEEN 1 AND 10000 OR NOT EXISTS(SELECT 1 FROM owner_audit a JOIN owner_binding b ON b.user=a.owner WHERE a.id=substr(NEW.id,6) AND a.action='coins' AND a.target=NEW.user AND a.amount=NEW.delta) THEN RAISE(ABORT,'Invalid owner gift') END);
  UPDATE coin_wallets SET balance=balance+NEW.delta WHERE user=NEW.user;
END;
