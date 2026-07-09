export const runtime = "nodejs";
// Reads cookies → always dynamic; never cache an auth-state response.
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getSessionToken, setSessionCookie } from "@/lib/auth/session";
import { signSession, verifySession } from "@/lib/auth/jwt";
import { ensureCsrfCookie } from "@/lib/auth/csrf";
import { jsonOk } from "@/lib/http";

// GET /api/auth/me - returns the current user (or null) and doubles as the CSRF
// bootstrap: it guarantees an anonymous client has a CSRF cookie so it can then
// submit /login or /register.
export async function GET() {
  const token = await getSessionToken();

  let user: { id: string; email: string; createdAt: Date } | null = null;
  let refreshedToken: string | null = null;

  if (token) {
    const payload = await verifySession(token); // SR-5: signature + expiry check
    if (payload) {
      const found = await prisma.user.findUnique({
        where: { id: payload.userId },
        // Data minimization: the passwordHash is never selected into a response.
        select: { id: true, email: true, createdAt: true },
      });
      if (found) {
        user = found;
        // ADR-004 sliding session: re-issue a fresh token on activity so an active
        // user stays logged in while the absolute token TTL stays short.
        refreshedToken = await signSession(found.id);
      }
    }
  }

  const res = jsonOk({ authenticated: user !== null, user });
  if (refreshedToken) setSessionCookie(res, refreshedToken); // SR-6
  await ensureCsrfCookie(res); // SR-12 bootstrap
  return res;
}
