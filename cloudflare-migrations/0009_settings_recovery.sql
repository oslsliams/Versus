ALTER TABLE auth_accounts ADD COLUMN password_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_accounts ADD COLUMN recovery_hash TEXT;
ALTER TABLE auth_accounts ADD COLUMN recovery_created INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_sessions ADD COLUMN version INTEGER NOT NULL DEFAULT 0;
CREATE TABLE user_settings(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,compact INTEGER NOT NULL DEFAULT 0 CHECK(compact IN (0,1)),reduce_motion INTEGER NOT NULL DEFAULT 0 CHECK(reduce_motion IN (0,1)),hide_predictions INTEGER NOT NULL DEFAULT 0 CHECK(hide_predictions IN (0,1)));
CREATE TABLE profile_photos(user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,data BLOB NOT NULL,mime TEXT NOT NULL,updated INTEGER NOT NULL);
