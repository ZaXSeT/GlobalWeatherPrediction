import { z } from "zod";

// SECURITY — Input validation at the auth trust boundary [SR-1]
// Risk: Unvalidated request bodies let malformed, oversized, or wrong-type data
//       reach password hashing, the database, and cookies — enabling abuse and
//       injection attempts.
// How:  Zod schemas parse every auth request body; anything not matching (bad
//       email, too-short or oversized password) is rejected with a generic 400
//       before the value is used. The 72-byte password cap matches bcrypt's input
//       limit so passwords are never silently truncated.
// Why:  Rejecting bad input at the boundary is the first, cheapest line of defense
//       and a precondition for every downstream control.

// bcrypt only considers the first 72 bytes of input; cap here to make that explicit.
const PASSWORD_MAX = 72;

export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(PASSWORD_MAX),
});

export const loginSchema = z.object({
  // Login does not enforce the min-length policy — it must not hint at password rules.
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
