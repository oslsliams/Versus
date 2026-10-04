# Publish VERSUS

1. Create your account at https://dash.cloudflare.com/sign-up.
2. Open PowerShell and paste:

```powershell
cd "C:\Users\liam6\Documents\Codex\2026-10-03\yo-w\outputs"
node scripts/publish-cloudflare.mjs
```

3. A browser opens. Sign in to Cloudflare and approve its publishing tool (Wrangler).
4. Return to PowerShell. Approve the database migrations if asked.
5. After deployment succeeds, open https://versusarena.org. The configuration connects your Cloudflare domain automatically. Cloudflare provisions its HTTPS certificate; initial activation can take a little time. The workers.dev link printed by the deployment also works. This public site runs on Cloudflare even when your computer is off.

The script creates or reuses `versus-db`, saves its database ID, checks and builds the app, applies versioned migrations, and publishes the Worker and assets. It uses your Cloudflare login; do not send passwords or API tokens in chat. If you have several Cloudflare accounts, choose the intended one when prompted. You may need to choose a workers.dev subdomain on your first publish.

To publish updates, run the same script. Existing cloud accounts and saved activity remain in the same database. Local preview data is separate and is not uploaded.

## Run the Cloudflare version locally

```powershell
node --import ./scripts/sites-env.mjs node_modules/wrangler/bin/wrangler.js d1 migrations apply DB --local --config wrangler.cloudflare.json --persist-to .wrangler/state
node --import ./scripts/sites-env.mjs node_modules/vite/bin/vite.js --config vite.cloudflare.config.ts
```

Open http://127.0.0.1:5174. Existing Sites preview remains available through the original dev command on port 5173.

## Accounts

Visitors can browse publicly. Email/password accounts let each person save predictions, rankings, and arguments and sign in on another device. Passwords use salted PBKDF2-SHA256 hashes; only hashes of opaque session cookies are stored. Cookies are HttpOnly, SameSite=Lax, Secure on HTTPS, expire in 30 days, and are revoked on sign-out. Login and registration are rate limited. Cloudflare identity never trusts the former Sites user headers.

Email verification and password recovery are not implemented yet. Use a password you can keep safely. Simulated results remain private; no public verified prediction leaderboard is available yet.

## Hosting configuration

`wrangler.cloudflare.json` is the Cloudflare source configuration. `vite.cloudflare.config.ts` builds the independent Worker. `cloudflare-migrations/` contains the tracked database migrations. Cloudflare may require billing depending on your account and usage. Check its current limits before choosing a plan.

Official references: https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/ and https://developers.cloudflare.com/d1/get-started/.
