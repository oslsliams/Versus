CREATE TABLE shop_items(id TEXT PRIMARY KEY,kind TEXT NOT NULL,value TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),UNIQUE(kind,value));
INSERT INTO shop_items VALUES
('frame-gold','frame','gold',300),('frame-neon','frame','neon',150),('frame-ice','frame','ice',250),
('banner-aurora','banner','aurora',400),('banner-crimson','banner','crimson',250),('banner-gold','banner','gold',500),
('title-matchmaker','title','matchmaker',100),('title-cage','title','cage',200),('title-main','title','main',350);
CREATE TABLE shop_purchases(user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,item TEXT NOT NULL REFERENCES shop_items(id),price INTEGER NOT NULL,created INTEGER NOT NULL,PRIMARY KEY(user,item));
CREATE TABLE shop_equipped(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,frame TEXT NOT NULL DEFAULT 'classic',banner TEXT NOT NULL DEFAULT 'arena',title TEXT NOT NULL DEFAULT 'contender');
CREATE TRIGGER check_shop_purchase BEFORE INSERT ON shop_purchases BEGIN
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM shop_items WHERE id=NEW.item AND price=NEW.price) THEN RAISE(ABORT,'Invalid item price') END);
 SELECT (CASE WHEN NOT EXISTS(SELECT 1 FROM coin_wallets WHERE user=NEW.user AND balance>=NEW.price) THEN RAISE(ABORT,'Not enough Arena Coins') END);
END;
CREATE TRIGGER debit_shop_purchase AFTER INSERT ON shop_purchases BEGIN
 UPDATE coin_wallets SET balance=balance-NEW.price WHERE user=NEW.user;
 INSERT INTO coin_ledger(id,user,delta,reason,created) VALUES('purchase:'||NEW.user||':'||NEW.item,NEW.user,-NEW.price,'Shop purchase: '||NEW.item,NEW.created);
END;
CREATE TRIGGER check_equipped_insert BEFORE INSERT ON shop_equipped BEGIN
 SELECT (CASE WHEN (NEW.frame!='classic' AND NOT EXISTS(SELECT 1 FROM shop_purchases p JOIN shop_items i ON i.id=p.item WHERE p.user=NEW.user AND i.kind='frame' AND i.value=NEW.frame)) OR (NEW.banner!='arena' AND NOT EXISTS(SELECT 1 FROM shop_purchases p JOIN shop_items i ON i.id=p.item WHERE p.user=NEW.user AND i.kind='banner' AND i.value=NEW.banner)) OR (NEW.title!='contender' AND NOT EXISTS(SELECT 1 FROM shop_purchases p JOIN shop_items i ON i.id=p.item WHERE p.user=NEW.user AND i.kind='title' AND i.value=NEW.title)) THEN RAISE(ABORT,'Style not owned') END);
END;
CREATE TRIGGER check_equipped_update BEFORE UPDATE ON shop_equipped BEGIN
 SELECT (CASE WHEN NEW.user!=OLD.user OR (NEW.frame!='classic' AND NOT EXISTS(SELECT 1 FROM shop_purchases p JOIN shop_items i ON i.id=p.item WHERE p.user=NEW.user AND i.kind='frame' AND i.value=NEW.frame)) OR (NEW.banner!='arena' AND NOT EXISTS(SELECT 1 FROM shop_purchases p JOIN shop_items i ON i.id=p.item WHERE p.user=NEW.user AND i.kind='banner' AND i.value=NEW.banner)) OR (NEW.title!='contender' AND NOT EXISTS(SELECT 1 FROM shop_purchases p JOIN shop_items i ON i.id=p.item WHERE p.user=NEW.user AND i.kind='title' AND i.value=NEW.title)) THEN RAISE(ABORT,'Style not owned') END);
END;
