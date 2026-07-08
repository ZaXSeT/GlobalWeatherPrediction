// Prisma 7 configuration (replaces datasource `url` in schema.prisma).
// `import "dotenv/config"` loads .env because Prisma 7 does NOT auto-load env files.
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // The CLI (migrate/db pull) uses a DIRECT connection. On Supabase, migrations
    // must NOT go through the PgBouncer pooler (port 6543) — they need the direct
    // connection (port 5432). Runtime queries use the pooled DATABASE_URL via the
    // driver adapter in src/lib/db.ts instead. Locally the two are the same.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
