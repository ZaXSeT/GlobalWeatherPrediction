// Node runtime: bcrypt is a native module and cannot run on the Edge runtime.
export const runtime = "nodejs";

import { prisma } from "@/lib/db";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { verifyCsrf } from "@/lib/auth/csrf";
import { jsonError, jsonOk } from "@/lib/http";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/net";

const REGISTER_LIMIT = 5;
const REGISTER_WINDOW_SECONDS = 60;

export async function POST(req: Request) {
  // SR-9: rate limit account creation per IP (bounds automated mass-signup abuse).
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`auth:register:${ip}`, REGISTER_LIMIT, REGISTER_WINDOW_SECONDS);
  if (!rl.success) {
    return jsonError("Too many attempts. Please try again shortly.", 429);
  }

  // SR-12: reject state-changing requests lacking a valid CSRF double-submit token.
  if (!(await verifyCsrf(req))) {
    return jsonError("Invalid or missing CSRF token.", 403);
  }

  // SR-1: parse & validate the body before it touches anything else.
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) {
    return jsonError("Invalid email or password.", 400);
  }
  const email = parsed.data.email.toLowerCase(); // case-fold for the @unique constraint
  const { password } = parsed.data;

  // Reject duplicate accounts.
  // DOCUMENTED TRADEOFF: returning 409 reveals that the email is registered
  // (user-enumeration). Registration UIs conventionally need to tell a user their
  // email is taken; the residual risk is bounded by rate limiting (SR-9, Phase 8).
  // Login, by contrast, never reveals account existence.
  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) {
    return jsonError("An account with that email already exists.", 409);
  }

  // SR-4: persist only the bcrypt hash — never the plaintext password.
  const passwordHash = await hashPassword(password);
  await prisma.user.create({ data: { email, passwordHash } });

  // No auto-login; the client proceeds to /login. Generic 201 body.
  return jsonOk({ ok: true }, 201);
}
