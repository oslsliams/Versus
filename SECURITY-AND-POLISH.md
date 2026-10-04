# Security and usability update

The browser warning is controlled by the actual connection and certificate, not by site text. The HTTPS version of `https://versusarena.org/moments` opened successfully during this update. No live Cloudflare settings were changed; the new protections take effect when this commit is pushed and deployed.

## Transport and browser protections

- The Worker redirects HTTP GET/HEAD traffic for the live VERSUS hostnames to HTTPS. It rejects HTTP mutations rather than forwarding account submissions over HTTP. Loopback previews stay usable.
- HTTPS responses on those hosts include one-year HSTS without extending it to unrelated subdomains.
- The content policy limits resources to this site, UFC fighter images, and the existing Google Fonts services. It blocks object embedding, frames, off-site form actions, and arbitrary connection destinations, and upgrades insecure resources.
- Vinext needs inline bootstrap scripts, so this policy explicitly permits inline scripts. It is a baseline resource policy, not a nonce-based XSS guarantee or a complete security audit.
- Existing nosniff, framing, and referrer protections are retained. Camera, microphone, location, payment, and USB access are disabled.
- API request bodies are read with a streaming size limit: 8 KiB normally, 200,000 bytes for profile photos. Cross-site browser mutations are rejected. API, sign-in, recovery, cookie-bearing, and Set-Cookie responses are not cached publicly.
- Existing salted password hashes, expiring HttpOnly sessions, secure cookies on HTTPS, origin checks, recovery-code hashes, rate limits, and database ownership checks remain in place.
- Owner commands now reject extra input fields. Server ownership checks and audited, idempotent gifts still apply.

Cloudflare's [Always Use HTTPS setting](https://developers.cloudflare.com/ssl/edge-certificates/additional-options/always-use-https/) is an additional domain-wide option: domain → SSL/TLS → Edge Certificates → Always Use HTTPS. The Worker enforcement does not repair an invalid or expired certificate.

## Usability

Profile photos now open an editor with a square live preview, drag positioning, horizontal/vertical sliders, 1–4× zoom, reset, cancel, and explicit Save photo. Selecting or cancelling does not overwrite the saved image. The saved image is a 512-pixel JPEG, subject to the existing server limit and allowed-format checks.

The new `/owner` page is linked by a crown for the verified owner. It includes self-coin grants with presets and the existing gifts, approvals, announcements, moderation, and audit history. No account gains ownership because of its username.

Dream Matchups represent imagined fights and saved opinions. They earn no coins. Their ratings compare UFC careers; the old uncalibrated win percentages were removed. Community percentages are labeled as shares of submitted fan votes. Unmeasured speed, cardio, and fight IQ are hidden from the visible trait table.

Fight Night Fantasy uses fighters scheduled on actual tracked UFC cards and scores their published results. Its 60 draft credits are a team budget, separate from coins. The page explains drafting, watching/scoring, and collectible rewards, and includes fighter/division search and a drafted-fighters filter.

## Verification

- `node scripts/test-web-security.mjs`: HTTPS guards, request limits, safe payload forwarding, resource/privacy headers, cross-site rejection, and crop geometry bounds.
- Existing account data, Moments data, and settings API tests: owner binding/gift integrity, wallet integrity, password recovery/session revocation, upload format/size checks, and saved account data.
- TypeScript and Cloudflare production build passed. Browser checks exercised photo zoom/position/cancel, owner controls, comparison copy, and responsive layouts.
- A standalone built-Worker preview could not start because Windows denied the native bundler's ancestor-directory scan. The Vite preview, production build, and worker-helper tests remain available; deployed headers need a post-push live check.

Publish by clicking Push origin in GitHub Desktop and waiting for the successful Cloudflare build.
