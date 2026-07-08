# Database — Schema, Connections, Migrations & RLS Notes

> **Phase 4 deliverable** (`CLAUDE.md §6`). PostgreSQL (Supabase, Singapore) via **Prisma 7**.
> Complements `docs/PRD.md §12` (data model) and `docs/ARCHITECTURE.md §5–6` (trust boundaries, threats).

## 1. Data model (implemented)

Defined in [`prisma/schema.prisma`](../prisma/schema.prisma):

- **User** — `id` (cuid PK), `email` (unique, lowercased in app), `passwordHash` (bcrypt only), timestamps.
- **Favorite** — owned by `userId` (FK, cascade delete), `city`, `latitude`, `longitude`, `createdAt`;
  `@@unique([userId, latitude, longitude])`, `@@index([userId])`.
- **SearchHistory** — owned by `userId` (FK, cascade delete), `city`, optional coords, `createdAt`;
  `@@index([userId, createdAt])`.

Security-relevant modeling choices:

- `passwordHash` is the _only_ credential column — no plaintext password field exists (supports SR-4).
- `email @unique` blocks duplicate-account registration.
- Every user-owned table carries `userId`, the anchor for SR-13 ownership checks in the API layer, and it
  is indexed because every read is scoped `WHERE userId = <me>`.
- `onDelete: Cascade` guarantees no orphaned rows when an account is deleted.

## 2. Connection model (Prisma 7 + Supabase)

Prisma 7 uses the **Query Compiler + driver adapters** (no bundled Rust query engine at runtime). Two
connection paths, on purpose:

| Path                    | Env var        | Port (Supabase)  | Used by                                                                  |
| ----------------------- | -------------- | ---------------- | ------------------------------------------------------------------------ |
| **Runtime (pooled)**    | `DATABASE_URL` | 6543 (PgBouncer) | The app, via `@prisma/adapter-pg` in [`src/lib/db.ts`](../src/lib/db.ts) |
| **Migrations (direct)** | `DIRECT_URL`   | 5432 (direct)    | Prisma CLI, via [`prisma.config.ts`](../prisma.config.ts)                |

Why split: serverless functions open many short-lived connections; the PgBouncer **pooler** keeps Postgres
from exhausting connections at runtime. Migrations, however, run DDL that the transaction-mode pooler does
not support, so they use the **direct** connection. Locally the two URLs are identical.

The runtime client is a **singleton** (`src/lib/db.ts`) so Next.js hot-reload/serverless invocations don't
open a new pool each time.

## 3. Migration workflow

The initial migration is committed at
[`prisma/migrations/20260706000000_init/migration.sql`](../prisma/migrations/20260706000000_init/migration.sql).
It was generated **offline** from the schema (`prisma migrate diff --from-empty --to-schema … --script`)
because no live database was connected during Phase 4.

- **Regenerate the client:** `pnpm db:generate` (also runs automatically on `postinstall`).
- **Apply to a fresh dev DB:** set real `DATABASE_URL`/`DIRECT_URL` in `.env`, then `pnpm db:migrate`
  (`prisma migrate dev`) — this applies the committed migration and creates new ones as the schema evolves.
- **Apply in production/CI:** `pnpm db:deploy` (`prisma migrate deploy`) — applies committed migrations
  only, never generates.

> ⚠️ **Not yet applied to a real database.** Phase 4 delivers the schema, generated client, and migration
> SQL. Running it against Supabase requires live credentials and is done at first deploy (Phase 10) or by a
> developer with DB access.

## 4. Row-Level Security (RLS) — notes & decision

**Decision:** the **authoritative** authorization control (SR-13) is the **application layer** — every
query is scoped by the session's `userId` in the Route Handlers (Phases 5–7). This is the graded control
and the one demonstrated in code.

**Why not rely on Supabase RLS as the primary control here:**

- We connect through Prisma with a **single privileged database role** (the Supabase service/`postgres`
  role), not per-user JWT-authenticated Postgres roles. Supabase RLS derives `auth.uid()` from a
  **Supabase-issued** JWT; we deliberately hand-roll our own auth (`CLAUDE.md §2`) and do **not** use
  Supabase Auth, so `auth.uid()` is not populated. RLS policies keyed on it would not apply to our
  connection. Enforcing per-user isolation therefore _must_ happen in our code.

**RLS as documented defense-in-depth (Future Improvement):**

- Even with app-layer checks, enabling RLS with `FORCE ROW LEVEL SECURITY` and deny-by-default policies
  would add a second wall so that a bug in a query (a missing `WHERE userId=…`) cannot leak cross-user
  data. To use it meaningfully we'd need to pass the current user id to Postgres per request (e.g. via a
  `SET app.current_user_id` / `current_setting()` policy, or per-user roles). This is recorded as a
  hardening step, not implemented in the graded scope.
- Reference: `docs/ARCHITECTURE.md §7 RR` and PRD §19.

## 5. What to verify when a live DB is connected

- [ ] `pnpm db:deploy` applies `20260706000000_init` cleanly.
- [ ] Tables, unique constraints, indexes, and cascade FKs exist as in the migration SQL.
- [ ] App connects at runtime via the pooled `DATABASE_URL` (adapter) and can round-trip a query.
- [ ] (If RLS later enabled) cross-user access is denied at the DB even without the app-layer check.
