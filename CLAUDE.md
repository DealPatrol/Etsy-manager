# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

**Etsy Manager Pro** is a full-stack SPA for Etsy sellers. The frontend is a single React 18 file served statically; the backend is a set of Vercel serverless functions under `api/`. There is no build step, no package.json, and no test suite.

## Running Locally

Install the [Vercel CLI](https://vercel.com/docs/cli) and run:

```bash
vercel dev
```

This emulates the serverless routing and makes `index.html` available at `localhost:3000` with `/api/*` routes wired up. You must set the three required env vars locally (in a `.env` file or Vercel project settings):

```
ETSY_API_KEYSTRING=<your-etsy-app-key>
ETSY_SHARED_SECRET=<your-etsy-app-secret>
ETSY_REDIRECT_URI=<your-oauth-callback-url>
```

## Deploying

Push to GitHub; Vercel auto-deploys. The `buildCommand` in `vercel.json` is a no-op (`echo '...'`). No compilation happens.

## Architecture

### Frontend (`index.html`)

A single HTML file containing the entire React application loaded via CDN (React 18 + Babel + Recharts). It renders an auth screen (signup/login) followed by a six-tab dashboard: Analytics, Pricing, SEO, Forecasting, Customers, Reports.

User session state (email, userId, sessionToken, Etsy access token) is persisted to `localStorage`. The PKCE code verifier for the OAuth flow is temporarily stored in `sessionStorage` and cleared after token exchange.

The file `etsy-dashboard.html` is a legacy/backup dashboard UI and is not served in production.

### Backend (`api/`)

Nine Vercel serverless functions, all using ES module syntax (`export default async function handler(req, res)`). All endpoints accept `POST` except `/api/health` which is `GET`.

| File | Purpose | Cache TTL |
|---|---|---|
| `auth.js` | Signup, login, session validation, logout | none |
| `token.js` | Etsy OAuth exchange, refresh, revoke | none |
| `analytics.js` | Shop KPIs (revenue, orders, conversion, top products) | 5 min |
| `pricing.js` | Price recommendations, campaigns, bundles | 1 hour |
| `seo.js` | Title quality scoring, keyword suggestions | none |
| `forecasting.js` | 90-day revenue/inventory projections | 30 min |
| `customers.js` | LTV, segments, churn risk, VIP lists | 30 min |
| `reporting.js` | P&L, tax calculations, profitability | none |
| `health.js` | Rate-limit stats and uptime | real-time |

### State Is In-Memory Only

All server-side state — `USERS`, `SESSIONS`, `TOKEN_CACHE`, `SHOP_CACHE`, `RATE_LIMITS` — lives in plain JavaScript objects at module scope. This state is lost on every cold start. The codebase is designed for a future migration to Supabase/PlanetScale (users/sessions) and Redis (token/analytics caches).

### OAuth Flow (PKCE)

1. Frontend generates a PKCE code verifier and stores it in `sessionStorage`.
2. User is redirected to `etsy.com/oauth/connect` with the code challenge.
3. Etsy redirects back with an authorization code.
4. Frontend sends `code` + `code_verifier` to `/api/token` (mode `exchange`).
5. Backend exchanges them for tokens using `ETSY_API_KEYSTRING` + `ETSY_SHARED_SECRET` (never exposed to the browser).
6. Access token is returned to the frontend; refresh token is cached server-side in `TOKEN_CACHE`.

## Key Conventions

- **Logging:** All `console.log`/`console.error` calls use the prefix `[v0]`.
- **CORS:** All endpoints currently return `Access-Control-Allow-Origin: *`. Scope this to your domain before a real production launch.
- **Password hashing:** PBKDF2 with a hardcoded salt (`'etsy_salt_2024'`, 100k iterations). The salt should be randomized per-user for production use.
- **Rate limiting:** 5 failed login attempts trigger a 15-minute lockout stored in `RATE_LIMITS`. The `/api/health` endpoint tracks a 100-req/min sliding window per user.
- **Mock data:** `index.html` contains `generateMockData()` and `generateListings()` helpers used when Etsy is not connected.
- **Function limits:** Each serverless function is allocated 1 GB memory and a 30-second max duration (set in `vercel.json`).
