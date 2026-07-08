import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

// SECURITY — Session token integrity (signed JWT via jose) [SR-5]
// Risk: A forged or tampered session token would let an attacker impersonate any
//       user; a token that never expires would remain usable forever if stolen.
// How:  Tokens are signed with HS256 over the >=32-char server secret and carry a
//       short (1h) expiry. Verification PINS the algorithm to HS256 — rejecting
//       "alg: none" and RS/HS algorithm-confusion attacks — and rejects expired or
//       otherwise invalid tokens.
// Why:  The signature proves the token was issued by us and is untampered; the
//       short expiry bounds the damage window of a leaked token. jose is used
//       (not jsonwebtoken) because it runs in BOTH the Node route handlers and the
//       Edge middleware gate while remaining fully hand-rolled — no auth framework.
//       (Deviation from CLAUDE.md §2's literal `jsonwebtoken`, ratified in ADR-001.)

const secret = new TextEncoder().encode(env.JWT_SECRET);
const ALG = "HS256";

// Access-token lifetime (ADR-004). Kept short; /me re-issues on activity (sliding).
export const SESSION_TTL_SECONDS = 60 * 60; // 1 hour

/** Sign a session token whose subject (`sub`) is the user id. */
export async function signSession(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: ALG })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secret);
}

/** Verify a token; returns the user id on success, or null on any failure. */
export async function verifySession(token: string): Promise<{ userId: string } | null> {
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: [ALG] });
    const sub = payload.sub;
    if (typeof sub !== "string" || sub.length === 0) return null;
    return { userId: sub };
  } catch {
    // Any verification error (bad signature, expired, malformed) → treat as no session.
    return null;
  }
}
