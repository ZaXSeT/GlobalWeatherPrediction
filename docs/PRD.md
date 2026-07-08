# Product Requirements Document — Global Weather Prediction

> **Phase 1 deliverable.** This document is the product/architecture specification only.
> No implementation. It is the contract that later phases (§6 of `CLAUDE.md`) build against.
>
> - **Course:** University Software Security — Assignment Option 1 (build a secure app + explain every security control in code comments).
> - **Status:** Draft v1.0 (Phase 1)
> - **Last updated:** 2026-07-06
> - **Authoritative rules:** `CLAUDE.md` (repo root). Where this PRD and `CLAUDE.md` disagree, `CLAUDE.md` wins.

---

## 1. Executive Summary

**Global Weather Prediction** is a full-stack web application that lets a registered user search any
city worldwide and view current conditions, an hourly outlook, a 7-day forecast, and air-quality
(AQI) data, then save favorite locations and review their own search history.

The application is real, but it is **not the point**. The graded artifact for this Software Security
assignment is a set of **correct, production-grade security controls, each explained in code** with a
mandatory four-line comment block (control name / Risk / How / Why). Every architectural choice in this
document is made to (a) keep the security-critical code **visible and hand-written** so it can be
demonstrated and graded, and (b) keep the overall system **proportional to a coursework app** — no
microservices, no orchestration, no enterprise patterns.

Concretely, the app demonstrates: input validation at every trust boundary (Zod), parameterized data
access (Prisma) against SQL injection, React/CSP defense against XSS, hand-rolled password hashing
(bcrypt) and session tokens (JWT) in httpOnly+Secure+SameSite cookies, CSRF double-submit protection,
per-resource authorization checks, server-side API-key protection via a weather proxy, strict security
headers, rate limiting on sensitive endpoints, safe structured logging, and generic client-facing error
handling. Each of these maps to a specific file and a specific comment block, indexed in
`docs/SECURITY.md`.

---

## 2. Problem Statement

Weather information is ubiquitous, but two problems recur in real apps and make weather a good vehicle
for a security assignment:

1. **Client-side secrets.** Naïve weather apps call the provider (OpenWeatherMap etc.) directly from the
   browser with the API key embedded in client code. The key is then trivially extractable, abused, and
   billed to the owner. A correct design proxies the provider **server-side** and never ships the key.
2. **Unprotected user data + weak auth.** Apps that add accounts (favorites, history) frequently get auth
   wrong: plaintext or weakly hashed passwords, tokens in localStorage (XSS-exfiltratable), missing CSRF
   protection on state changes, and missing per-user authorization (user A reading user B's data).

The problem this project solves, framed for grading: **demonstrate the correct, defended-in-depth way to
build an authenticated data application** — protecting the third-party key, the user's credentials, the
user's session, and the user's data — and **explain each defense in code** so a reviewer can verify not
just that a control exists but that its author understands the threat it addresses.

---

## 3. Goals

| #   | Goal                                                                                                           | Success signal                                                                                                                          |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| G1  | Every OWASP-relevant control in `CLAUDE.md §3` is implemented and carries a truthful `SECURITY` comment block. | `docs/SECURITY.md` maps each control → file/line → one-line explanation; reviewer can find and read each block.                         |
| G2  | The weather provider key never reaches the client.                                                             | Key is in a non-`NEXT_PUBLIC_` env var; a production bundle grep for the key returns nothing; all provider calls originate server-side. |
| G3  | Hand-rolled auth (no NextAuth/Supabase Auth) with bcrypt + JWT in a hardened cookie.                           | Login issues an httpOnly+Secure+SameSite cookie; wrong password rejected; expired/tampered token rejected.                              |
| G4  | State-changing requests are CSRF-protected and authorized per-user.                                            | Mutations require a valid double-submit token; user A cannot read/modify user B's favorites/history.                                    |
| G5  | Input is validated at every trust boundary.                                                                    | Every Route Handler parses input with Zod and rejects malformed input with a generic 400.                                               |
| G6  | The app compiles, lints, type-checks, and builds cleanly at every phase gate.                                  | `pnpm typecheck && pnpm lint && pnpm build` passes.                                                                                     |
| G7  | Two contributors with real, attributable division of labor.                                                    | Git history shows both identities on their own work; PRs list the security controls they touch.                                         |
| G8  | A polished but non-blocking UX (lazy 3D globe, responsive dashboard).                                          | Landing globe is lazy-loaded and never gates security work or first paint.                                                              |

---

## 4. Non-Goals

- **Not** a commercial weather service; no SLA, no paid tiers, no multi-region scaling.
- **Not** a general auth/identity provider; no OAuth social login, no SSO, no MFA in the graded scope
  (listed under Future Improvements).
- **Not** a microservice system; no Docker orchestration, message queues, or service mesh (`CLAUDE.md §2`).
- **Not** a mobile/native app; responsive web only.
- **No** admin console, billing, or team/multi-tenant features.
- **No** offline/PWA support in scope.
- **No** custom weather modeling/ML — we consume a third-party provider; "prediction" = the provider's
  forecast, surfaced securely.
- **No** exhaustive automated test suite; Phase 9 covers targeted unit/integration tests plus a manual
  security checklist, proportional to coursework.

---

## 5. Target Users

| Persona                                            | Description                                                                                          | Primary needs                                                                                                   |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| **Registered end user ("Maya")**                   | Everyday person who wants quick, accurate weather for cities she cares about and wants to save them. | Fast search, clear current/hourly/7-day + AQI, save favorites, revisit history, trust that her account is safe. |
| **Casual visitor ("Sam")**                         | Lands on the marketing page, may search once or twice before deciding to register.                   | Immediately-understandable value, one demonstrable search, low-friction sign-up.                                |
| **Course grader / security reviewer ("Dr. Chen")** | Evaluates the assignment. **The most important reader of the code.**                                 | Find each security control quickly, read a truthful explanation, verify it defends the stated threat.           |
| **The two developers (Member A / Member B)**       | Build and maintain the app under real, separate git identities.                                      | Clear ownership, clean phase gates, a `SECURITY.md` evidence trail.                                             |

> Design implication: the grader is a first-class user. `docs/SECURITY.md` and the in-code comment blocks
> are UX for that user and are treated as product surface, not afterthoughts.

---

## 6. User Stories

**Authentication & account**

- U1. As a visitor, I can register with an email and password so that I can save locations.
- U2. As a registered user, I can log in and stay logged in across page loads via a secure cookie.
- U3. As a logged-in user, I can log out, which invalidates my session cookie.
- U4. As a user, I want my password stored so that even a database breach does not reveal it.
- U5. As a user, I want my session to expire so that a stolen/stale token cannot be used indefinitely.

**Weather**

- U6. As a user, I can search a city by name and see current conditions.
- U7. As a user, I can see an hourly outlook and a 7-day forecast for the searched city.
- U8. As a user, I can see the air-quality index (AQI) for the searched city.
- U9. As a user, I want fast results, so repeated identical searches are served from a short-lived cache.
- U10. As a visitor, I can try one search from the landing page before registering. _(Rate-limited; see NFR/Sec.)_

**User data**

- U11. As a user, I can add a searched city to my favorites.
- U12. As a user, I can view and remove my favorites.
- U13. As a user, I can view my recent search history.
- U14. As a user, I can only ever see and modify **my own** favorites and history — never anyone else's.

**Security / trust (cross-cutting, grader-facing)**

- U15. As a security reviewer, I can open any security-relevant file and find a `SECURITY` comment block
  that names the control, the risk, the mechanism, and why it's necessary.
- U16. As the app owner, I want the weather API key to never appear in client code or network traffic
  from the browser to the provider.
- U17. As a user, when something fails, I see a generic message while the server logs the detail — no
  stack traces or secrets leak to my browser.

---

## 7. Functional Requirements

**FR-A Authentication**

- FR-A1. Register: accept email + password, validate with Zod, reject duplicates, hash password with
  bcrypt, create user.
- FR-A2. Login: verify credentials, issue a signed JWT set as an httpOnly+Secure+SameSite cookie.
- FR-A3. Logout: clear the session cookie.
- FR-A4. Current-user (`/me`): return the authenticated user's public profile (never the hash).
- FR-A5. Session validation happens server-side on every protected request (see §11 Architecture note on
  Edge vs Node runtime).

**FR-W Weather**

- FR-W1. City search: accept a validated city string (and optional country/coords), call the provider
  **server-side**, return normalized current + hourly + 7-day + AQI.
- FR-W2. Normalize provider responses into a stable internal shape so the client never depends on provider
  quirks.
- FR-W3. Cache identical provider lookups for a short TTL to cut latency and provider quota use.
- FR-W4. Degrade gracefully if the provider is unavailable (generic error, no leaked provider detail).

**FR-U User data**

- FR-U1. Favorites: create, list, delete — always scoped to the authenticated user.
- FR-U2. History: record a search (city + timestamp) for the authenticated user; list recent entries.
- FR-U3. Profile: view basic account info; (optional) change password with re-validation.

**FR-S System**

- FR-S1. All mutations require a valid CSRF double-submit token.
- FR-S2. All API input validated at the trust boundary before use.
- FR-S3. Sensitive endpoints (`/api/auth/*`, `/api/weather`) are rate-limited.
- FR-S4. Security headers applied globally.
- FR-S5. Errors return generic client messages; details go to structured server logs only.

---

## 8. Non-Functional Requirements

| Category                 | Requirement                                                                                                                                                          |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Security**             | Primary NFR. See §10. Defense-in-depth; least privilege; fail closed on auth/authorization.                                                                          |
| **Performance**          | Cached weather lookups return in < 300 ms server-side; cold provider lookups target < 1.5 s. Landing 3D globe lazy-loaded and must not block first contentful paint. |
| **Reliability**          | App fails closed (deny) on auth errors; provider outage yields a graceful, generic error, not a crash.                                                               |
| **Maintainability**      | One language (TypeScript) end-to-end; shared Zod schemas and types; clear folder structure (§13); each control isolated and commented.                               |
| **Portability / Deploy** | Single deploy target: Vercel + Supabase (Singapore region). Env-driven config; `.env.example` committed, `.env` gitignored.                                          |
| **Accessibility**        | Keyboard-navigable forms, sufficient contrast, semantic HTML; globe is decorative and never required to use the app.                                                 |
| **Observability**        | Structured server logs with request context; **never** log passwords, tokens, secrets, or full provider keys.                                                        |
| **Compliance (course)**  | Every control carries the mandatory comment block; `docs/SECURITY.md` kept current; academic-integrity git attribution (§16).                                        |

---

## 9. Security Requirements

> This section is the heart of the assignment. Each item maps to a control in `CLAUDE.md §3` and will
> carry the mandatory `SECURITY — <name> / Risk / How / Why` comment block at its implementation site.
> `docs/SECURITY.md` will be the master index (control → file/line → one-liner).

| ID    | Control                   | Threat defended                                                      | Mechanism (planned)                                                                     | Home (planned)                                           |
| ----- | ------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| SR-1  | **Input validation**      | Injection, type confusion, malformed input abuse                     | Zod schema parse at every Route Handler + env parse                                     | `src/lib/validation/`, each `route.ts`, `src/lib/env.ts` |
| SR-2  | **SQL injection defense** | SQLi via user-controlled query values                                | Prisma parameterized queries; no string-built SQL                                       | `src/lib/db.ts` + data-access calls                      |
| SR-3  | **XSS defense**           | Script injection into rendered pages                                 | React auto-escaping; ban `dangerouslySetInnerHTML`; CSP header backstop                 | components + CSP in `middleware.ts`/`next.config.ts`     |
| SR-4  | **Password hashing**      | Credential theft from DB breach                                      | bcrypt with documented cost factor (salt rounds)                                        | `src/lib/auth/password.ts`                               |
| SR-5  | **JWT session tokens**    | Session forgery, indefinite reuse                                    | Signed JWT, short access-token expiry, documented refresh strategy                      | `src/lib/auth/jwt.ts`                                    |
| SR-6  | **Secure cookies**        | Token theft via JS/XSS, transport sniffing, cross-site send          | httpOnly + Secure + SameSite (Lax/Strict) cookie                                        | login Route Handler + `src/lib/auth/session.ts`          |
| SR-7  | **API-key protection**    | Third-party key extraction/abuse                                     | Server-side weather proxy; key in non-`NEXT_PUBLIC_` env var                            | `src/app/api/weather/route.ts`, `src/lib/weather/`       |
| SR-8  | **Env management**        | Misconfiguration, secret leakage                                     | Zod-validated env; `.env.example` committed, `.env` gitignored                          | `src/lib/env.ts`                                         |
| SR-9  | **Rate limiting**         | Brute force, credential stuffing, quota exhaustion                   | Upstash Redis limiter (documented in-memory/DB fallback)                                | auth + weather routes                                    |
| SR-10 | **Security headers**      | Clickjacking, MIME sniffing, referrer leak, feature abuse, downgrade | CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy | `middleware.ts` + `next.config.ts`                       |
| SR-11 | **CORS lockdown**         | Cross-origin API abuse                                               | Same-origin / explicit allowlist on API routes                                          | API layer / middleware                                   |
| SR-12 | **CSRF protection**       | Forged state-changing requests (cookie auth)                         | Double-submit cookie token verified on every mutation                                   | `src/lib/auth/csrf.ts` + mutation routes                 |
| SR-13 | **Authorization**         | Horizontal privilege escalation (IDOR)                               | Per-resource ownership checks (user owns favorite/history row)                          | favorites/history Route Handlers                         |
| SR-14 | **Safe logging**          | Secret leakage via logs                                              | Structured logs; redaction; never log passwords/tokens/keys                             | logging util + call sites                                |
| SR-15 | **Safe error handling**   | Info disclosure via stack traces                                     | Generic client messages; detailed server-only logs                                      | shared error helper + Route Handlers                     |

**Security assumptions & trust boundaries (elaborated in Phase 2 threat model):**

- The browser is untrusted; every input crossing into a Route Handler is validated.
- The weather provider and the database are trusted-but-isolated: only server code talks to them.
- Secrets live only in server env; the client bundle is treated as public.
- Auth fails closed: any ambiguity in token validity or ownership → deny.

---

## 10. Tech Stack

| Layer              | Choice                                            | Locked by CLAUDE.md? | Notes                                                                                                           |
| ------------------ | ------------------------------------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------- |
| Framework          | Next.js (App Router) + TypeScript                 | ✅                   | Single deploy target, one runtime.                                                                              |
| Package manager    | pnpm                                              | ✅                   |                                                                                                                 |
| API                | Next.js Route Handlers (`src/app/api/**`)         | ✅                   | No Express — smaller attack surface.                                                                            |
| Auth (hashing)     | `bcrypt`                                          | ✅                   | Node runtime only.                                                                                              |
| Auth (tokens)      | `jsonwebtoken` (sign, Node runtime)               | ✅                   | See runtime note below.                                                                                         |
| Auth (edge verify) | **`jose`** for token verification in middleware   | ➕ Proposed          | Edge-safe; still hand-rolled (not NextAuth). Ratify in Phase 2.                                                 |
| DB                 | PostgreSQL (Supabase, Singapore) via Prisma       | ✅                   | Prisma parameterization = documented anti-SQLi control.                                                         |
| Weather            | OpenWeatherMap **or** WeatherAPI.com, server-side | ✅                   | Open-Meteo only as keyless fallback if signup blocks (loses the API-key teaching moment — would be documented). |
| Headers            | `middleware.ts` + `next.config.ts` `headers()`    | ✅                   | No Helmet (Express-only).                                                                                       |
| Rate limiting      | `@upstash/ratelimit` + Upstash Redis              | ✅                   | Documented in-memory/DB fallback allowed.                                                                       |
| Validation         | Zod                                               | ✅                   | At every trust boundary.                                                                                        |
| CSRF               | Double-submit cookie token                        | ✅                   | Required because auth is cookie-based.                                                                          |
| UI                 | Tailwind + shadcn/ui + Framer Motion              | ✅                   |                                                                                                                 |
| 3D                 | Three.js globe on landing hero, lazy-loaded       | ✅                   | Non-blocking.                                                                                                   |
| Tooling            | ESLint, Prettier, `tsc` typecheck                 | ✅ (Phase 3)         | Verification gates (§8 CLAUDE.md).                                                                              |
| Hosting            | Vercel (app) + Supabase (DB)                      | ✅                   |                                                                                                                 |

> **Runtime note (the one flag from kickoff):** `bcrypt` and `jsonwebtoken` are Node-native and cannot run
> on the Edge runtime that Next.js middleware uses by default. Plan: middleware verifies the JWT with
> `jose` (Edge-safe) or the auth gate is enforced inside Node-runtime Route Handlers; `bcrypt`/`jsonwebtoken`
> stay in Node-runtime handlers for hashing and signing. This preserves "hand-rolled auth, no NextAuth."
> **Decision to ratify in Phase 2.**

---

## 11. System Architecture

```
                         ┌─────────────────────────────────────────┐
                         │  Browser (Next.js client, React)         │
                         │  - marketing (landing + lazy 3D globe)   │
                         │  - app (authenticated dashboard)         │
                         └───────────────┬─────────────────────────┘
                                         │ fetch, same-origin, credentials: include
                                         │ (CSRF token on mutations)
                                         ▼
                         ┌─────────────────────────────────────────┐
                         │  middleware.ts (Edge)                    │
                         │  - security headers (CSP/HSTS/…)         │
                         │  - rate limiting                         │
                         │  - auth gate (edge-safe JWT verify)      │
                         └───────────────┬─────────────────────────┘
                                         ▼
       ┌───────────────────────────── Next.js Route Handlers (Node) ─────────────────────────────┐
       │                                                                                          │
       │  auth/*               weather                    favorites / history                     │
       │  bcrypt, JWT sign,    server-side proxy →         Prisma, per-user authorization checks   │
       │  cookies, CSRF        OpenWeatherMap (key)                                                │
       │       │                    │                              │                               │
       └───────┼────────────────────┼──────────────────────────────┼───────────────────────────────┘
               │                    │                              │
               ▼                    ▼                              ▼
        Supabase Postgres    OpenWeatherMap API             Supabase Postgres
        (users)              (weather + AQI)                (favorites, history)

  Invariant: no client ever talks to the weather provider or the database directly.
```

**Trust boundaries (detailed STRIDE-lite in Phase 2):**

1. Browser → Route Handler: all input validated (Zod), all mutations CSRF-checked, sensitive routes
   rate-limited.
2. Route Handler → DB: parameterized (Prisma), ownership-scoped queries only.
3. Route Handler → Provider: server-only, key from server env, response normalized before returning.
4. Server → Client responses: generic errors, no secrets/stack traces.

---

## 12. Database Design

> Descriptive schema only (no Prisma code — that is Phase 4). Postgres via Prisma. All timestamps UTC.
> All user-owned rows carry `userId` for authorization scoping (SR-13).

**`User`**

| Column       | Type             | Notes                                                                  |
| ------------ | ---------------- | ---------------------------------------------------------------------- |
| id           | uuid / cuid (PK) | Primary key.                                                           |
| email        | citext, unique   | Login identity; unique constraint prevents duplicate accounts (FR-A1). |
| passwordHash | text             | bcrypt hash only — never plaintext (SR-4).                             |
| createdAt    | timestamptz      |                                                                        |
| updatedAt    | timestamptz      |                                                                        |

**`Favorite`**

| Column    | Type                                | Notes                                          |
| --------- | ----------------------------------- | ---------------------------------------------- |
| id        | uuid/cuid (PK)                      |                                                |
| userId    | FK → User.id                        | Ownership scope (SR-13); indexed.              |
| city      | text                                | Normalized city label.                         |
| latitude  | double                              | Provider-resolved coords for stable re-lookup. |
| longitude | double                              |                                                |
| createdAt | timestamptz                         |                                                |
| —         | unique(userId, latitude, longitude) | Prevent duplicate favorites per user.          |

**`SearchHistory`**

| Column               | Type           | Notes                                                  |
| -------------------- | -------------- | ------------------------------------------------------ |
| id                   | uuid/cuid (PK) |                                                        |
| userId               | FK → User.id   | Ownership scope (SR-13); indexed.                      |
| city                 | text           | Searched label.                                        |
| latitude / longitude | double         | Optional resolved coords.                              |
| createdAt            | timestamptz    | For "recent history" ordering; consider retention cap. |

**Relationships:** `User 1—* Favorite`, `User 1—* SearchHistory`. Deleting a user cascades to their
favorites/history.

**Notes:**

- **RLS:** Application-layer authorization (ownership checks in Route Handlers) is the graded control.
  Supabase Row-Level Security is noted as defense-in-depth to document in Phase 4 (we connect via Prisma
  with a privileged role, so app-layer checks are mandatory regardless).
- **Connection pooling:** serverless (Vercel) needs Supabase's pooled connection string (PgBouncer) plus
  a direct URL for migrations — to be configured in Phase 4.
- No provider weather data is persisted (cache is short-lived/in-memory or Redis), so there is no stale
  third-party data liability.

---

## 13. API Design

> All endpoints are same-origin Route Handlers under `src/app/api/**`. All responses JSON. All input
> Zod-validated. Mutations require CSRF token. Auth-protected routes require a valid session cookie.

| Method | Path                                    | Auth      | CSRF | Rate-limited | Purpose                               | Success          | Errors (generic)           |
| ------ | --------------------------------------- | --------- | ---- | ------------ | ------------------------------------- | ---------------- | -------------------------- |
| POST   | `/api/auth/register`                    | No        | Yes  | Yes          | Create account (FR-A1)                | 201              | 400 invalid, 409 duplicate |
| POST   | `/api/auth/login`                       | No        | Yes  | Yes          | Authenticate, set cookie (FR-A2)      | 200 + Set-Cookie | 400, 401 invalid creds     |
| POST   | `/api/auth/logout`                      | Yes       | Yes  | —            | Clear session (FR-A3)                 | 204              | 401                        |
| GET    | `/api/auth/me`                          | Yes       | —    | —            | Current user profile (FR-A4)          | 200              | 401                        |
| GET    | `/api/weather?city=…` (or `?lat=&lon=`) | Optional* | —    | Yes          | Proxy current+hourly+7day+AQI (FR-W1) | 200 normalized   | 400, 429, 502 provider     |
| GET    | `/api/favorites`                        | Yes       | —    | —            | List own favorites (FR-U1)            | 200              | 401                        |
| POST   | `/api/favorites`                        | Yes       | Yes  | —            | Add favorite (FR-U1)                  | 201              | 400, 401, 409 dup          |
| DELETE | `/api/favorites/:id`                    | Yes       | Yes  | —            | Remove own favorite (FR-U1, SR-13)    | 204              | 401, 403/404 not owner     |
| GET    | `/api/history`                          | Yes       | —    | —            | List own recent searches (FR-U2)      | 200              | 401                        |
| POST   | `/api/history`                          | Yes       | Yes  | —            | Record a search (FR-U2)               | 201              | 400, 401                   |

> *`/api/weather` may allow a limited anonymous search from the landing page (U10), guarded by stricter
> rate limiting; final decision (anonymous vs login-required) is ratified in Phase 6. Ownership errors
> (SR-13) return 404 rather than 403 where enumeration is a concern — decided per-route in implementation.

**Conventions:** generic error bodies (`{ "error": "message" }`) with server-side detail logged;
no stack traces to client (SR-15); consistent 429 with `Retry-After` on rate limit (SR-9).

---

## 14. Folder Structure (target)

Per `CLAUDE.md §5` — reproduced here as the build target:

```
src/
  app/
    (marketing)/            # landing page + lazy 3D globe
    (app)/                  # authenticated weather dashboard
    api/
      auth/{register,login,logout,me}/route.ts
      weather/route.ts      # server-side proxy (holds provider key)
      favorites/route.ts
      history/route.ts
  components/               # shadcn/ui + feature components
  lib/
    auth/{password.ts,jwt.ts,session.ts,csrf.ts}
    validation/            # shared Zod schemas
    env.ts                 # Zod-validated env
    weather/               # provider client + normalization + caching
    db.ts                  # Prisma client singleton
  middleware.ts            # headers, rate limit, auth gate
prisma/schema.prisma
docs/{PRD.md,SECURITY.md}  # SECURITY.md = master control index
.env.example               # committed; .env gitignored
```

---

## 15. UI Pages & Components

**Pages**

| Route group | Page         | Purpose                                                                      | Auth |
| ----------- | ------------ | ---------------------------------------------------------------------------- | ---- |
| (marketing) | `/` Landing  | Hero with lazy Three.js globe, value prop, one demo search, CTA to register. | No   |
| (auth)      | `/register`  | Registration form (Zod-validated client + server).                           | No   |
| (auth)      | `/login`     | Login form.                                                                  | No   |
| (app)       | `/dashboard` | Search bar + current conditions + hourly + 7-day + AQI.                      | Yes  |
| (app)       | `/favorites` | List/manage saved locations.                                                 | Yes  |
| (app)       | `/history`   | Recent searches.                                                             | Yes  |
| (app)       | `/profile`   | Account info; optional password change.                                      | Yes  |

**Key components**

- `GlobeHero` — lazy-loaded Three.js globe (dynamic import, `ssr:false`), decorative only.
- `SearchBar` — city input with client-side validation mirroring the server Zod schema.
- `CurrentConditionsCard`, `HourlyStrip`, `SevenDayForecast`, `AqiCard` — presentational, fed normalized data.
- `FavoriteButton` / `FavoritesList` — mutations carry CSRF token.
- `AuthForm` (register/login shared) — accessible, generic error display.
- `AppShell` / nav — auth-aware; logout action.
- `ErrorBoundary` / toast — surfaces only generic messages (SR-15).

> Visual polish is explicitly secondary to security (`CLAUDE.md §0`). The globe must never gate first
> paint or delay security work.

---

## 16. Milestones, Timeline & Workflow

**Milestones (mapped to `CLAUDE.md §6` phases):**

| M   | Phase                                 | Exit criteria                                                                                         |
| --- | ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| M1  | Phase 1 — PRD                         | This document approved.                                                                               |
| M2  | Phase 2 — Architecture & threat model | Data flow, trust boundaries, STRIDE-lite, decisions record (incl. Edge/Node auth runtime decision).   |
| M3  | Phase 3 — Scaffold                    | Next.js app + tooling; `pnpm typecheck && lint && build` green; empty `docs/SECURITY.md`.             |
| M4  | Phase 4 — Database                    | Prisma schema + migration + Supabase connection; RLS notes.                                           |
| M5  | Phase 5 — Auth                        | register/login/logout/me + bcrypt + JWT + cookies + CSRF, fully commented.                            |
| M6  | Phase 6 — Weather                     | Server-side proxy + client + caching + validation + rate limit.                                       |
| M7  | Phase 7 — Frontend                    | Landing (lazy globe), search, forecast/AQI, favorites, history, profile.                              |
| M8  | Phase 8 — Hardening                   | Headers, CORS, rate limits everywhere, authz checks, logging, error handling; `SECURITY.md` complete. |
| M9  | Phase 9 — Testing                     | Unit (auth/validation), integration (API), manual security checklist.                                 |
| M10 | Phase 10 — Deploy                     | Vercel + Supabase; prod security headers verified.                                                    |

**Timeline (indicative, adjust to course schedule):** roughly one focused work-session per phase, M2–M6
being the security-heavy core and deserving the most time. Each phase ends at a hard stop with a summary
and the verification gates run (`CLAUDE.md §6, §8`).

**GitHub workflow (`CLAUDE.md §7`):**

- Branches: `main` (protected) ← `dev` ← `feature/*`. Feature PRs into `dev`; `dev` → `main` at milestones.
- Conventional Commits (`feat(auth): …`, `docs(security): …`).
- **Every PR description lists the security controls it adds/touches** — doubles as assignment evidence.
- Each developer commits under their **own** git identity; no fabricated co-authorship (academic integrity).
- Note: git is **not yet initialized** in this repo — initialization + branch protection is a Phase 3 task.

---

## 17. Team Responsibility Matrix

Suggested ownership from `CLAUDE.md §7`, adjustable to reality. Shared files (types, `env.ts`) are
touched through PR review so both contribute.

| Area / Control                              | Member A        | Member B        |
| ------------------------------------------- | --------------- | --------------- |
| Auth (bcrypt, JWT, cookies, session)        | **Lead**        | Review          |
| CSRF (double-submit)                        | **Lead**        | Review          |
| Security middleware + headers               | **Lead**        | Review          |
| Rate limiting                               | **Lead**        | Review          |
| Authorization (ownership checks)            | **Lead**        | Review          |
| User features (favorites/history/profile)   | **Lead**        | Review          |
| `docs/SECURITY.md` (control index)          | **Lead**        | Contribute      |
| Weather proxy + provider client + caching   | Review          | **Lead**        |
| Validation schemas (Zod, shared)            | Contribute      | **Lead**        |
| Forecast / AQI UI                           | Review          | **Lead**        |
| Landing page + 3D globe                     | Review          | **Lead**        |
| Testing (unit/integration/manual checklist) | Contribute      | **Lead**        |
| Env management (`env.ts`, `.env.example`)   | Shared (via PR) | Shared (via PR) |
| PRD / Architecture docs                     | Shared          | Shared          |

---

## 18. Risks & Mitigations

| #   | Risk                                                                               | Likelihood | Impact | Mitigation                                                                                                                               |
| --- | ---------------------------------------------------------------------------------- | ---------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Edge runtime can't run bcrypt/jsonwebtoken**, breaking the middleware auth gate. | High       | High   | Verify JWT in middleware with `jose`, or enforce auth inside Node-runtime handlers; keep bcrypt/JWT-sign in Node. **Decide in Phase 2.** |
| R2  | Weather-provider signup/key blocked at demo time.                                  | Medium     | Medium | Documented fallback to keyless Open-Meteo, explicitly noting the lost API-key teaching moment (`CLAUDE.md §2`).                          |
| R3  | Upstash Redis setup blocks the demo.                                               | Medium     | Low    | Documented in-memory/DB limiter fallback, stating the multi-instance tradeoff.                                                           |
| R4  | Serverless DB connection exhaustion (Prisma on Vercel).                            | Medium     | Medium | Use Supabase pooled (PgBouncer) URL + direct URL for migrations; Prisma singleton. Configure in Phase 4.                                 |
| R5  | Secret leaking into client bundle (`NEXT_PUBLIC_` misuse).                         | Low        | High   | Zod env split (server vs public), lint/grep gate for the key in the bundle at Phase 6 & 10.                                              |
| R6  | Vague/untruthful security comments failing the grade.                              | Medium     | High   | Enforce the four-line block per control; if all three lines can't be filled honestly, stop and flag (`CLAUDE.md §1`).                    |
| R7  | Scope creep / over-engineering.                                                    | Medium     | Medium | Hard prohibitions (`CLAUDE.md §9`); one phase at a time with stop gates.                                                                 |
| R8  | Rate limiting locking out legitimate demo/grader use.                              | Low        | Medium | Tune thresholds; document them; separate anonymous vs authenticated limits.                                                              |
| R9  | CSP too strict → 3D globe/inline assets break; too loose → weakens XSS defense.    | Medium     | Medium | Iterate CSP in Phase 8 against the real asset set; prefer nonces/hashes over `unsafe-inline`.                                            |
| R10 | Attribution/academic-integrity slip in git history.                                | Low        | High   | Enforce per-developer identity; no fabricated co-authorship; PRs list touched controls.                                                  |

---

## 19. Future Improvements (out of scope now)

- Multi-factor authentication (TOTP) and account recovery flows.
- Refresh-token rotation with server-side session revocation list.
- OAuth social login (kept out because it would hide the graded hand-rolled auth).
- Supabase RLS as an enforced second layer (documented now, enforced later).
- Weather alerts/notifications, saved locations on a map, unit preferences.
- Full automated test coverage + CI security scanning (SAST/dependency audit) in the pipeline.
- Observability stack (structured log shipping, tracing, alerting).
- i18n / localization and full WCAG AA audit.
- PWA/offline support.

---

## 20. Traceability — where the grade lives

The evidence trail for grading is threefold and must stay in sync:

1. **In-code `SECURITY` comment blocks** — one per control, at the code it protects (`CLAUDE.md §1`).
2. **`docs/SECURITY.md`** — master index: control → file/line → one-line explanation (created empty in
   Phase 3, filled as controls land, completed in Phase 8).
3. **PR descriptions** — each lists the controls it adds/touches (`CLAUDE.md §7`).

This PRD (§9 in particular) is the source list those three trace back to.

---

_End of Phase 1 PRD. Next: Phase 2 — Architecture, trust boundaries, and STRIDE-lite threat model — only
on explicit "Continue"._
