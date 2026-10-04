VERSUS automatic updates
=======================

Cloudflare runs the existing scheduled worker once per minute after deployment.
It refreshes ESPN event status (one-minute cache) and MMA headlines (15-minute
cache), discovers official UFC event links hourly, and updates tracked UFC cards
hourly before fight night and every five minutes within 24 hours of the start.
Finished official cards are checked daily for corrections. News, live rounds,
fantasy standings, wagers, and Moments rewards also refresh while their pages
are visible. Source outages retain the last verified data and display an error.

New fantasy events come from https://www.ufc.com/events and matching official
event pages. Their stable event slug becomes the internal ID. Existing event IDs,
draft prices, and saved lineups are retained. A newly listed event needs an
official start time and at least one announced bout; a full fantasy team requires
five different bouts. Replaced fighters invalidate their old matchup; only
explicit official outcomes settle coins. Cached ESPN winners never settle money
or fantasy. Arena Coins have no cash value.

The live breakdown comes from ESPN's actual round action feed. It is a partial
timeline, not a full strike log. ESPN currently supplies whole-fight totals but
does not expose round totals or live judge scorecards through this feed. The UI
shows a confirmed winner when supplied and otherwise a descriptive significant
strike leader. It never converts activity or absent scores into invented 10–9
rounds or winner probabilities.

The historical fighter archive remains a dated, sourced snapshot. Editorial
collectibles, shop items, and career photographs are reviewed additions; they
are not generated automatically from news headlines. This release includes
318 Moments covering 300 of 500 fighters (60%), with every new Legacy card
linked to a recorded UFCStats win. Existing collectible IDs and prices remain
unchanged. The collection loads 24 cards at a time to keep browsing responsive.

Required deployment: build, apply 0016_legacy_moments.sql with the other existing
migrations, deploy the worker including its scheduled handler and cron trigger.
The existing GitHub-connected Cloudflare build already performs these steps.
