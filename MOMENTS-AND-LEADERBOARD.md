# UFC Moments and Arena Coin leaderboard

Open `/moments` for the collection and `/leaderboard` for coin rankings. Both are linked from the home page, shop, and footer; Moments also appears in navigation.

## Collection and performance rewards

- Series 01 contains 14 permanent fan collectibles. Each includes a fighter portrait and a link to the official UFC account of the historic result.
- Cards cost a fixed 100–450 Arena Coins. There are no random packs, cash purchases, transfers, or cash-out.
- Save up to three owned cards for each upcoming tracked official event. Their fighters must be in different bouts. Two cards for the same fighter cannot stack.
- Lineups lock at the event's start. Purchasing a card after the start cannot create a play or earn retrospective rewards.
- Future performance pays 40 coins for a win, another 25 for KO/TKO/submission, and another 15 for a first-round finish: maximum 80 per card. Every tier has identical rewards.
- Loss, draw, no contest, and cancelled/replaced bouts pay zero. Pending results pay nothing. Replay events never pay coins. Cards remain owned and can be played at future events.
- The collection shows saved slots, unsaved changes, balance, collection count, rewards earned, a reward history, search, and owned/event filters.
- UFC result synchronization runs on the existing five-minute scheduled task and when the fantasy/coin/Moments endpoints refresh cards. Rewards wait for verified outcomes; sync errors are shown in the app.

## Leaderboard

Ranks are based on current spendable coin balances, including welcome bonuses and owner gifts. Spending coins can lower a rank. Equal balances share a rank, with username and ID providing stable display order.

The board shows the top 50 real accounts, the signed-in user's rank even outside the top 50, profile links, uploaded avatars, and a Friends view using accepted relationships. Demo accounts and blocked connections are excluded. It refreshes every 30 seconds and on focus. No emails or authentication fields are exposed.

## Deployment and safeguards

Push the new commit to `main` in GitHub Desktop. The configured Cloudflare deployment script applies `0011_moments.sql` before deploying the Worker. No additional service or secret is required.

The database enforces fixed prices, sufficient funds, one purchase per account/card, owned-only plays, three slots, unique fighter/bout per event, verified event identities, and the event lock. Lineup replacements use an atomic D1 batch. Rewards change only pending plays and write a unique ledger entry and wallet credit together; repeated or concurrent settlement cannot double-pay. Authentication supplies the actor; mutation requests check their origin and reject extra fields.

Verification:

```text
node scripts/test-moments-data.mjs
node scripts/test-moments-api.mjs  (local preview on port 5173)
npm run build:cloudflare
```

The data tests exercise purchases, locks, scoring, identity changes, payout idempotence, ledger integrity, deletion, ties, friends, and blocking. The API tests use disposable local accounts and check auth/origin restrictions, forged actor/price rejection, simultaneous purchases, private collections, lineup persistence, and safe public rankings.
