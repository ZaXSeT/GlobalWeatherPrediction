# SECURITY.md — Control Index & Evidence Trail

> **The grading evidence trail.** For every security control this app implements, this file maps:
> **control → file/line → one-line explanation**. Each control also carries the mandatory
> `SECURITY — <name> / Risk / How / Why` comment block at its implementation site (`CLAUDE.md §1`).
>
> - **Status legend:** ☐ Planned · ◐ In progress · ☑ Implemented & commented
> - Created in Phase 3 (skeleton). Rows fill in as each phase lands its controls; completed in Phase 8.
> - Threat rationale for each control lives in `docs/ARCHITECTURE.md` §6 (STRIDE-lite).

## How to read this file

Each control below corresponds to a Security Requirement (SR-x) from `docs/PRD.md §9`. When a control is
implemented, replace `TBD` with the concrete `path/to/file.ts:line` of its `SECURITY` comment block and
flip the status to ☑.

## Control index

| SR    | Control                                         | Status | Location (file:line)                                             | One-line explanation                                                                       | Phase |
| ----- | ----------------------------------------------- | :----: | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | :---: |
| SR-1  | Input validation (Zod at trust boundaries)      |   ☑    | src/lib/validation/{auth,weather,favorites}                      | Auth/weather/user-data requests parsed by Zod; malformed input rejected 400                |  5–7  |
| SR-2  | SQL injection defense (Prisma parameterization) |   ☑    | src/lib/db.ts:4                                                  | All DB access parameterized via Prisma Client; raw/string-built SQL forbidden              |   4   |
| SR-3  | XSS defense (React escaping + CSP)              |   ☑    | src/middleware.ts:17 · WeatherView.tsx:5                         | React auto-escaping + nonce CSP (no `unsafe-inline` scripts); no `dangerouslySetInnerHTML` |  7–8  |
| SR-4  | Password hashing (bcrypt)                       |   ☑    | src/lib/auth/password.ts:3                                       | Passwords stored only as salted bcrypt hashes (cost 12)                                    |   5   |
| SR-5  | JWT session tokens                              |   ☑    | src/lib/auth/jwt.ts:4                                            | Signed HS256 tokens, 1h expiry, alg pinned; verified per request (jose)                    |   5   |
| SR-6  | Secure cookies (httpOnly + Secure + SameSite)   |   ☑    | src/lib/auth/session.ts:5                                        | Session cookie httpOnly + Secure(prod) + SameSite=Lax; not JS-readable                     |   5   |
| SR-7  | API-key protection (server proxy)               |   ☑    | src/lib/weather/provider.ts:5                                    | Weather key read server-side only; verified ABSENT from client bundle                      |   6   |
| SR-8  | Env management (Zod-validated env)              |   ☑    | src/lib/env.ts:3                                                 | Fail-fast on missing/invalid config; secrets kept out of `NEXT_PUBLIC_`                    |   5   |
| SR-9  | Rate limiting (auth + weather)                  |   ☑    | src/lib/rate-limit.ts:6 · weather/login/register routes          | Per-IP throttle: weather 30/60s, login 10/60s, register 5/60s (in-mem/Upstash)             | 6, 8  |
| SR-10 | Security headers (CSP/HSTS/…)                   |   ☑    | src/middleware.ts · next.config.ts:13                            | Nonce CSP + HSTS + X-Frame-Options + nosniff + Referrer-Policy + Permissions               |   8   |
| SR-11 | CORS lockdown (same-origin/allowlist)           |   ☑    | src/middleware.ts:44                                             | /api cross-origin `Origin` (host ≠ Host) rejected 403; no wildcard ACAO                    |   8   |
| SR-12 | CSRF (double-submit token)                      |   ☑    | src/lib/auth/csrf.ts:5                                           | Mutations require X-CSRF-Token matching the csrf cookie (constant-time)                    |   5   |
| SR-13 | Authorization (per-resource ownership)          |   ☑    | src/app/api/favorites/route.ts:9 · [id] · history · (app)/layout | userId from session only; queries scoped `where userId`; non-owner delete→404              |   7   |
| SR-14 | Safe logging (redaction)                        |   ☑    | src/lib/log.ts:1                                                 | Structured JSON logs; sensitive keys redacted; secrets/tokens never logged                 | 6, 8  |
| SR-15 | Safe error handling (generic client errors)     |   ☑    | src/lib/http.ts:3 · src/app/error.tsx · global-error.tsx         | Generic client messages; error boundaries; no stack traces to client (prod)                | 5, 8  |

Auth route handlers that compose these controls:
`src/app/api/auth/{register,login,logout,me}/route.ts` (all `runtime = "nodejs"`).

## Verification log

Phase 5 — exercised against a running dev server and the real auth modules (2026-07-06):

- [x] **CSRF (SR-12)** — `POST /login`, `/register`, `/logout` with a missing OR mismatched `x-csrf-token` header → **403** (verified with a clean session to rule out a PowerShell `-WebSession` header-replay artifact).
- [x] **Input validation (SR-1)** — `POST /register` with an invalid email / too-short password → **400**.
- [x] **CSRF bootstrap + cookie flags (SR-12/SR-6)** — `GET /me` (anonymous) → `200 {authenticated:false}` and sets `csrf=…; Path=/; SameSite=lax` **without** `HttpOnly` (must be client-readable).
- [x] **Password hashing (SR-4)** — bcrypt hash prefix `$2b$12$` (cost 12); correct→true, wrong→false, unknown-user→false (constant-time path).
- [x] **JWT (SR-5)** — sign→verify returns the userId; **tampered, garbage, and `alg:none` tokens all → null** (algorithm pinned to HS256 defeats alg-confusion).
- [ ] Wrong password returns identical response to unknown user — _needs a live DB_ (login create/lookup path).
- [ ] Full login → session cookie → authenticated `/me` (sliding re-issue) → logout roundtrip — _needs a live DB_.

Phase 6 — weather proxy, against a running dev server + a production build (2026-07-06):

- [x] **API-key protection (SR-7)** — production client bundle (`.next/static`) grepped for the weather key, JWT secret, and DB password → **none present** (server bundle doesn't hardcode them either; read from `process.env`).
- [x] **Input validation (SR-1)** — `GET /api/weather` with no params and with `lat=999` → **400** generic.
- [x] **Rate limiting (SR-9)** — burst of requests hit the per-IP limit **exactly at 30/60s** → **429** with `Retry-After: 59` (in-memory limiter).
- [x] **Generic errors + safe logging (SR-15/SR-14)** — dummy key → provider returns 401 → client gets generic **502** `"Unable to fetch weather…"`; server log shows `Provider responded 401` **without** the URL/key.
- [ ] Live weather data (200 with normalized current/hourly/7-day/AQI) — _needs a real `WEATHER_API_KEY`_.
- [ ] Security headers present on responses — Phase 8.
- [ ] Auth-route rate limiting (login brute-force) — Phase 8.

Phase 7 — frontend + user-data routes, against a production build/server (`next start`, 2026-07-06):

- [x] **Authorization / auth (SR-13)** — `GET /api/favorites` and `/api/history` with no session → **401**; the `(app)` page guard **307-redirects `/dashboard` → `/login`** when unauthenticated.
- [x] **CSRF on user-data mutations (SR-12)** — `POST /api/favorites` and `DELETE /api/favorites/:id` with no token → **403**.
- [x] **Pages render (prod)** — `/`, `/login`, `/register` → **200**; landing HTML contains the hero + globe mount.
- [x] **XSS posture (SR-3)** — no `dangerouslySetInnerHTML` in the codebase; provider `condition` text rendered as escaped React text.
- [ ] Owner-scoped read/delete of real rows + "user A cannot touch user B's favorite (404)" — _needs a live DB_.
- [ ] Full authenticated UI journey (login → search → save favorite → history → logout) — _needs a live DB + weather key_.

> **Known dev-environment issue (not a code defect):** `pnpm dev` (Turbopack) crashes with a Windows
> `STATUS_DLL_INIT_FAILED (0xc0000142)` while spawning the PostCSS/Tailwind worker for `globals.css`, so
> **pages** 500 under `pnpm dev` in this environment (API routes are unaffected). `pnpm build` + `pnpm start`
> process the same CSS and work perfectly — all Phase 7 checks above were run against `next start`. Next 16
> has no `--no-turbopack` dev fallback; likely environmental (sandboxed Windows process spawning). Workaround
> for now: develop via `pnpm build && pnpm start`, or investigate the Turbopack worker spawn on the target machine.

Phase 8 — hardening pass, against a production build/server (`next start`, 2026-07-06):

- [x] **Security headers (SR-10)** — every response carries `Strict-Transport-Security`, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, and a per-request nonce `Content-Security-Policy`.
- [x] **CSP correctness (SR-3/SR-10)** — after forcing dynamic rendering, `/`, `/login`, `/register` served with **0 un-nonced inline scripts** (all 15 script tags carry the request nonce, which matches the CSP header). Strict `script-src` has no `'unsafe-inline'`.
- [x] **CORS lockdown (SR-11)** — `/api/*` with a cross-origin `Origin` → **403**; same-origin / no-Origin → **200**.
- [x] **Auth rate limiting (SR-9)** — 14× `POST /api/auth/login` → first 10 counted (403 CSRF) then **429** (limit 10/60s). Weather limit verified in Phase 6.
- [x] **Safe logging (SR-14)** — weather/login failures logged via the structured JSON logger; sensitive keys redacted; the provider URL/key is never logged.
- [ ] **CSP does not visually break the app** — the nonce is provably applied (above), but full render/globe verification under CSP enforcement needs a real **browser** (curl can't enforce CSP). Recommend a manual browser smoke test.

**Decision — no Edge JWT gate (refines ADR-001):** authentication is enforced authoritatively in Node (the
`(app)` layout guard + every protected route via `getCurrentUserId`, ADR-002). We deliberately did NOT add a
redundant `jose` JWT verification in Edge middleware — it would duplicate the authoritative check and ship
secret-dependent auth logic to the Edge runtime for no security gain. The middleware is scoped to headers +
CORS. This is a conscious, documented refinement, not an omission.

Phase 9 — automated test suite (Vitest, `pnpm test`, 2026-07-06):

- [x] **28 tests / 6 files pass.** Unit: bcrypt (SR-4), JWT incl. tampered/expired/`alg:none`/wrong-secret (SR-5), Zod schemas (SR-1), in-memory rate limiter (SR-9). Integration: `/api/weather` validation → 400 (SR-1/SR-15), `/api/favorites` unauth → 401 + no-CSRF → 403 (SR-13/SR-12).
- See `docs/TESTING.md` for the full strategy and the **manual security checklist** (the DB/browser-dependent items still open).

Phase 10 — deployment configuration + production verification (2026-07-06):

- [x] **Production security headers verified** on a production build (`next start`): CSP + HSTS + X-Frame-Options + X-Content-Type-Options + Referrer-Policy + Permissions-Policy all present on responses.
- [x] **No secrets in the production client bundle** — re-confirmed `.next/static` free of the weather key / JWT secret / DB password.
- [x] Deployment config in-repo: `vercel.json` (region `sin1`), `engines.node >=20`, `postinstall: prisma generate`. Runbook: `docs/DEPLOYMENT.md`.
- [ ] **Live deploy (Vercel + Supabase + Upstash + WeatherAPI key)** — owner-only; follow `docs/DEPLOYMENT.md`.

> ⚠️ **Production rate-limiting requires Upstash.** The in-memory limiter is per-instance, so on Vercel's
> serverless it does NOT enforce a shared limit — set `UPSTASH_REDIS_REST_URL`/`_TOKEN` in production or
> SR-9's brute-force/quota protection is effectively disabled. `src/lib/rate-limit.ts` auto-switches to
> Redis when both are set. (Documented tradeoff, ADR-006 / CLAUDE.md §2.)

## References

- Requirements: `docs/PRD.md §9`
- Threat model & decisions: `docs/ARCHITECTURE.md §6, §9`
- Comment-block rule: `CLAUDE.md §1`
