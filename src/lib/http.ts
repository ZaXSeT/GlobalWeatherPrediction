import { NextResponse } from "next/server";

// SECURITY - Generic client-facing error responses [SR-15]
// Risk: Detailed errors or stack traces leak implementation details (DB schema,
//       library versions, whether an account exists) that help an attacker map
//       and target the system.
// How:  Client responses carry only a short, generic message; the real detail is
//       logged server-side (SR-14), never returned. Auth failures deliberately use
//       identical messages regardless of the underlying cause.
// Why:  Denies attackers a feedback/oracle channel while preserving full
//       diagnosability in server logs.

/** Standard error response: `{ error: <generic message> }` with a status code. */
export function jsonError(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

/** Standard success response. Pass a number for a status, or a full ResponseInit. */
export function jsonOk<T>(data: T, init?: number | ResponseInit): NextResponse {
  const responseInit = typeof init === "number" ? { status: init } : init;
  return NextResponse.json(data, responseInit);
}
