import { z } from "zod";

// SECURITY — Environment validation & secret handling [SR-8]
// Risk: Missing or malformed configuration — an absent DATABASE_URL, a weak/short
//       JWT secret, or a secret accidentally shipped under a NEXT_PUBLIC_ name —
//       can make the app boot in an insecure state or leak secrets into the
//       browser bundle.
// How:  Every server-side env var is parsed once, at import, through this Zod
//       schema; the process throws and refuses to start if anything is missing or
//       invalid (e.g. JWT_SECRET shorter than 32 chars). Secrets are deliberately
//       NOT prefixed NEXT_PUBLIC_, so Next.js never inlines them into client code.
// Why:  Fail-fast on bad config converts a silent, latent vulnerability into an
//       immediate, obvious boot error, and gives us one audited place where
//       secrets are read.

const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),

  // Database (see docs/DATABASE.md). DIRECT_URL is only needed by the migration CLI.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  DIRECT_URL: z.string().min(1).optional(),

  // Session signing secret (SR-5). 32 chars ≈ 256 bits of key material for HS256.
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),

  // Public site URL — safe to expose; used for absolute URLs / CORS allowlist (SR-11).
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Weather provider key (SR-7). Required: it is read server-side only and must
  // never carry a NEXT_PUBLIC_ prefix (which would inline it into the browser bundle).
  WEATHER_API_KEY: z.string().min(1, "WEATHER_API_KEY is required"),

  // Rate-limiting backend (SR-9). Optional: code falls back to an in-memory limiter.
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

const parsed = serverSchema.safeParse(process.env);

if (!parsed.success) {
  // Surface WHICH vars are wrong (names only — never values, to avoid logging secrets).
  const problems = parsed.error.issues
    .map((issue) => `  - ${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
  console.error(`Invalid environment configuration:\n${problems}`);
  throw new Error("Invalid environment configuration — see .env.example.");
}

export const env = parsed.data;
