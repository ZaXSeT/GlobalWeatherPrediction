export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { verifyCsrf } from "@/lib/auth/csrf";
import { favoriteSchema } from "@/lib/validation/favorites";
import { jsonError, jsonOk } from "@/lib/http";

// SECURITY - Per-resource authorization / ownership (anti-IDOR) [SR-13]
// Risk: Without scoping every query to the logged-in user, a user could read or
//       delete another user's favorites by guessing/altering ids (Insecure Direct
//       Object Reference).
// How:  The user id comes ONLY from the verified session (getCurrentUserId), never
//       from the request body or a client field. Every read is filtered
//       `where: { userId }`, and creates set `userId` from the session. Deletes
//       (see [id]/route.ts) use deleteMany({ id, userId }) so a non-owner affects 0
//       rows.
// Why:  This makes cross-user access structurally impossible at the data layer -
//       the authoritative check, defense-in-depth with the Edge gate (ADR-002).

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Authentication required.", 401);

  const favorites = await prisma.favorite.findMany({
    where: { userId }, // SR-13: only THIS user's rows
    orderBy: { createdAt: "desc" },
    select: { id: true, city: true, latitude: true, longitude: true, createdAt: true },
  });
  return jsonOk({ favorites });
}

export async function POST(req: Request) {
  if (!(await verifyCsrf(req))) return jsonError("Invalid or missing CSRF token.", 403);

  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Authentication required.", 401);

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return jsonError("Invalid request body.", 400);
  }
  const parsed = favoriteSchema.safeParse(raw);
  if (!parsed.success) return jsonError("Invalid favorite data.", 400);

  try {
    const favorite = await prisma.favorite.create({
      // SR-13: userId is bound from the session, NOT from client input.
      data: { userId, ...parsed.data },
      select: { id: true, city: true, latitude: true, longitude: true, createdAt: true },
    });
    return jsonOk({ favorite }, 201);
  } catch {
    // Most likely the @@unique(userId, latitude, longitude) constraint: already saved.
    return jsonError("That location is already in your favorites.", 409);
  }
}
