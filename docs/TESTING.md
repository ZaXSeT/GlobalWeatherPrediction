# Testing — Strategy, Automated Suite & Manual Security Checklist

> **Phase 9 deliverable** (`CLAUDE.md §6`). Proportional to a coursework app (`CLAUDE.md §9`): a focused
> automated suite over the security-critical code, plus a manual checklist for the flows that need a live
> database, a real weather key, or a browser.

## 1. How to run

```bash
pnpm test          # run the suite once (vitest run)
pnpm test:watch    # watch mode
```

- **Runner:** Vitest 4 (`vitest.config.ts`), Node environment, `@` → `src` alias mirrored from tsconfig.
- **Env:** `tests/setup.ts` sets dummy test env vars before any module loads, so the env-validating
  modules (`src/lib/env.ts`) import cleanly. Upstash is intentionally unset → the in-memory rate limiter
  is exercised.
- Test files live in `tests/` (excluded from the Next build / `tsc` app typecheck; Vitest transpiles them).

## 2. Automated coverage (28 tests, 6 files)

**Unit — security primitives:**

| File                            | Covers          | Key assertions                                                                       |
| ------------------------------- | --------------- | ------------------------------------------------------------------------------------ |
| `tests/unit/password.test.ts`   | bcrypt (SR-4)   | `$2b$12$` cost; correct→true, wrong→false, absent-user→false                         |
| `tests/unit/jwt.test.ts`        | JWT/jose (SR-5) | round-trip; **tampered / garbage / expired / alg:none / wrong-secret → null**        |
| `tests/unit/validation.test.ts` | Zod (SR-1)      | bad email, short & >72-byte passwords, missing coords, out-of-range lat all rejected |
| `tests/unit/rate-limit.test.ts` | limiter (SR-9)  | allows N then blocks; keys independent                                               |

**Integration — route handlers (no DB / no network):**

| File                                        | Covers                         | Key assertions                                                                           |
| ------------------------------------------- | ------------------------------ | ---------------------------------------------------------------------------------------- |
| `tests/integration/weather.route.test.ts`   | `/api/weather` (SR-1/SR-15)    | bad query → 400; error body is a generic string                                          |
| `tests/integration/favorites.route.test.ts` | `/api/favorites` (SR-13/SR-12) | unauth GET → 401; POST without CSRF → 403 (next/headers mocked with an empty cookie jar) |

> Why not more integration coverage: the happy-path (create/read/delete real rows, login issuing a
> session) requires a live Postgres, and live weather requires a real key. Those are covered by the manual
> checklist below rather than by mocking the entire data layer, which would test the mocks more than the app.

## 3. Manual security checklist (`CLAUDE.md §8`)

Already verified during build (see `docs/SECURITY.md` → Verification log; run against `next start`):

- [x] Missing/mismatched CSRF token on a mutation → 403 (login/register/logout/favorites).
- [x] `alg:none` / tampered / expired JWT rejected.
- [x] Weather API key **absent from the production client bundle** (`.next/static` grep).
- [x] Weather provider error → generic 502; server log has no URL/key.
- [x] Per-IP rate limits enforced (weather 30/60s, login 10/60s).
- [x] Cross-origin `Origin` on `/api` → 403 (SR-11).
- [x] All security headers present; nonce CSP applied with 0 un-nonced inline scripts.
- [x] Unauthenticated `/dashboard` → 307 redirect to `/login`; unauth API → 401.

Still to do with a **live database + real weather key** (and a browser):

- [ ] Register → login → session cookie set (httpOnly/Secure/SameSite) → authenticated `/me` → logout clears it.
- [ ] Wrong password returns an identical response to an unknown email (no enumeration) — with real rows.
- [ ] **IDOR:** as user A, attempt to `DELETE /api/favorites/<user B's id>` → **404**, and B's row still exists.
- [ ] Search a real city → normalized current/hourly/7-day/AQI renders; it is saved to favorites & history.
- [ ] **Browser:** confirm the nonce CSP does not block hydration or the 3D globe (curl proves the nonce is
      applied, but only a browser enforces CSP).
- [ ] Apply the Prisma migration to Supabase (`pnpm db:deploy`) and confirm schema + constraints.

## 4. Known environment issue

`pnpm dev` (Turbopack) currently crashes on page routes in this sandboxed Windows environment
(`STATUS_DLL_INIT_FAILED`, see `docs/SECURITY.md`). All checks above were run against `pnpm build` +
`pnpm start`, which are unaffected. Verify `pnpm dev` on the target dev machine.
