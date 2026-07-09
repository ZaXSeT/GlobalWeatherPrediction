import type { NextConfig } from "next";

// SECURITY - Static security response headers [SR-10]
// Risk: Without these headers a browser will happily frame the site (clickjacking),
//       MIME-sniff responses into executable types, leak full referrer URLs to third
//       parties, allow powerful browser features by default, and permit protocol
//       downgrade.
// How:  These headers are attached to every response via next.config `headers()`.
//       The Content-Security-Policy is set separately in middleware.ts because it
//       carries a per-request nonce (SR-3/SR-10).
// Why:  They are cheap, broad, defense-in-depth mitigations for whole classes of
//       browser-side attacks, applied uniformly to every route including static assets.
const securityHeaders = [
  // Force HTTPS for 2 years incl. subdomains (ignored by browsers over plain http/localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  // Legacy anti-clickjacking backup (CSP frame-ancestors 'none' is the primary control).
  { key: "X-Frame-Options", value: "DENY" },
  // Stop MIME sniffing (e.g. a text response being run as a script).
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Don't leak full URLs (which may hold query params) to other origins.
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Deny powerful features we don't use.
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
