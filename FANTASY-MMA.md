# Fantasy MMA

Open `/fantasy` to draft five fighters with 60 credits, one per bout. Choose a captain for 1.5× points. Signed-in players can save and edit one lineup per event until the first scheduled prelim. The server validates every pick, budget, captain, and deadline. Unsaved selections carry through sign-in in the same tab.

Wins earn 30 points, finishes add 20, submissions add another 5, round-one finishes add 10, and round-two finishes add 5. Draws earn 10. Losses, no contests, cancellations, and withdrawals earn zero. DQ wins earn win points only. Bonuses stack, then the captain multiplier applies. Scores are calculated on the server from verified card results, never from submitted client scores.

Competitive lineups stay hidden from other players before lock. Equal scores share a leaderboard rank. Past-card replays are private practice and do not count toward competitive profile totals.

## Event data and updates

The initial event catalog in `lib/fantasy-events.json` includes Allen vs Duncan, UFC 333, and a UFC 331 replay, sourced from official UFC event pages. New events need to be added to that catalog; the application does not discover future event announcements automatically. Every fighter on each imported card is available, including fighters outside the main comparison roster.

The Cloudflare Worker has a five-minute scheduled trigger. `lib/fantasy-store.ts` checks official card pages every five minutes within 24 hours of an event, hourly before that window, and daily afterward. Opening the fantasy page also checks whether an update is due. The browser refreshes saved standings every minute. Source updates can be delayed or unavailable: failed or malformed responses preserve the last verified data, display a status message, and never settle pending results. Replays use a fixed published-results snapshot.

Draft prices use the official card's ranking tiers: champion 16, ranks 1–5 cost 15, 6–10 cost 13, other ranked fighters 12, and unranked fighters 10. This is a game pricing rule. Existing prices remain fixed when the card refreshes. Removed or replaced bouts become cancelled entries for scoring. Players can replace withdrawn picks before lock; after lock they earn zero.

Migration `0004_fantasy.sql` adds the card cache and lineups without changing existing accounts. The existing Cloudflare deployment script applies the migration before deployment and publishes the scheduled trigger.

Validation performed: official completed/upcoming card parsing, win/finish/round/draw/NC/DQ scoring, captain multiplication, budget and same-bout rejection, account persistence, replay separation, pre-lock privacy, API deadline enforcement, phone layout, and Cloudflare production build.
