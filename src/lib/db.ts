import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// SECURITY - SQL Injection Prevention (parameterized data access) [SR-2]
// Risk: User-controlled values (email at login/registration, city in search,
//       row ids in favorites/history) flow into database queries. If those
//       values were concatenated into raw SQL, an attacker could break out of
//       the intended query and read, modify, or destroy data (SQL injection).
// How:  ALL data access in this app goes through the Prisma Client query API
//       (prisma.user.findUnique, prisma.favorite.create, …). Prisma sends the
//       SQL text and the values as SEPARATE parameters to the database, so a
//       value can never be interpreted as SQL. We forbid $queryRawUnsafe /
//       $executeRawUnsafe and string-built SQL project-wide; the rare raw query,
//       if ever needed, must use the tagged `prisma.$queryRaw\`...\`` form which
//       is itself parameterized.
// Why:  Injection is the classic, high-impact web vulnerability. Centralizing
//       every query behind this one parameterized client makes the defense
//       uniform and auditable instead of hoping each call site escapes correctly.

// Prisma 7 uses the Query Compiler + a driver adapter (no bundled Rust engine).
// The pooled runtime connection (Supabase PgBouncer) is passed to the pg adapter.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  // Fail closed: never silently start with an unconfigured database. Full
  // Zod-based env validation (SR-8) centralizes this in Phase 5.
  throw new Error("DATABASE_URL is not set - refusing to start the database client.");
}

const adapter = new PrismaPg({ connectionString });

// Singleton: Next.js hot-reload (dev) re-imports modules, which would otherwise
// open a new connection pool on every reload and exhaust the database. Cache the
// client on globalThis in non-production so only one pool ever exists.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
