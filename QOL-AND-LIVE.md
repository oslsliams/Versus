# VERSUS: 20 quality-of-life updates

1. Daily check-in: claim 40 free coins once per UTC day.
2. Useful comments: +15 coins, up to three per day, at least 30 characters; repeated text never earns twice.
3. Suggestions: +35 for the first eligible suggestion each day, with at least 30 characters of detail.
4. Supporting ideas: +5 up to three times per day; excludes your own ideas and vote toggles.
5. Fantasy entry: +35 for an eligible new upcoming real-event lineup, once per event and up to once per day; edits and replays do not earn.
6. Coin picks: +5 participation coins per new final pick, up to three per day, separate from outcome payouts.
7. Rankings: +20 for a new ranking title, up to once per day.
8. Profile milestones: first rewarded favorite earns +20; first rewarded bio of 20+ characters earns +25. Each is once per account.
9. A rewards hub shows your balance, daily progress, completion, reset time, and links to each activity.
10. Persistent discussions for every tracked fantasy event, with character counts and useful-comment reward guidance.
11. Comment refresh, newest/oldest order, author removal, owner moderation, block-aware visibility, duplicate protection, and rate limits.
12. Clearer free-coin wager controls with quick amounts (10/25/50/100), review before confirmation, explicit net gain/loss/refund rules, and links to earn more coins.
13. An ESPN MMA headline feed, with dates and direct publisher links, refreshed at most every 15 minutes.
14. A current ESPN event hub shows bout states, round/clock snapshots, results, records, and searchable fighters/divisions.
15. Expand a bout to see supplied significant/total strike counts, takedowns, knockdowns, ESPN submission counts, and control time. Missing values stay unavailable.
16. Source timestamps, cached-data notices, retry/manual refresh, and an auto-refresh toggle; polling pauses in hidden tabs. Event/live stats refresh at most once per minute; final stats cache for one hour.
17. Quick search for pages and fighters with Ctrl/Command K, focus management, native modal keyboard handling, and Escape dismissal.
18. “Find everything” groups features by purpose and provides a short getting-started guide; section shortcuts show the active page.
19. Mobile bottom shortcuts, return-to-top, larger controls, readable input text, stronger text contrast, keyboard outlines, skip-to-content, and reduced-motion support.
20. Calmer panels, softer accents, smoother restrained photo treatments, rounded image surfaces, consistent spacing, and single-result fighter labels.

Rewards are server-triggered and atomic with their source actions. Claim history prevents duplicate grants, and both wallets and the ledger are updated in the same database transaction. Source actions remain available after reward limits are reached. Removing a comment or suggestion does not refund or repeat its participation reward. No migration grants coins retroactively for older actions. Daily caps use UTC midnight, shown in the viewer’s timezone. Rewards are free currency, never cash.

`0015_activity_live.sql` adds rewards, event comments and provider caches. Apply locally for development; the existing Cloudflare deployment script applies all migrations remotely before deploying after Push origin. No production deployment or production wallet change was performed here.

The news/scoreboard/stats endpoints use public ESPN sources. These are provider feeds, not a guaranteed second-by-second data service. Availability, delay, corrections and schema changes are outside VERSUS’s control. Headlines are linked rather than republished as articles. ESPN data never settles fantasy or coin wagers: the existing verified UFC result pipeline remains authoritative. Public provider caching prevents one upstream request per visitor. Source event/bout/fighter IDs must match the current cached scoreboard before stats are fetched.

For Windows development only, a Vite middleware bridge fetches the same allowlisted public sources through Node when the preview’s Workerd network bridge fails. It is only registered during development, accepts fixed feed URLs or the numeric ESPN stats path, and is absent from the deployed Worker request flow. Production fetches ESPN directly.

Validation: TypeScript and Cloudflare production build; SQLite reward/ledger tests; parser tests; disposable local API checks for claims, comments, suggestions, support and picks; browser checks for source stats/news, quick navigation, rewards, wager review and mobile layout. No real user’s coin balance was changed during testing.
