// Node runtime: bcrypt is a native module and cannot run on the Edge runtime.
export const runtime = "nodejs";

import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPasswordConstantTime } from "@/lib/auth/password";
import { signSession } from "@/lib/auth/jwt";
import { setSessionCookie } from "@/lib/auth/session";
import { verifyCsrf, setCsrfCookie, generateCsrfToken } from "@/lib/auth/csrf";
import { jsonError, jsonOk } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/net";
import { logger } from "@/lib/log";

// Stricter than the weather limit: this is the credential-stuffing / brute-force target.
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_SECONDS = 60;

export async function POST(req: Request) {
  // SR-9: rate limit FIRST so every attempt counts (even ones missing a CSRF token),
  // bounding brute-force / credential-stuffing against the login endpoint.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`auth:login:${ip}`, LOGIN_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!rl.success) {
    return jsonError("Too many attempts. Please try again shortly.", 429);
  }

  // SR-12: CSRF double-submit check before any credential handling.
  if (!(await verifyCsrf(req))) {
    return jsonError("Invalid or missing CSRF token.", 403);
  }

  // SR-1: validate shape before use.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid email or password.", 400);
  }
  const email = parsed.data.email.toLowerCase();
  const { password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, passwordHash: true },
    });

    // Anti-enumeration: identical generic 401 whether the email is unknown or the
    // password is wrong, and verifyPasswordConstantTime ALWAYS runs a bcrypt compare
    // (against a dummy hash when the user is absent) so timing doesn't differ. [SR-15]
    const ok = await verifyPasswordConstantTime(password, user?.passwordHash ?? null);
    if (!user || !ok) {
      return jsonError("Invalid email or password.", 401);
    }

    // SR-5: issue a signed session token; SR-6: deliver it in a hardened cookie.
    const token = await signSession(user.id);
    const res = jsonOk({ user: { id: user.id, email: user.email } }, 200);
    setSessionCookie(res, token);
    // Rotate the CSRF token on privilege change (login) to avoid token fixation.
    setCsrfCookie(res, generateCsrfToken());
    return res;
  } catch (err) {
    // SR-14/SR-15: log detail server-side (no credentials in scope here), return generic.
    logger.error("login_failed", { message: err instanceof Error ? err.message : String(err) });
    return jsonError("Something went wrong. Please try again.", 500);
  }
}
