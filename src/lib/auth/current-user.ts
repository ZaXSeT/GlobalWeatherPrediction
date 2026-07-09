import { getSessionToken } from "@/lib/auth/session";
import { verifySession } from "@/lib/auth/jwt";

// Authoritative identity resolution for protected server code (Node route handlers
// and the (app) layout guard). Returns the user id from a VALID session token, or
// null. This is the Node-side authoritative auth check (ADR-002): even once an Edge
// middleware gate exists, protected routes must re-establish identity here and must
// never trust a client-supplied user id.
//
// No DB round-trip: the id is the signed `sub` claim, already integrity-checked by
// verifySession (SR-5). Callers that need the user record query the DB with this id.
export async function getCurrentUserId(): Promise<string | null> {
  const token = await getSessionToken();
  if (!token) return null;
  const payload = await verifySession(token);
  return payload?.userId ?? null;
}
