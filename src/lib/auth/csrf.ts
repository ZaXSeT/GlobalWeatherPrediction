import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// SECURITY — CSRF protection (double-submit cookie token) [SR-12]
// Risk: Because the session lives in a cookie the browser sends automatically, a
//       malicious third-party site could trigger authenticated, state-changing
//       requests on the user's behalf (Cross-Site Request Forgery).
// How:  A random token is stored in a NON-httpOnly `csrf` cookie AND must be echoed
//       by the client in the X-CSRF-Token header on every mutation. The server
//       compares the two in constant time. A cross-site attacker can cause the
//       cookie to be auto-sent, but the Same-Origin Policy stops them from READING
//       it to set the matching header — so the comparison fails and the request is
//       rejected.
// Why:  This ties every mutation to a value only same-origin script can read,
//       defeating forged requests without keeping server-side session state.

export const CSRF_COOKIE = "csrf";
export const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Set (overwrite) the readable CSRF cookie. Note: httpOnly is intentionally false. */
export function setCsrfCookie(res: NextResponse, token: string): void {
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // MUST be readable by client JS so it can echo it in the header.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** Ensure a CSRF cookie exists (bootstrap for anonymous login/register). Returns the token. */
export async function ensureCsrfCookie(res: NextResponse): Promise<string> {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  return token;
}

/** True only if the request carries a CSRF header matching the CSRF cookie. */
export async function verifyCsrf(req: Request): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  // Length check first: timingSafeEqual throws on length mismatch.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
