// Both views use real accounts and spendable balances. RANK gives equal balances equal places.
export function leaderboardQuery(friends:boolean){return `WITH eligible AS (
 SELECT u.id,u.username,u.avatar,u.accent,u.favorites,u.created,u.active,ph.updated AS photoUpdated,s.frame AS profileFrame,w.balance,
 CASE WHEN o.user IS NOT NULL OR p.approved=1 THEN 1 ELSE 0 END AS approved,CASE WHEN o.user IS NOT NULL THEN 1 ELSE 0 END AS owner
 FROM coin_wallets w JOIN auth_accounts a ON a.id=w.user JOIN users u ON u.id=w.user
 LEFT JOIN profile_photos ph ON ph.user=u.id LEFT JOIN shop_equipped s ON s.user=u.id LEFT JOIN account_privileges p ON p.user=u.id LEFT JOIN owner_binding o ON o.user=u.id
 WHERE ${friends?"(u.id=?1 OR EXISTS(SELECT 1 FROM friendships f WHERE f.state='accepted' AND ((f.low=?1 AND f.high=u.id) OR (f.high=?1 AND f.low=u.id))))":"1=1"}
 AND NOT EXISTS(SELECT 1 FROM account_blocks b WHERE (b.user=?1 AND b.target=u.id) OR (b.target=?1 AND b.user=u.id))
 ),ranked AS(SELECT *,RANK() OVER(ORDER BY balance DESC) AS rank FROM eligible) `;}
