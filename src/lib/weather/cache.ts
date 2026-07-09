// Short-TTL in-memory cache for weather lookups (ADR-006).
//
// Purpose: cut latency and, more importantly, reduce calls to the rate-limited
// third-party provider - which also blunts a DoS that tries to burn our quota.
//
// DOCUMENTED TRADEOFF: this Map lives in a single server instance's memory, so it
// does NOT share entries across serverless instances or survive a restart. That is
// acceptable for coursework; the production upgrade is a shared cache (e.g. Redis),
// same class of tradeoff as the rate-limiter fallback (CLAUDE.md §2).

interface Entry<T> {
  value: T;
  expiresAt: number;
}

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() >= entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}
