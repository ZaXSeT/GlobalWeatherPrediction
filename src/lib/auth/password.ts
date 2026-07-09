import bcrypt from "bcrypt";

// SECURITY - Password hashing (bcrypt) [SR-4]
// Risk: If the user table is ever exposed, plaintext or weakly-hashed passwords
//       would hand an attacker every account - and, via password reuse, accounts
//       on other services too.
// How:  Passwords are hashed with bcrypt at cost factor 12. bcrypt generates a
//       per-hash random salt (stored inside the hash string) and is deliberately
//       slow. We persist only the hash; verification uses bcrypt.compare.
// Why:  A slow, salted hash makes offline brute-force and precomputed
//       (rainbow-table) attacks impractical even if the database leaks. Cost 12 is
//       a common balance between attacker cost and login latency.

const SALT_ROUNDS = 12;

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

// A valid bcrypt hash of a value no user can have. Used to equalize timing when an
// account does not exist (see verifyPasswordConstantTime). Computed once at import.
const DUMMY_HASH = bcrypt.hashSync("password-that-cannot-be-entered\x00", SALT_ROUNDS);

// SECURITY - Login timing equalization / anti-enumeration [SR-15 · supports SR-4]
// Risk: If we skipped the bcrypt comparison when the email is unknown, "no such
//       user" would respond measurably faster than "wrong password", letting an
//       attacker enumerate which emails are registered.
// How:  This always runs one bcrypt.compare - against the real hash when the user
//       exists, or against DUMMY_HASH when it does not - then returns false unless
//       the user existed AND the password matched.
// Why:  Constant-ish response time removes the account-existence timing oracle
//       from the login endpoint.
export async function verifyPasswordConstantTime(
  plain: string,
  hash: string | null,
): Promise<boolean> {
  const target = hash ?? DUMMY_HASH;
  const matches = await bcrypt.compare(plain, target);
  return hash !== null && matches;
}
