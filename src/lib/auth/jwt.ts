import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

// SECURITY - Integritas Token Sesi (JWT dengan Jose) [SR-5]
// Risk (Risiko): Jika token sesi bisa dipalsukan, peretas bisa login sebagai siapa saja. 
//                Jika token tidak memiliki masa kedaluwarsa, token curian bisa dipakai selamanya.
// How (Cara):    Token ditandatangani menggunakan algoritma HS256 dengan secret key yang panjang,
//                serta memiliki masa aktif (expiry) singkat yaitu 1 jam. Saat verifikasi, 
//                kita SECARA EKSPLISIT mengunci algoritma (pinning) ke 'HS256' agar menolak
//                token palsu dengan "alg: none" (Algorithm-Confusion attacks).
// Why (Alasan):  Tanda tangan digital membuktikan bahwa token dikeluarkan oleh server kita 
//                dan isinya belum diubah oleh klien. Pengecekan algoritma yang ketat 
//                mencegah celah manipulasi header JWT.

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
