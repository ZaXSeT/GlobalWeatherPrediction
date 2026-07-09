import { NextResponse, type NextRequest } from "next/server";

// This middleware runs on the Edge runtime for every (non-static) request. It does
// two security jobs: a same-origin lockdown for the API (SR-11) and a per-request
// nonce-based Content-Security-Policy (SR-10 / SR-3). Auth is enforced authoritatively
// in Node (the (app) layout guard + each route handler, ADR-002), so no JWT logic here.

// SECURITY - Content-Security-Policy (nonce-based) [SR-10 / SR-3]
// Risk: XSS - if an attacker injects a <script>, it runs with the app's privileges.
//       React escaping (SR-3) stops reflected/stored HTML injection, but CSP is the
//       backstop that neutralizes injected scripts even if escaping is ever bypassed.
// How:  Each request gets a fresh random nonce. Only scripts carrying that nonce (and,
//       via 'strict-dynamic', scripts they load) may execute - inline injected scripts
//       have no nonce and are blocked. object/base/frame-ancestors are locked down too.
//       The nonce is passed to Next via the request header so Next stamps it on its
//       own scripts.
// Why:  Defense-in-depth: even a successful HTML-injection can't achieve script
//       execution, which is what turns XSS from noise into account compromise.
function buildCsp(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  // Dev/HMR needs eval + inline; production is strict (nonce + strict-dynamic).
  const scriptSrc = isProd
    ? `'self' 'nonce-${nonce}' 'strict-dynamic'`
    : `'self' 'unsafe-eval' 'unsafe-inline'`;

  return [
    `default-src 'self'`,
    `script-src ${scriptSrc}`,
    // React/Three set inline styles; style injection is far lower risk than script.
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    `worker-src 'self' blob:`,
    ...(isProd ? [`upgrade-insecure-requests`] : []),
  ].join("; ");
}

export function middleware(req: NextRequest) {
  // SECURITY - Same-origin API lockdown (CORS) [SR-11]
  // Risk: A malicious website could try to call our JSON API from the user's browser
  //       to abuse authenticated endpoints or scrape data cross-origin.
  // How:  For /api requests that carry an Origin header, we require that origin's host
  //       to equal this request's Host. A cross-origin Origin is rejected with 403.
  //       (We never emit a permissive Access-Control-Allow-Origin: * .)
  // Why:  This enforces the same-origin policy server-side - defense-in-depth alongside
  //       CSRF - instead of trusting the browser's CORS enforcement alone.
  if (req.nextUrl.pathname.startsWith("/api")) {
    const origin = req.headers.get("origin");
    if (origin) {
      let originHost = "";
      try {
        originHost = new URL(origin).host;
      } catch {
        originHost = "invalid";
      }
      if (originHost !== req.headers.get("host")) {
        return NextResponse.json({ error: "Cross-origin request blocked." }, { status: 403 });
      }
    }
  }

  // Fresh nonce per request (Web Crypto is available on the Edge runtime).
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce);

  // Pass the nonce + CSP to Next via request headers so Next applies the nonce to its
  // own inline scripts; also set the CSP on the outgoing response.
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  // Run on all routes except Next's static assets / image optimizer / favicon.
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico).*)",
    },
  ],
};
