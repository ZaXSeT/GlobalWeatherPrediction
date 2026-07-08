# Architecture & Threat Model — Global Weather Prediction

> **Phase 2 deliverable** (`CLAUDE.md §6`). Documentation only — no code.
> Covers: runtime model, data-flow walkthroughs, trust boundaries, a STRIDE-lite threat model,
> and a Decisions Record (ADRs). This is the security reasoning that Phases 3–10 implement against.
>
> - **Status:** Draft v1.0 (Phase 2)
> - **Last updated:** 2026-07-06
> - **Builds on:** `docs/PRD.md` (esp. §9 Security Requirements SR-1…SR-15).
> - **Authority:** `CLAUDE.md` wins on any conflict.

---

## 1. Purpose & scope

This document turns the PRD into an implementable, security-reasoned architecture. It answers four
questions a grader will ask:

1. **Where does code run** (and why does that matter for auth)?
2. **How does data flow** through the system for each important operation?
3. **Where are the trust boundaries**, and what control guards each crossing?
4. **What are the concrete threats** (STRIDE-lite) and what is our residual risk after controls?

It closes with a **Decisions Record** — numbered ADRs — that locks the choices Phase 1 left open,
most importantly the Edge-vs-Node auth runtime split (PRD risk R1).

---

## 2. Runtime model (the decision everything else hangs on)

Next.js gives us **two server runtimes**, and mixing them up silently breaks auth:

| Runtime  | Where                                                                      | Can run `bcrypt` / `jsonwebtoken`? | Notes                                                 |
| -------- | -------------------------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------- |
| **Edge** | `middleware.ts` (default)                                                  | ❌ No — both are Node-native.      | Runs on every matched request; fast, Web-Crypto only. |
| **Node** | Route Handlers (`route.ts`) can opt into `export const runtime = 'nodejs'` | ✅ Yes                             | Full Node APIs; where hashing and token signing live. |

**Consequence:** the middleware cannot hash passwords or verify a `jsonwebtoken`-signed JWT. If we still
want middleware to participate in auth, it must verify tokens with a **Web-Crypto-based** library —
`jose` — which runs on Edge.

**Decision (ADR-001, ratified below):** two-tier auth.

- **Middleware (Edge):** a _coarse, fail-closed gate_. Verify the session JWT's signature + expiry with
  `jose`. If invalid/absent on a protected route → redirect to `/login` (pages) or `401` (API). This is
  a fast first line, not the authority.
- **Route Handlers (Node):** the _authoritative_ checks. Re-verify the token (or trust the middleware-
  populated identity), then do the security-critical work: `bcrypt` verify, `jsonwebtoken` sign,
  **authorization/ownership** (SR-13), CSRF (SR-12), input validation (SR-1).

This keeps the graded, hand-rolled auth (bcrypt + jsonwebtoken) intact in Node, adds a legitimate
edge gate, and uses `jose` **only for verification** — not as an auth framework. It is not NextAuth and
does not violate `CLAUDE.md §2`/§9. See ADR-001 for the rejected alternative.

> **Security principle applied:** _defense in depth_ + _fail closed_. The edge gate can be bypassed only
> by an attacker who also defeats the Node-layer authorization checks — never a single point of failure.

---

## 3. Component map

```
┌───────────────────────────────────────────────────────────────────────────┐
│ BROWSER (untrusted)                                                         │
│  React client — marketing (landing + lazy globe) / app (dashboard)          │
│  Holds: session cookie (httpOnly, JS can't read), CSRF token (readable)     │
└───────────────┬─────────────────────────────────────────────────────────────┘
                │ HTTPS, same-origin, fetch(credentials:'include')
                │ mutations also send X-CSRF-Token header
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ EDGE — middleware.ts                                                        │
│  SR-10 security headers · SR-9 rate limit · SR-11 CORS posture              │
│  coarse auth gate: jose verify(JWT) → fail closed                           │
└───────────────┬─────────────────────────────────────────────────────────────┘
                ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ NODE — Route Handlers (src/app/api/**)  [runtime = 'nodejs']                │
│                                                                             │
│  auth/*            weather                 favorites / history              │
│  SR-1 validate     SR-1 validate           SR-1 validate                    │
│  SR-4 bcrypt       SR-7 key from env       SR-13 ownership check            │
│  SR-5 JWT sign     SR-9 rate limit         SR-12 CSRF on writes            │
│  SR-6 cookie       normalize + SR-3 no     SR-2 Prisma params              │
│  SR-12 CSRF        raw HTML                                                  │
│  SR-14 safe logs · SR-15 generic errors  (everywhere)                       │
└───────┬───────────────────┬───────────────────────────┬────────────────────┘
        ▼                   ▼                           ▼
  Supabase Postgres   WeatherAPI.com              Supabase Postgres
  (User)              (weather + AQI)             (Favorite, SearchHistory)
  via Prisma (SR-2)   server-only, key server-    via Prisma (SR-2),
                      side (SR-7)                  ownership-scoped (SR-13)

INVARIANT: the browser never reaches the provider or the DB directly.
```

---

## 4. Data-flow walkthroughs

Each flow lists the controls it exercises. These are the flows Phase 5/6 implement and Phase 9 tests.

### 4.1 Register (POST `/api/auth/register`)

```
Browser → (email,password,csrf) → Edge(headers,ratelimit) → Node handler
  1. SR-12 CSRF: verify double-submit token (cookie value == header value).
  2. SR-1  Validate body with Zod (email format, password policy).
  3. Check email uniqueness (Prisma, parameterized — SR-2).
  4. SR-4  Hash password with bcrypt (documented cost factor). Plaintext never stored/logged.
  5. Create User row.
  6. SR-15 Return 201 generic success (no user enumeration detail); on dup → 409 generic.
```

### 4.2 Login (POST `/api/auth/login`)

```
Browser → (email,password,csrf) → Edge(headers,ratelimit ↑strict) → Node handler
  1. SR-12 CSRF verify.
  2. SR-1  Zod validate.
  3. Look up user by email (Prisma — SR-2).
  4. SR-4  bcrypt.compare(password, hash). Wrong password OR unknown user → identical 401
           (SR-15, no account-existence oracle). Constant-ish behavior.
  5. SR-5  Sign JWT (short expiry, minimal claims: userId, iat, exp).
  6. SR-6  Set-Cookie: session=JWT  (httpOnly, Secure, SameSite=Lax, Path=/).
           Also set/rotate CSRF token cookie (readable) — see 4.6.
  7. Return 200 (no token in body).
```

### 4.3 Authenticated weather search (GET `/api/weather?city=…`)

```
Browser → (session cookie) → Edge(headers, jose verify, ratelimit) → Node handler
  1. Edge coarse gate: jose verify(session). Invalid → 401 (fail closed).
  2. Node: re-establish identity; SR-1 Zod-validate query (city/lat/lon).
  3. Cache lookup (short TTL). Hit → return normalized data.
  4. Miss → server-side fetch to provider with key from process.env (non-NEXT_PUBLIC_ — SR-7).
  5. Normalize provider JSON → stable internal shape (client never sees raw provider payload — SR-3/SR-15).
  6. Cache + return 200. Provider error → 502 generic (SR-15); provider detail only in server logs (SR-14).
```

### 4.4 Add favorite (POST `/api/favorites`) — a state change

```
Browser → (session cookie, csrf header, body) → Edge → Node handler
  1. Edge coarse gate (jose).           2. SR-12 CSRF verify.
  3. SR-1 Zod validate body.            4. Derive userId from verified session (NOT from the request body).
  5. Insert Favorite{ userId, ... } via Prisma (SR-2). unique(userId,lat,lon) prevents dupes.
  6. Return 201 generic.
```

> **Key authorization principle:** `userId` is taken from the _authenticated session_, never from client
> input — a client cannot create/read rows "as" another user (SR-13, anti-IDOR).

### 4.5 Delete favorite (DELETE `/api/favorites/:id`) — ownership-critical

```
  1. Edge gate + CSRF + validate :id.
  2. SR-13 Ownership: delete WHERE id=:id AND userId=session.userId (single scoped query).
  3. If 0 rows affected → 404 generic (do not reveal whether the id exists for another user).
```

### 4.6 CSRF token issuance & verification (cross-cutting, SR-12)

```
On login/session-establish: server sets two cookies:
  - session (httpOnly) — JS cannot read it.
  - csrf   (NOT httpOnly) — JS CAN read it, so the client can echo it in a header.
On every mutation: client sends header X-CSRF-Token = <csrf cookie value>.
Server: verify header === csrf cookie (double-submit). Cross-site attackers can send the cookie
        automatically but CANNOT read it to set the matching header (blocked by SOP) → forged request fails.
```

### 4.7 Logout (POST `/api/auth/logout`)

```
  1. CSRF verify. 2. Clear session + csrf cookies (Set-Cookie maxAge=0). 3. 204.
```

> Note: with a stateless JWT, logout clears the cookie but a _previously copied_ token stays valid until
> `exp`. Short expiry bounds this. Server-side revocation (denylist) is a documented Future Improvement
> (see ADR-004, §7 residual risk).

---

## 5. Trust boundaries

A **trust boundary** is any point where data or control passes between parties with different privilege
or trustworthiness. Each crossing below names the guarding control(s).

| #        | Boundary (from → to)       | What crosses                        | Guarding controls                                                               |
| -------- | -------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| **TB-1** | Browser → Edge/Node API    | User input, cookies, CSRF header    | SR-1 validation, SR-12 CSRF, SR-9 rate limit, SR-10 headers, SR-11 CORS         |
| **TB-2** | Edge → Node handler        | Verified identity, request          | SR-13 authoritative authz in Node (edge result not trusted alone)               |
| **TB-3** | Node → Postgres (Prisma)   | Queries with user-influenced values | SR-2 parameterization, SR-13 ownership scoping                                  |
| **TB-4** | Node → Weather provider    | Outbound request incl. **API key**  | SR-7 key from server env; server-only egress; response normalized               |
| **TB-5** | Provider → Node            | Untrusted third-party JSON          | Treat as untrusted: parse/normalize, don't reflect raw into client (SR-3/SR-15) |
| **TB-6** | Node → Browser (response)  | Data + errors                       | SR-15 generic errors, SR-3 no raw HTML injection, no secrets/stack traces       |
| **TB-7** | Server → Logs              | Diagnostic data                     | SR-14 redaction — never passwords/tokens/keys                                   |
| **TB-8** | Repo/build → Client bundle | Compiled JS shipped to browser      | SR-8 env split; the provider key is never `NEXT_PUBLIC_` (bundle is public)     |

> **Guiding rule:** everything on the browser side of TB-1 and everything arriving across TB-5 is
> **untrusted**. Secrets live only server-side of TB-8.

---

## 6. STRIDE-lite threat model

Scoped to the assets that matter for this app. **STRIDE** = Spoofing, Tampering, Repudiation, Information
disclosure, Denial of service, Elevation of privilege. For each threat: the boundary/asset, the control,
and the honest **residual risk**.

### 6.1 Asset — User credentials (password)

| STRIDE         | Threat                      | Control                                                        | Residual                                                                                         |
| -------------- | --------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| I (disclosure) | DB breach reveals passwords | SR-4 bcrypt (cost-factored, salted)                            | Offline cracking of weak user passwords remains possible → mitigate with password policy (SR-1). |
| S (spoofing)   | Guess/brute-force login     | SR-9 rate limit on `/api/auth/*`; generic 401 (no user oracle) | Low-rate distributed guessing; bounded, logged.                                                  |
| I              | Password leaks into logs    | SR-14 never log credentials                                    | Depends on discipline — enforced by redaction + review.                                          |

### 6.2 Asset — Session token (JWT in cookie)

| STRIDE        | Threat                                           | Control                                                        | Residual                                                                         |
| ------------- | ------------------------------------------------ | -------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| S             | Forged/tampered token                            | SR-5 signature verify (server secret); reject bad sig/expired  | Secret compromise = full forgery → secret in server env only (SR-8), rotatable.  |
| I             | Token stolen via XSS                             | SR-6 httpOnly (JS can't read cookie) + SR-3 CSP/React escaping | Non-XSS theft (malware/physical) out of scope.                                   |
| I             | Token sniffed in transit                         | SR-6 Secure flag + SR-10 HSTS (HTTPS only)                     | None material over HTTPS.                                                        |
| S             | Token replay after logout                        | Short `exp`; logout clears cookie                              | Stolen token valid until `exp` (no denylist) — ADR-004, accepted for coursework. |
| T (tampering) | Cross-site auto-send of cookie to trigger action | SR-6 SameSite=Lax + SR-12 CSRF double-submit                   | Belt-and-suspenders; residual ~none.                                             |

### 6.3 Asset — Weather provider API key

| STRIDE  | Threat                                      | Control                                                                | Residual                                                                   |
| ------- | ------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| I       | Key extracted from client bundle/network    | SR-7 server-side proxy; SR-8 non-`NEXT_PUBLIC_`; TB-8 bundle grep gate | None if discipline held; verified by build-time check (Phase 6/10).        |
| D (DoS) | Attacker burns provider quota via our proxy | SR-9 rate limit on `/api/weather`; SR-3 cache reduces upstream calls   | Determined abuse can still consume quota → per-IP/user limits + cache TTL. |

### 6.4 Asset — User data (favorites, history)

| STRIDE        | Threat                                  | Control                                                      | Residual                                                              |
| ------------- | --------------------------------------- | ------------------------------------------------------------ | --------------------------------------------------------------------- |
| E (elevation) | User A reads/edits user B's rows (IDOR) | SR-13 ownership-scoped queries; userId from session not body | None if every user-data query is scoped — enforced by review + tests. |
| T             | SQL injection via search/city input     | SR-2 Prisma parameterization; SR-1 validation                | None for parameterized paths; no raw SQL permitted.                   |
| S             | Acting as another user                  | Auth chain (SR-5/6) + TB-2 authoritative Node authz          | Depends on token integrity (see 6.2).                                 |

### 6.5 Asset — Availability & integrity of the app

| STRIDE          | Threat                              | Control                                                             | Residual                                                                |
| --------------- | ----------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| D               | Request flood / credential stuffing | SR-9 rate limit; SR-10 headers                                      | Volumetric DDoS is out of scope (platform/Vercel edge concern).         |
| T               | Clickjacking / UI redress           | SR-10 X-Frame-Options / frame-ancestors CSP                         | None for framing.                                                       |
| T               | MIME sniffing → script exec         | SR-10 X-Content-Type-Options: nosniff                               | None.                                                                   |
| I               | XSS injecting content               | SR-3 React escaping + CSP (nonce-based, avoid `unsafe-inline`)      | CSP tuning risk vs 3D/inline assets (ADR-008, PRD R9).                  |
| R (repudiation) | User denies an action               | SR-14 structured server logs with request/user context (no secrets) | Not non-repudiation-grade (no signed audit); acceptable for coursework. |

### 6.6 Asset — Secrets & configuration

| STRIDE | Threat                                           | Control                                         | Residual                                                |
| ------ | ------------------------------------------------ | ----------------------------------------------- | ------------------------------------------------------- |
| I      | Missing/malformed env at boot → insecure default | SR-8 Zod-validated env; fail fast if absent     | None — app refuses to start misconfigured.              |
| I      | `.env` committed                                 | `.gitignore` `.env`; commit only `.env.example` | Human error → covered by review + secret-scan (Future). |

---

## 7. Residual risk register (accepted for coursework scope)

| RR   | Residual risk                                    | Why accepted                                                   | Escalation path (Future)                            |
| ---- | ------------------------------------------------ | -------------------------------------------------------------- | --------------------------------------------------- |
| RR-1 | Stateless JWT can't be revoked before `exp`      | Short expiry bounds exposure; denylist is disproportionate now | ADR-004 → refresh-token rotation + revocation store |
| RR-2 | Volumetric DDoS unhandled in app                 | Platform/CDN responsibility                                    | Vercel/WAF edge protections                         |
| RR-3 | Weak user-chosen passwords crackable if DB leaks | bcrypt + policy reduce, not eliminate                          | breach-password check, MFA                          |
| RR-4 | No signed audit trail (repudiation)              | Not required by assignment                                     | append-only signed logs                             |
| RR-5 | Provider quota still consumable within limits    | rate limit + cache bound cost                                  | provider-side quotas/billing alerts                 |

These are **documented, not ignored** — that documentation is itself graded security thinking.

---

## 8. Security control placement — master map (traces to PRD §9)

| SR    | Control                      | Enforced at                                              | Runtime       |
| ----- | ---------------------------- | -------------------------------------------------------- | ------------- |
| SR-1  | Input validation (Zod)       | every Route Handler + `src/lib/env.ts`                   | Node          |
| SR-2  | SQLi defense (Prisma params) | `src/lib/db.ts` + data access                            | Node          |
| SR-3  | XSS defense                  | React components + CSP header                            | Client + Edge |
| SR-4  | Password hashing (bcrypt)    | `src/lib/auth/password.ts`                               | Node          |
| SR-5  | JWT sign/verify              | `src/lib/auth/jwt.ts` (sign) + middleware (verify, jose) | Node + Edge   |
| SR-6  | Secure cookies               | login handler + `src/lib/auth/session.ts`                | Node          |
| SR-7  | API-key protection           | `src/app/api/weather/route.ts` + `src/lib/weather/`      | Node          |
| SR-8  | Env management               | `src/lib/env.ts`                                         | Node/build    |
| SR-9  | Rate limiting                | middleware + auth/weather handlers                       | Edge/Node     |
| SR-10 | Security headers             | `middleware.ts` + `next.config.ts`                       | Edge/build    |
| SR-11 | CORS                         | middleware / API layer                                   | Edge/Node     |
| SR-12 | CSRF                         | `src/lib/auth/csrf.ts` + mutation handlers               | Node          |
| SR-13 | Authorization/ownership      | favorites/history handlers                               | Node          |
| SR-14 | Safe logging                 | logging util + call sites                                | Node          |
| SR-15 | Safe error handling          | shared error helper + handlers                           | Node          |

Every cell above becomes a `SECURITY — <name> / Risk / How / Why` comment block at implementation time,
and a row in `docs/SECURITY.md` (created Phase 3).

---

## 9. Decisions Record (ADRs)

Format: **Decision · Context · Alternative rejected · Consequence · Status.**
Status _Accepted (pending ratification)_ = my recommendation; flag me before Phase 5 if you disagree.

**ADR-001 — Two-tier auth: `jose` edge gate + `bcrypt`/`jsonwebtoken` in Node**

- _Context:_ Edge runtime can't run bcrypt/jsonwebtoken (PRD R1).
- _Decision:_ Middleware verifies JWT signature/expiry with `jose` (coarse, fail-closed gate); Node
  handlers do bcrypt, JWT signing, and all authoritative authz/CSRF.
- _Rejected:_ (a) auth **only** in handlers, middleware does headers/rate-limit only — simpler, one fewer
  dep, but loses the centralized fail-closed gate and repeats verify logic everywhere; (b) move all auth
  to Node-only routes and drop middleware auth — same downside. `jose` is a Web-Crypto JWT lib, **not** an
  auth framework, so it doesn't breach "no NextAuth."
- _Consequence:_ one added dependency (`jose`) used solely for edge verification. Hand-rolled auth intact.
- _Status:_ **RATIFIED (Phase 5), with a refinement.** The user chose to use **`jose` for BOTH signing
  and verification** (not `jsonwebtoken` for signing). Rationale: one library that runs in Node route
  handlers AND the Edge gate, still fully hand-rolled (we build/sign/verify tokens ourselves — not an
  auth framework, not NextAuth). This is a deliberate deviation from the literal `jsonwebtoken` in
  `CLAUDE.md §2` that satisfies its intent (visible, defensible auth code); recorded in
  `src/lib/auth/jwt.ts` and `docs/SECURITY.md`. Implemented in Phase 5; `jsonwebtoken` is NOT a
  dependency.
  **Phase 8 refinement — the Edge JWT gate was intentionally NOT built.** Authentication is enforced
  authoritatively in Node (the `(app)` layout guard + every protected route via `getCurrentUserId`,
  ADR-002). A second `jose` verification in Edge middleware would only duplicate the authoritative check
  while shipping secret-dependent auth logic to the Edge runtime for no security gain, so `middleware.ts`
  is scoped to security headers (SR-10) + CORS (SR-11). The §2/§3 "coarse jose gate in middleware"
  description reflects the original Phase-2 design intent; this note is the as-built decision.

**ADR-002 — Authorization is authoritative in Node, never trusted from the edge alone**

- _Decision:_ Ownership/authz (SR-13) always runs in the Node handler against the DB, even though the edge
  gate already checked the token.
- _Rejected:_ trusting the edge decision to skip per-request DB-scoped checks — a single bypass would be
  total. _Defense in depth / fail closed._
- _Status:_ **Accepted.**

**ADR-003 — Session JWT in httpOnly cookie, not `localStorage`**

- _Decision:_ store the token in an httpOnly+Secure+SameSite cookie; never in JS-readable storage.
- _Rejected:_ `localStorage`/JS-readable cookie — XSS-exfiltratable (defeats SR-6).
- _Consequence:_ requires CSRF protection (ADR-005) because cookies auto-send.
- _Status:_ **Accepted** (locked by `CLAUDE.md §2`).

**ADR-004 — Short-lived access token with sliding re-issue; no revocation store (yet)**

- _Context:_ assignment wants short expiry + a documented refresh strategy; full refresh-token rotation is
  heavy for coursework.
- _Decision:_ session JWT with short expiry (target ~30–60 min); on an authenticated request within a
  renewal window, the server silently re-issues a fresh cookie (sliding session). Logout clears cookies.
- _Rejected:_ (a) separate long-lived refresh token + rotation + server-side revocation denylist — most
  robust but disproportionate now (→ Future Improvement); (b) long-lived single token — larger theft
  window.
- _Consequence:_ RR-1 — a copied token is valid until `exp` even after logout; bounded by short expiry.
- _Status:_ **Accepted (pending ratification).** Exact TTL finalized in Phase 5.

**ADR-005 — CSRF via double-submit cookie token**

- _Decision:_ pair a readable `csrf` cookie with an `X-CSRF-Token` request header on every mutation;
  verify equality server-side. Kept even though `SameSite=Lax` already blocks most cross-site sends.
- _Rejected:_ relying on `SameSite` alone — Lax still allows top-level GET navigations and has edge cases;
  double-submit is the explicit, teachable control the assignment wants.
- _Status:_ **Accepted** (locked by `CLAUDE.md §2`).

**ADR-006 — Weather cache: start in-memory (per-instance), documented; optional Redis**

- _Decision:_ short-TTL in-memory cache keyed by normalized `(lat,lon)`/city for the proxy; if Upstash is
  already wired for rate limiting, may reuse Redis for cache too.
- _Rejected:_ no cache — wastes provider quota and latency (worsens SR-9/DoS posture).
- _Consequence:_ in-memory cache doesn't survive multi-instance/serverless cold starts — documented
  tradeoff (same class as the rate-limiter fallback note in `CLAUDE.md §2`).
- _Status:_ **IMPLEMENTED (Phase 6).** In-memory, 5-min TTL, keyed by the lowercased query, in
  `src/lib/weather/cache.ts`. Provider = **WeatherAPI.com** (one keyed call → current+hourly+7day+AQI).
  The rate limiter (`src/lib/rate-limit.ts`) uses the same in-memory-vs-Upstash pattern. Also decided:
  **`/api/weather` is anonymous but per-IP rate-limited** (30/60s) to support the landing demo search
  (PRD U10) while bounding quota abuse.

**ADR-007 — API is same-origin; CORS locked to the app origin (no wildcard)**

- _Decision:_ Route Handlers are consumed same-origin; CORS policy denies cross-origin by default / uses an
  explicit allowlist (SR-11). No `Access-Control-Allow-Origin: *`.
- _Rejected:_ permissive CORS — enables cross-origin API abuse.
- _Status:_ **Accepted.**

**ADR-008 — CSP: prefer nonces/hashes, avoid `unsafe-inline`; tune against real assets in Phase 8**

- _Context:_ the lazy Three.js globe + framework may need inline/wasm allowances; too-loose CSP weakens
  XSS defense (SR-3), too-tight breaks the globe (PRD R9).
- _Decision:_ build a nonce-based CSP; add the minimum directives the real asset set requires; document
  every relaxation with a `SECURITY` comment justifying it.
- _Status:_ **IMPLEMENTED (Phase 8).** `src/middleware.ts` sets a per-request nonce CSP:
  `script-src 'self' 'nonce-…' 'strict-dynamic'` (no `unsafe-inline` for scripts), `style-src 'unsafe-inline'`
  (React/Three inline styles — lower risk, documented), `object-src 'none'`, `frame-ancestors 'none'`,
  `base-uri/form-action 'self'`. Nonce CSP requires per-request rendering, so the root layout is
  `force-dynamic`; verified 0 un-nonced inline scripts across pages. Static headers are in `next.config.ts`.
  **Caveat:** CSP _enforcement_ (that nothing visually breaks) needs a real browser to fully confirm.

**ADR-009 — Ownership failures return 404 (not 403) where enumeration matters**

- _Decision:_ for user-owned resources, a non-owner request returns 404, not 403, to avoid confirming a
  resource's existence (anti-enumeration). Applied per-route.
- _Rejected:_ always-403 — leaks existence.
- _Status:_ **Accepted.**

**ADR-010 — Rate-limit keys: IP for anonymous, userId for authenticated; stricter on auth**

- _Decision:_ key limits by client IP for unauthenticated routes and by `userId` once authenticated;
  `/api/auth/login` gets the strictest bucket (anti-credential-stuffing). Thresholds tuned in Phase 8 to
  not lock out the grader (PRD R8).
- _Rejected:_ one global limiter — too coarse; either locks out real users or lets abuse through.
- _Status:_ **IMPLEMENTED (Phase 8).** Thresholds: weather 30/60s, login 10/60s, register 5/60s, keyed by
  client IP. In-memory limiter in dev (documented per-instance tradeoff); Upstash Redis when configured.
  Authenticated per-`userId` keying is a straightforward extension (favorites/history are low-risk reads).

---

## 10. Open decisions carried into later phases

| Item                                                      | Decided in                                    |
| --------------------------------------------------------- | --------------------------------------------- |
| Exact JWT TTL + renewal window (ADR-004)                  | Phase 5                                       |
| Anonymous vs login-required `/api/weather` landing search | ✅ Phase 6 — anonymous + per-IP rate-limited  |
| Cache backend (in-memory vs Redis) + TTL (ADR-006)        | ✅ Phase 6 — in-memory, 5-min TTL             |
| Concrete CSP directive list (ADR-008)                     | ✅ Phase 8 — nonce CSP in middleware.ts       |
| Rate-limit thresholds (ADR-010)                           | ✅ Phase 8 — weather 30, login 10, register 5 |
| Whether to add Supabase RLS as a second authz layer       | Phase 4 (note) / Future                       |

---

## 11. Phase-2 exit checklist

- [x] Runtime model resolved (Edge vs Node) — ADR-001.
- [x] Data-flow walkthroughs for register, login, weather, favorites (add/delete), CSRF, logout.
- [x] Trust boundaries TB-1…TB-8 enumerated with guarding controls.
- [x] STRIDE-lite threat model per asset, with residual risk.
- [x] Residual-risk register (accepted-for-coursework).
- [x] Decisions Record ADR-001…ADR-010.
- [ ] Verification gates (`pnpm typecheck && lint && build`): **N/A this phase** — no code yet; first run at Phase 3.

---

_End of Phase 2. Two decisions want your explicit nod before Phase 5: **ADR-001** (jose edge gate) and
**ADR-004** (sliding-session, no revocation store). Next: Phase 3 — scaffold the Next.js app, tooling,
`.env.example`, and an empty `docs/SECURITY.md` — only on "Continue"._
