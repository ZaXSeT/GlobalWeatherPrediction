export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { verifyCsrf } from "@/lib/auth/csrf";
import { historySchema } from "@/lib/validation/favorites";
import { jsonError, jsonOk } from "@/lib/http";

const HISTORY_LIMIT = 20;

// SECURITY - Per-resource authorization / ownership (anti-IDOR) [SR-13]
// Risk: Search history is personal; without per-user scoping a user could read
//       another user's history.
// How:  userId comes only from the verified session; reads are `where: { userId }`
//       and writes bind userId from the session (never from the body).
// Why:  Structural per-user isolation at the data layer (see also SR-13 in
//       src/app/api/favorites/route.ts).

export async function GET() {
  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Authentication required.", 401);

  const history = await prisma.searchHistory.findMany({
    where: { userId }, // SR-13
    orderBy: { createdAt: "desc" },
    take: HISTORY_LIMIT,
    select: { id: true, city: true, latitude: true, longitude: true, createdAt: true },
  });
  return jsonOk({ history });
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
  const parsed = historySchema.safeParse(raw);
  if (!parsed.success) return jsonError("Invalid history data.", 400);

  const entry = await prisma.searchHistory.create({
    data: { userId, ...parsed.data }, // SR-13: userId from session
    select: { id: true, city: true, createdAt: true },
  });
  return jsonOk({ entry }, 201);
}
