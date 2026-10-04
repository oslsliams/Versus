# Friends and account lookup

The people icon in the header and Friends & account search on your profile open `/people`. The directory includes real registered accounts only, with username search, alphabetical/newest sorting, and pages of 24 accounts. Searches ignore capitalization and treat percent signs and underscores literally.

Friends, Requests, Following, and Blocked tabs show your own connections. A requester can cancel, a recipient can accept or decline, and either friend can remove the friendship. Repeated requests do not create duplicate pairs. Following remains separate from mutual friendship. The Community page also has a Friends filter for accepted friends’ arguments.

Profiles have Add friend/request controls and Copy profile link. Account options on another real profile allow blocking/unblocking. Blocking removes the friendship and follows in both directions, prevents requests and follows in both directions, and excludes the account from each other's directory results. Public discussions remain visible. Unblocking does not restore old connections.

Incoming requests appear as a badge on the header people icon. Connections refresh when the browser regains focus, every 30 seconds while the page is visible, and after changes. The request badge opens the Requests tab directly. Use Refresh for an immediate update. This is a request indicator, not push notifications or messaging.

Relationships and block lists are available only to their participants through authenticated `/api/social`. Accounts are identified by immutable IDs, not usernames. Search returns public profile fields, never authentication records, password hashes, emails, or recovery codes. Writes require the same origin and are checked on the server. Only the request recipient can accept. Requests are limited to 20 attempts per account in five minutes. A canonical pair key prevents duplicate friendships; database guards prevent connections to blocked accounts, including concurrent request/accept/follow races.

Migration `0010_friends.sql` creates the relationship/block tables and guards. The existing Cloudflare deployment command applies it before deploying. Push the new commit and wait for a successful build before using the live directory.

Validation: run `node scripts/test-social-api.mjs` with the local Cloudflare preview on port 5173. Disposable account tests cover permissions, forged actor fields, search/pagination, the full request lifecycle, duplicate/reverse races, block/unblock, connection removal, request throttling, and private data protection. `npm run build:cloudflare` checks the production build.
