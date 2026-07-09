import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";

// SECURITY - CSRF Double-Submit Token [SR-12]
// Risk (Risiko): Browser mengirimkan cookie (termasuk session token) secara otomatis
//                pada setiap request ke origin kita. Website peretas bisa membuat 
//                POST request tersembunyi ke API kita dan browser akan melampirkan 
//                sesi login user secara otomatis (Cross-Site Request Forgery).
// How (Cara):    Server menaruh token CSRF acak di dalam cookie. Client membaca 
//                cookie tersebut lalu mengirimkannya kembali di dalam header 
//                `x-csrf-token`. Server akan menolak aksi (POST/DELETE) jika isi 
//                header dan cookie tidak persis sama.
// Why (Alasan):  Website peretas tidak bisa membaca cookie kita karena terhalang 
//                oleh Same-Origin Policy dari browser, sehingga mereka tidak bisa 
//                menyalin isi cookie tersebut ke dalam header yang diwajibkan.

export const CSRF_COOKIE = "csrf";
export const CSRF_HEADER = "x-csrf-token";

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/** Set (overwrite) the readable CSRF cookie. Note: httpOnly is intentionally false. */
export function setCsrfCookie(res: NextResponse, token: string): void {
  res.cookies.set(CSRF_COOKIE, token, {
    httpOnly: false, // MUST be readable by client JS so it can echo it in the header.
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

/** Ensure a CSRF cookie exists (bootstrap for anonymous login/register). Returns the token. */
export async function ensureCsrfCookie(res: NextResponse): Promise<string> {
  const store = await cookies();
  const existing = store.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  return token;
}

/** True only if the request carries a CSRF header matching the CSRF cookie. */
export async function verifyCsrf(req: Request): Promise<boolean> {
  const store = await cookies();
  const cookieToken = store.get(CSRF_COOKIE)?.value;
  const headerToken = req.headers.get(CSRF_HEADER);
  if (!cookieToken || !headerToken) return false;

  const a = Buffer.from(cookieToken);
  const b = Buffer.from(headerToken);
  // Length check first: timingSafeEqual throws on length mismatch.
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
