CREATE TABLE profile_showcase_cards(
 user TEXT NOT NULL REFERENCES auth_accounts(id) ON DELETE CASCADE,
 slot INTEGER NOT NULL CHECK(slot BETWEEN 1 AND 6),
 card TEXT NOT NULL,
 PRIMARY KEY(user,slot), UNIQUE(user,card),
 FOREIGN KEY(user,card) REFERENCES moment_purchases(user,card) ON DELETE CASCADE
);
CREATE TABLE profile_showcase_settings(
 user TEXT PRIMARY KEY REFERENCES auth_accounts(id) ON DELETE CASCADE,
 caption TEXT NOT NULL DEFAULT '' CHECK(length(caption)<=80)
);
