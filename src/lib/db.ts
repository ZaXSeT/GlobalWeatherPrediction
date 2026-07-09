import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// SECURITY - Pencegahan SQL Injection (Akses data terparameterisasi) [SR-2]
// Risk (Risiko): Nilai yang diinput user (email saat login, kota saat pencarian) mengalir
//                langsung ke query database. Jika nilai tersebut digabungkan menjadi
//                SQL mentah, hacker bisa meretas query tersebut untuk membaca,
//                mengubah, atau menghapus data (SQL Injection).
// How (Cara):    SEMUA akses data di aplikasi ini melewati API query Prisma Client.
//                Prisma mengirimkan teks SQL dan nilai input sebagai parameter
//                yang TERPISAH ke database, sehingga input user tidak akan pernah
//                bisa dieksekusi sebagai perintah SQL.
// Why (Alasan):  Injeksi adalah celah keamanan web klasik yang paling berbahaya.
//                Memusatkan semua query di balik satu ORM terparameterisasi ini
//                membuat pertahanan kita seragam dan mudah diaudit.

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
