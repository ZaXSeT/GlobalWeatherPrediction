import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import { SESSION_TTL_SECONDS } from "@/lib/auth/jwt";

// SECURITY — Secure session cookie [SR-6]
// Risk: A session token kept in a JS-readable store (localStorage or a
//       non-httpOnly cookie) can be stolen by any XSS; sent over plain HTTP it can
//       be sniffed; auto-sent cross-site it enables CSRF.
// How:  The token lives in a cookie flagged httpOnly (JS cannot read it), Secure in
//       production (sent only over HTTPS), SameSite=Lax (not attached to
//       cross-site subrequests), Path=/, with maxAge matching the token's TTL.
// Why:  These flags remove the three easiest ways to steal or abuse the session
//       and pair with the CSRF control (SR-12) for state-changing requests.

export const SESSION_COOKIE = "session";

function baseCookieOptions() {
  return {
    httpOnly: true,
    // Secure would stop the cookie from being set over http://localhost in dev.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };
}

export function setSessionCookie(res: NextResponse, token: string): void {
  res.cookies.set(SESSION_COOKIE, token, { ...baseCookieOptions(), maxAge: SESSION_TTL_SECONDS });
}

export function clearSessionCookie(res: NextResponse): void {
  // maxAge 0 expires the cookie immediately.
  res.cookies.set(SESSION_COOKIE, "", { ...baseCookieOptions(), maxAge: 0 });
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}
