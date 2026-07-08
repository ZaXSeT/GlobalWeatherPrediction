# Deployment — Vercel + Supabase Runbook

> **Phase 10 deliverable** (`CLAUDE.md §6`). Target: **Vercel** (app) + **Supabase Postgres, Singapore**
> (`ap-southeast-1`). Because deploying requires _your_ accounts and secrets, this is the configuration +
> a step-by-step runbook + the production verification checklist. Steps marked **[you]** can only be done
> by an account owner.

## 0. What's already in the repo for deployment

- [`vercel.json`](../vercel.json) — pins serverless functions to `sin1` (Singapore), co-located with Supabase.
- `package.json` — `engines.node >=20`; `postinstall: prisma generate` (regenerates the gitignored client on Vercel).
- [`next.config.ts`](../next.config.ts) + [`src/middleware.ts`](../src/middleware.ts) — production security headers + nonce CSP (verified below).
- Secure cookies auto-enable in production: `secure: NODE_ENV === "production"` (Vercel serves HTTPS), and the CSP adds `upgrade-insecure-requests` only in production.

## 1. Prerequisites **[you]**

Accounts: Supabase, Vercel, WeatherAPI.com (API key), and **Upstash** (Redis — see §6, required for real rate limiting).

## 2. Supabase **[you]**

1. Create a project in region **Southeast Asia (Singapore)**.
2. From **Project Settings → Database**, copy two connection strings:
   - **Pooled** (Transaction, PgBouncer, port **6543**) → `DATABASE_URL` (runtime).
   - **Direct** (Session, port **5432**) → `DIRECT_URL` (migrations only).
   - Append `?pgbouncer=true` to the pooled URL (see `.env.example`).
3. Keep the DB password safe — it is a secret.

## 3. Apply the database schema **[you]**

The initial migration is committed at `prisma/migrations/20260706000000_init/`. From a machine with the real
`DIRECT_URL` set (locally or in CI — **not** from the Vercel build; see note):

```bash
DIRECT_URL="postgres://…:5432/postgres" DATABASE_URL="postgres://…:6543/postgres?pgbouncer=true" pnpm db:deploy
```

Then confirm the tables/constraints/indexes exist (`docs/DATABASE.md §5`).

> **Do not put `prisma migrate deploy` in the Vercel build command.** Preview deploys would migrate the
> production DB, and a transient DB outage would fail unrelated builds. Run migrations as a deliberate,
> separate step (locally or a CI job) — Vercel's build only needs `prisma generate` (already in `postinstall`).

## 4. Environment variables **[you]**

Set these in **Vercel → Project → Settings → Environment Variables** (Production, and Preview if used).
Full template with comments: [`.env.example`](../.env.example).

| Variable                   | Secret? | Notes                                                |
| -------------------------- | :-----: | ---------------------------------------------------- |
| `DATABASE_URL`             |   🔒    | Supabase **pooled** (6543), `?pgbouncer=true`        |
| `DIRECT_URL`               |   🔒    | Supabase **direct** (5432) — migrations              |
| `JWT_SECRET`               |   🔒    | `openssl rand -base64 32` (≥32 chars)                |
| `WEATHER_API_KEY`          |   🔒    | WeatherAPI.com key — **never** prefix `NEXT_PUBLIC_` |
| `UPSTASH_REDIS_REST_URL`   |   🔒    | Upstash (see §6)                                     |
| `UPSTASH_REDIS_REST_TOKEN` |   🔒    | Upstash                                              |
| `NEXT_PUBLIC_APP_URL`      | public  | e.g. `https://your-app.vercel.app`                   |
| `NODE_ENV`                 |    —    | Vercel sets `production` automatically               |

The app **fails fast at boot** (SR-8, `src/lib/env.ts`) if a required var is missing or `JWT_SECRET` is too short.

## 5. Deploy on Vercel **[you]**

1. Import the Git repo into Vercel. Framework autodetects **Next.js**; package manager autodetects **pnpm** (lockfile present).
2. Build/install commands: leave defaults (`pnpm install` runs `postinstall → prisma generate`; then `next build`).
3. Region: `sin1` (from `vercel.json`; on Hobby, set the single function region to `sin1` in the dashboard if needed).
4. Deploy.

## 6. Upstash Redis — required for production rate limiting **[you]** ⚠️

The rate limiter (SR-9) falls back to an **in-memory** store when Upstash is unset. On Vercel, each
serverless invocation can be a **fresh instance**, so an in-memory counter does **not** enforce a shared
limit — brute-force/quota protection would be largely ineffective in production. Therefore:

1. Create an Upstash Redis database (region near Singapore).
2. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel.
   `src/lib/rate-limit.ts` automatically switches to the shared Redis limiter when both are present.

The weather cache (`src/lib/weather/cache.ts`) has the same per-instance caveat; it's a performance
optimization, so degraded cross-instance caching is acceptable (documented, ADR-006).

## 7. Post-deploy verification (production URL)

Locally, against the production build (`next start`), the following are **already verified** (2026-07-06):

- [x] Security headers on responses: **CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy — all present.**
- [x] Client bundle (`.next/static`) contains **no** weather key / JWT secret / DB password.
- [x] Nonce CSP applied with 0 un-nonced inline scripts.

Repeat against the live URL after deploy, plus the DB/browser items from `docs/TESTING.md §3`:

- [ ] `curl -sI https://<app>/login` shows all six security headers.
- [ ] Browser: no CSP violations in the console; the 3D globe renders; hydration works.
- [ ] Register → login → the `session` cookie is `HttpOnly; Secure; SameSite=Lax`.
- [ ] IDOR: user A cannot delete user B's favorite (→ 404).
- [ ] Search a real city → live current/hourly/7-day/AQI renders.
- [ ] View-source / network: the `WEATHER_API_KEY` never appears client-side.
- [ ] Trigger the login limiter a few times → 429 (confirms Upstash is active).

## 8. Rollback & ops notes

- **Rollback:** Vercel keeps immutable deployments — promote a previous one from the dashboard.
- **Secret rotation:** rotating `JWT_SECRET` invalidates all existing sessions (users must re-login) — acceptable, and the fastest response to a suspected token leak.
- **Logs:** structured JSON logs (SR-14) appear in Vercel's function logs; they are redacted of secrets by `src/lib/log.ts`.
