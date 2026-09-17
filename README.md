# Ledger — Personal Finance Tracker

Ledger is a responsive React web app for recording income and expenses, filtering financial activity, and understanding spending at a glance. Data is namespaced by the signed-in email and stored locally in the current browser.

## Features

- Add validated income and expense transactions with an amount, category, and date
- Prevent expenses and other actions that would create a negative balance
- Filter by transaction type, category, and inclusive date range
- View total income, total expenses, and remaining balance
- See an expense breakdown by category
- Recover deleted transactions for 30 days
- Sign in using a password plus a Twilio Verify email one-time code
- Persist account data in browser `localStorage`

## Tech stack

- React 19 and Vite 7
- Browser `localStorage` for transaction persistence
- Netlify Functions and Netlify Blobs for password authentication
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
- Local storage keeps the app simple and private, but data is device/browser-specific and can be cleared by the user. It is not cloud synchronization or a backup.
- The first successful OTP verification registers the supplied password. Passwords are stored in Netlify Blobs only as salted scrypt hashes; later sign-ins require the password and a new OTP.
- Authentication identifies the local account namespace. Because transactions never leave the browser, the signed token does not protect a remote transaction API.
- Spending is allowed only when the current aggregate balance can cover it. This baseline does not calculate historical daily balances from transaction dates.
- Permanently deleting an item is immediate; the normal delete action first moves it to a 30-day recovery area.
