# Arena Coins

Arena Coins are free virtual points used to back a fighter on upcoming fantasy cards. They have no cash value and cannot be bought, transferred, withdrawn, or redeemed. Fantasy lineup draft credits remain separate; drafting does not require coins.

## Accounts and rewards

The first 200 real accounts receive a permanent Early Supporter badge and 1,000 welcome coins. Existing accounts qualify in signup order when migration 0005 runs. Demo profiles do not qualify. Later accounts receive 100 welcome coins. Deleting an account does not reopen a supporter slot. Rewards are granted once inside the signup transaction.

## Fighter picks

Authenticated users can back either fighter with 10–1,000 coins, once per bout. Picks are final and lock at the event's published start time. Replay events do not accept coin picks. Balances and activity are private to the account.

Correct picks return twice the amount used, including the original stake. Losses return zero. Draws, no contests, cancellations, and removed matchups refund the original amount. Results come from the same verified official UFC event data used for fantasy scoring; users cannot submit outcomes or payouts. Once settled, a coin pick is final, including if the official result is changed later.

The scheduled five-minute event sync and event/coin reads settle eligible picks. Database triggers debit and credit balances atomically and maintain an immutable transaction identity for each reward, pick, and settlement. Repeated syncs cannot pay twice.

## Deployment and validation

The existing Cloudflare deployment applies migration 0005 before deploying the application. SQL migrations use LF line endings for Wrangler trigger parsing.

Validated the 200th/201st account boundary, backfilled rewards, insufficient balances, duplicate picks, concurrent spending, forged payouts, authentication and origin guards, replay restrictions, private wallet reads, win/loss/refund calculations, and repeated automatic settlement. Run `npm run build:cloudflare` to check types and produce the deployment build.
