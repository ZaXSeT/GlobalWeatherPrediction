import { z } from "zod";

// SECURITY - Validasi Input di Batas Kepercayaan Autentikasi [SR-1]
// Risk (Risiko): Membiarkan request tanpa validasi masuk ke sistem akan membuat data cacat, 
//                terlalu besar, atau salah tipe membebani proses hashing, database, dan cookie - 
//                yang berpotensi membuka celah abuse dan injeksi.
// How (Cara):    Skema Zod (Zod schemas) memeriksa setiap isi (body) dari request autentikasi. 
//                Apapun yang tidak sesuai (email salah, password kependekan/terlalu panjang) 
//                akan langsung ditolak dengan status 400 sebelum nilai tersebut diproses. 
//                Batas maksimal password (72 byte) disamakan dengan batas input bcrypt 
//                agar password tidak pernah terpotong secara diam-diam.
// Why (Alasan):  Menolak input buruk di pintu depan adalah garis pertahanan pertama 
//                dan termurah untuk mencegah masalah di proses-proses selanjutnya.

// bcrypt hanya memproses 72 byte pertama dari input; kita beri batasan eksplisit di sini.
const PASSWORD_MAX = 72;

export const registerSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8, "Password must be at least 8 characters").max(PASSWORD_MAX),
});

export const loginSchema = z.object({
  // Login does not enforce the min-length policy - it must not hint at password rules.
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(PASSWORD_MAX),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
