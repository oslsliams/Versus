# Collection shop and username accounts

Sign up and sign in with a unique username and password. No email is requested. Existing accounts use their current username and unchanged password; account IDs, sessions, owner privileges, badges, coins, and saved activity remain intact. Usernames ignore capitalization and surrounding spaces. Changing a username changes the name used to sign in.

The legacy auth_accounts.email column remains for compatibility with existing account records and the pinned owner bootstrap. New records use an internal account ID placeholder, never a supplied email. This field is not shown or used to authenticate. Passwords remain salted hashes and sign-in is remembered with a 30-day HttpOnly session cookie. Password changes and recovery codes are now available in [Account settings](ACCOUNT-SETTINGS.md).

Arena Coins can purchase nine permanent cosmetics: three avatar frames (150–300 coins), three profile banners (250–500), and three profile titles (100–350). Users buy each item once, then equip or restore the free defaults whenever they like. Cosmetics provide no scoring advantage. No real money, random rewards, paid account badges, trades, or withdrawals are involved.

Migration 0008 installs the fixed-price catalog, inventory, equipment, and atomic purchase debit triggers. The server ignores client prices, validates ownership before equipping, and keeps coin history consistent. Duplicate or repeated purchase requests charge at most once. Competing purchases cannot spend below zero. Inventory and equipment follow the account across sign-outs and devices.

The Shop is accessible from main navigation, your coin wallet, your profile, and the home page. Username account screens, the shop, profile cosmetics, and the home page feature links share a refreshed layout for desktop and phone screens.

Validation: `node scripts/test-shop-data.mjs` checks catalog prices, atomic debits, duplicate ownership, insufficient funds, equipment ownership, defaults, and the coin ledger. Local API checks passed email-free registration, username sign-in and duplicate protection, unchanged legacy passwords/data, forged price and user rejection, concurrent purchases, saved inventory after sign-out/sign-in, and equipment/reset. The Cloudflare production build passed; desktop and 390px phone layouts were inspected.
