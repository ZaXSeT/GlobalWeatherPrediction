// SECURITY — CSRF token propagation from the browser [SR-12, client half]
// Risk: State-changing requests must carry the CSRF token, or the server (correctly)
//       rejects them; getting this wrong client-side breaks every mutation.
// How:  We read the readable `csrf` cookie and echo it in the X-CSRF-Token header on
//       every mutating request. If the cookie is missing we first call GET
//       /api/auth/me, which sets it (the bootstrap). All requests use same-origin
//       credentials so the httpOnly session cookie is sent automatically — and note
//       we NEVER read the session cookie from JS (it's httpOnly, SR-6).
// Why:  This is the browser half of the double-submit CSRF defense whose server half
//       lives in src/lib/auth/csrf.ts.

export interface ApiResponse<T> {
  ok: boolean;
  status: number;
  data: T | null;
}

export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(?:^|; )" + name + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfToken(): Promise<string | null> {
  let token = readCookie("csrf");
  if (!token) {
    await fetch("/api/auth/me", { credentials: "same-origin" });
    token = readCookie("csrf");
  }
  return token;
}

async function parseJson<T>(res: Response): Promise<T | null> {
  return res.headers.get("content-type")?.includes("application/json")
    ? ((await res.json()) as T)
    : null;
}

export async function apiGet<T>(path: string): Promise<ApiResponse<T>> {
  const res = await fetch(path, { credentials: "same-origin" });
  return { ok: res.ok, status: res.status, data: await parseJson<T>(res) };
}

export async function apiMutate<T>(
  path: string,
  method: "POST" | "PUT" | "DELETE",
  body?: unknown,
): Promise<ApiResponse<T>> {
  const csrf = await ensureCsrfToken();
  const res = await fetch(path, {
    method,
    credentials: "same-origin",
    headers: {
      "content-type": "application/json",
      ...(csrf ? { "x-csrf-token": csrf } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: await parseJson<T>(res) };
}
