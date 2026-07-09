// Best-effort client IP extraction for rate-limit keys.
// Behind Vercel/most proxies the real client IP is the first entry of
// X-Forwarded-For. This is a rate-limit key, not an authorization decision, so
// best-effort is acceptable - spoofing it only lets an attacker throttle themselves.
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
