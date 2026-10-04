CREATE TABLE friendships (
  low TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  high TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  requester TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  state TEXT NOT NULL CHECK(state IN ('pending','accepted')),
  created INTEGER NOT NULL,
  updated INTEGER NOT NULL,
  PRIMARY KEY(low,high),
  CHECK(low<high),
  CHECK(requester=low OR requester=high)
);
CREATE INDEX friendships_high ON friendships(high,state);
CREATE TABLE account_blocks (
  user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  target TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
  created INTEGER NOT NULL,
  PRIMARY KEY(user,target),
  CHECK(user!=target)
);
CREATE INDEX account_blocks_target ON account_blocks(target,user);
CREATE TRIGGER friendship_block_guard BEFORE INSERT ON friendships BEGIN
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM account_blocks WHERE (user=NEW.low AND target=NEW.high) OR (user=NEW.high AND target=NEW.low)) THEN RAISE(ABORT,'Connection unavailable') END);
END;
CREATE TRIGGER friendship_update_block_guard BEFORE UPDATE ON friendships BEGIN
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM account_blocks WHERE (user=NEW.low AND target=NEW.high) OR (user=NEW.high AND target=NEW.low)) THEN RAISE(ABORT,'Connection unavailable') END);
END;
CREATE TRIGGER block_remove_connections AFTER INSERT ON account_blocks BEGIN
  DELETE FROM friendships WHERE (low=NEW.user AND high=NEW.target) OR (low=NEW.target AND high=NEW.user);
  DELETE FROM follows WHERE (user=NEW.user AND target=NEW.target) OR (user=NEW.target AND target=NEW.user);
END;
CREATE TRIGGER follow_block_guard BEFORE INSERT ON follows BEGIN
  SELECT (CASE WHEN EXISTS(SELECT 1 FROM account_blocks WHERE (user=NEW.user AND target=NEW.target) OR (user=NEW.target AND target=NEW.user)) THEN RAISE(ABORT,'Connection unavailable') END);
END;
