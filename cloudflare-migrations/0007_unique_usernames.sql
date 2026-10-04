-- Preserve the oldest claimant if legacy accounts share a display name.
-- Later duplicates keep their accounts and data, with a unique suffix.
WITH duplicates AS (
  SELECT id,ROW_NUMBER() OVER(PARTITION BY lower(trim(username)) ORDER BY created,id) AS position FROM users
)
UPDATE users SET username=substr(trim(username),1,10)||'_'||substr(replace(id,'-',''),1,12)
WHERE id IN (SELECT id FROM duplicates WHERE position>1);
CREATE UNIQUE INDEX users_username_unique ON users(lower(trim(username)));
