# Account settings and recovery

Open `/settings` using the gear in the header or Account settings on your profile.

- Upload JPG, PNG, or WebP profile photos (up to 5 MB). The browser crops to a square, resizes to 512 px, and sends a JPEG under 200 KB. Pictures are public; the database stores them against the authenticated account, never a supplied user ID. Initials, emoji and fighter avatars remain available in the profile editor.
- Change password using the current password and a new password of at least 12 characters. Other sessions are revoked and a fresh recovery code is issued. The current browser stays signed in. Username, badges, wallet, cosmetics, and saved picks stay attached to the same account.
- Sign out other devices without signing out this browser.
- Save compact layout, reduced motion, and prediction privacy preferences across devices. Private prediction picks are filtered on the server for other users; debates, votes, rankings, and fantasy teams retain their existing public behavior.

## Recovery codes

New accounts receive a private code after signup and must acknowledge saving it before continuing. Existing accounts can create their first code while signed in, including when they have forgotten the password. Replacing an existing code requires the current password.

Forgot password on the sign-in screen opens `/recover`. Recovery requires the current username, the saved code, and a new password. A reset consumes the old code, revokes prior sessions, signs in the recovering browser, and displays a replacement code once. No email is required. Accounts without a saved code cannot use this recovery flow once every session is lost. Never reset an account based on its username alone.

Codes have 128 bits of randomness; only their SHA-256 hashes are stored. Passwords remain salted PBKDF2 hashes. Plaintext passwords and codes are never stored in browser storage or database records. Code responses use `no-store`. Credential versions and conditional database updates prevent concurrent recovery reuse and sign-in races. Security attempts are rate-limited by client IP and account identifier. Settings writes and recovery require the same request origin.

Local preview and production have separate databases. Generate and save a code on the **live website** to recover the live account; a code generated on localhost cannot recover it.

## Publishing and verification

Migration `0009_settings_recovery.sql` is applied by the existing Cloudflare deployment command before deployment. Push this commit to `main`, wait for the successful Cloudflare build, then open the live Settings page. Existing version-0 sessions continue working until a password change or recovery revokes them.

For local verification, apply migrations, run the Cloudflare preview on port 5173, then run `node scripts/test-settings-api.mjs`. It creates and removes disposable local accounts. It verifies credential changes, concurrent one-use recovery, old-session revocation, saved-data retention, prediction filtering, photos, authentication, origin checks, and recovery throttling. Production build: `npm run build:cloudflare`.
