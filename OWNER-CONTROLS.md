# Owner controls and account persistence

The existing owner account receives VERSUS Approved and Owner badges. Its private control room appears on its own profile. It can approve or unapprove profiles, gift 1–10,000 free Arena Coins at a time, publish or clear a 240-character site announcement, and hide or restore saved community arguments. Hidden top-level arguments also hide their replies. These controls do not change official fight results or grant other accounts owner access.

Ownership is bound once to an immutable authenticated account ID. Bootstrap requires the server-side fingerprint of the account identified during setup and an account created before setup. A later registration, matching username, profile payload, or client-side role flag cannot grant ownership. The owner binding prevents deleting the owner account while it owns the site. There is no public ownership-transfer endpoint. All owner routes independently require the authenticated owner; mutations require a matching Origin and record an audit entry. Repeating the same command ID cannot issue a second coin gift.

Migration 0007 reserves usernames across both signup and profile edits using a case-insensitive, trimmed database uniqueness constraint. If legacy duplicate names exist, the oldest account keeps the name and later duplicates receive a suffix; their account IDs and saved data stay intact. Profile display names remain editable when the new name is available.

Account passwords remain salted password hashes. An HttpOnly, SameSite session cookie remembers sign-in for 30 days, with Secure set over HTTPS. Signing out revokes the session. Returning users can sign in with the same email and password to retrieve saved profiles, predictions, rankings, fantasy teams, and coin wallets. No password is saved in browser local storage. Password reset and email verification are not implemented.

Cloudflare deployment applies migrations 0006 and 0007. After deployment, sign in to the already-existing owner account and open Profile to initialize the owner binding and view the control room.

Validation: `node scripts/test-account-data.mjs` checks migration uniqueness, preserved legacy profiles, a single protected owner binding, authorized and idempotent coin gifts, and ledger integrity. Local API tests also passed ordinary-user/forged-role denial, Origin guards, concurrent repeated gift requests, approval changes, hidden replies and restoration, announcements, signup name races, sign-out revocation, and saved data after another sign-in. The Cloudflare production build passed.
