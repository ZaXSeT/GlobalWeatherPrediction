import bcrypt from "bcrypt";

// SECURITY - Hashing Password (bcrypt) [SR-4]
// Risk (Risiko): Jika tabel user di database sewaktu-waktu bocor/terekspos, password 
//                dalam bentuk teks asli (plaintext) akan membuat hacker bisa menguasai 
//                semua akun, bahkan akun di layanan lain (jika user memakai password yang sama).
// How (Cara):    Password di-hash menggunakan algoritma `bcrypt` dengan tingkat kesulitan (cost) 12. 
//                Bcrypt membuat 'garam' (salt) acak untuk setiap hash dan sengaja dibuat lambat. 
//                Kita HANYA menyimpan hasil hash-nya saja di database.
// Why (Alasan):  Algoritma hash yang lambat dan memiliki salt membuat serangan tebak-paksa 
//                (brute-force) dan rainbow-table menjadi tidak praktis, meskipun database kita bocor.

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// A valid bcrypt hash of a value no user can have. Used to equalize timing when an
// account does not exist (see verifyPasswordConstantTime). Computed once at import.
const DUMMY_HASH = bcrypt.hashSync("password-that-cannot-be-entered\x00", SALT_ROUNDS);

// SECURITY - Penyetaraan Waktu Login / Anti-Enumeration [SR-15]
// Risk (Risiko): Jika kita tidak melakukan verifikasi bcrypt ketika email tidak ditemukan, 
//                respon "user tidak ditemukan" akan jauh lebih cepat dibanding "password salah", 
//                sehingga hacker bisa menebak email siapa saja yang terdaftar di aplikasi ini.
// How (Cara):    Fungsi ini akan SELALU menjalankan satu proses `bcrypt.compare` - 
//                melawan hash asli jika user ada, atau melawan DUMMY_HASH jika user tidak ada.
// Why (Alasan):  Waktu respon server yang selalu sama (konstan) menghilangkan celah 
//                bocoran informasi (timing oracle), mencegah attacker mencari tahu email terdaftar.
export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null,
): Promise<boolean> {
  const target = hash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(plain, target);
  return hash !== null && matches;
}
