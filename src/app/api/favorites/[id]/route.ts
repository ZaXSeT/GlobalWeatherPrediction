export const runtime = "nodejs";

import { prisma } from "@/lib/db";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { verifyCsrf } from "@/lib/auth/csrf";
import { jsonError } from "@/lib/http";
import { NextResponse } from "next/server";

// SECURITY - Ownership-scoped delete (anti-IDOR) [SR-13]
// Risk: A user could delete another user's favorite by putting someone else's row
//       id in the URL.
// How:  We delete with deleteMany({ where: { id, userId } }) where userId is the
//       SESSION user. If the row belongs to someone else (or doesn't exist), 0 rows
//       match and we return 404 - which also avoids confirming whether the id exists
//       for another account (ADR-009).
// Why:  Binding the delete to the owner makes cross-user deletion impossible at the
//       data layer.

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  if (!(await verifyCsrf(_req))) return jsonError("Invalid or missing CSRF token.", 403);

  const userId = await getCurrentUserId();
  if (!userId) return jsonError("Authentication required.", 401);

  const { id } = await ctx.params;

  const result = await prisma.favorite.deleteMany({
    where: { id, userId }, // SR-13: scoped to the owner
  });
  if (result.count === 0) {
    return jsonError("Favorite not found.", 404);
  }
  return new NextResponse(null, { status: 204 });
}
