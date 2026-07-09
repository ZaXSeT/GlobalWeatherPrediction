import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

// SECURITY - Rate limiting [SR-9]
// Risk: Without throttling, an attacker can brute-force logins / stuff credentials,
//       and hammer the weather proxy to exhaust our third-party quota (a cheap DoS).
// How:  Each caller (keyed by client IP, or user id once authenticated) gets a bounded
//       number of requests per time window. When configured, this uses Upstash Redis
//       (shared across instances); otherwise it falls back to an in-memory limiter.
// Why:  Bounding request rate is the standard defense against brute force and
//       quota-exhaustion abuse, and it protects both our endpoints and our provider bill.

export interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number; // epoch ms when the window resets
}

// --- Upstash (production) path -------------------------------------------------
// Used only when BOTH Upstash vars are set. In local dev they are intentionally
// unset (see .env), so the in-memory fallback below runs instead.
const redis =
  env.UPSTASH_REDIS_REST_URL && env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({ url: env.UPSTASH_REDIS_REST_URL, token: env.UPSTASH_REDIS_REST_TOKEN })
    : null;

const limiterCache = new Map<string, Ratelimit>();
function upstashLimiter(limit: number, windowSeconds: number): Ratelimit {
  const cacheKey = `${limit}:${windowSeconds}`;
  let limiter = limiterCache.get(cacheKey);
  if (!limiter) {
    limiter = new Ratelimit({
      redis: redis!,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: "rl",
    });
    limiterCache.set(cacheKey, limiter);
  }
  return limiter;
}

// --- In-memory (fallback) path -------------------------------------------------
// Fixed-window counter per key. TRADEOFF: per-instance only - will not enforce a
// shared limit across multiple serverless instances (documented, CLAUDE.md §2).
const buckets = new Map<string, { count: number; resetAt: number }>();
function memoryLimit(key: string, limit: number, windowSeconds: number): RateLimitResult {
  const now = Date.now();
  const windowMs = windowSeconds * 1000;
  let bucket = buckets.get(key);
  if (!bucket || now >= bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  return {
    success: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    reset: bucket.resetAt,
  };
}

/** Consume one unit from `key`'s bucket. `windowSeconds` is the window length. */
export async function checkRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  if (redis) {
    const r = await upstashLimiter(limit, windowSeconds).limit(key);
    return { success: r.success, remaining: r.remaining, reset: r.reset };
  }
  return memoryLimit(key, limit, windowSeconds);
}
