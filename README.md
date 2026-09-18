# Ledger — Personal Finance Tracker

Ledger is a responsive React web and Expo Android app for recording income and expenses, filtering financial activity, and understanding spending at a glance. Transactions are synchronized through the signed-in email account, with a local cache on each device.

## Features

- Add validated income and expense transactions with an amount, category, and date
- Create or remove custom expense categories that synchronize to every device on the same account
- Prevent expenses and other actions that would create a negative balance
- Filter by transaction type, category, and inclusive date range
- View total income, total expenses, and remaining balance
- See an expense breakdown by category
- Recover deleted transactions for 30 days
- Sign in using the fixed demo password and a Twilio Verify email one-time code
- Synchronize transactions and custom expense categories across web browsers and Android devices
- Keep a local device cache so the last synchronized data remains visible during a connection problem

## Tech stack

- React 19 and Vite 7
- Netlify Blobs for account-level cloud transaction persistence
- Netlify Functions for authenticated transaction operations and email OTP authentication
- Browser `localStorage` and Android `AsyncStorage` for local caching
- Twilio Verify for email OTP delivery
- Node's built-in test runner for finance-domain tests

## Local setup

Requirements: Node.js 20.19+ (or 22.12+) and a Twilio Verify service configured for email.

```bash
cd web
npm install
cp .env.example .env
npm run dev
```

`npm run dev` uses the deployed Netlify authentication API by default, so login works from the local Vite site. To target another API, set `VITE_API_BASE_URL` in `web/.env`.

Set the following environment variables in the Netlify site settings for production:

```text
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_VERIFY_SERVICE_SID=
AUTH_SECRET=
```

`AUTH_SECRET` should be a long, random secret. The `TWILIO_*` and `AUTH_SECRET` values are server-only; never expose them as Vite variables or commit real credentials.

## Quality checks

```bash
cd web
npm test
npm run build
```

## Deployment

The Netlify base directory must be `web`. The included root `netlify.toml` builds the Vite app, publishes `web/dist`, bundles the authentication functions, and configures the required redirects. Pushes to the connected GitHub production branch create a new deploy of the same Netlify site and URL.

## Assumptions and trade-offs

- Currency is fixed to USD for this first version.
- Dashboard totals and category spending are all-time values; filters refine the transaction list only.
- Netlify Blobs is used as a lightweight project backend. Each account is stored under a hashed email key, and all reads and writes require a valid signed session token.
- Existing local transactions are merged into the cloud account once per browser/app installation. Deleted records win over active records with the same ID during this migration.
- The last synchronized data remains visible offline, but creating, deleting, or restoring transactions requires a connection so devices cannot silently diverge.
- Authentication requires the fixed demonstration password `Cursor@123` before sending the emailed OTP. Because this password is bundled in the client, it is suitable only for project demonstration and is not production-grade authentication.
- The signed token authorizes every cloud transaction request and expires after seven days.
- Spending is allowed only when the current aggregate balance can cover it. This baseline does not calculate historical daily balances from transaction dates.
- Permanently deleting an item is immediate; the normal delete action first moves it to a 30-day recovery area.
