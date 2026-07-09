export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { verifyCsrf } from "@/lib/auth/csrf";
import { clearSessionCookie } from "@/lib/auth/session";
import { jsonError } from "@/lib/http";

export async function POST(req: Request) {
  // SR-12: even logout is state-changing; require the CSRF token so a third party
  // can't forcibly log the user out.
  if (!(await verifyCsrf(req))) {
    return jsonError("Invalid or missing CSRF token.", 403);
  }

  const res = new NextResponse(null, { status: 204 });
  clearSessionCookie(res); // SR-6: expire the session cookie immediately.
  return res;
}
