CREATE TABLE fantasy_cards (id TEXT PRIMARY KEY, data TEXT NOT NULL, checked INTEGER NOT NULL DEFAULT 0, attempted INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '');
CREATE TABLE fantasy_lineups (user TEXT NOT NULL, event TEXT NOT NULL, name TEXT NOT NULL, fighters TEXT NOT NULL, captain TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL, PRIMARY KEY(user,event));
CREATE INDEX fantasy_lineups_event ON fantasy_lineups(event);
