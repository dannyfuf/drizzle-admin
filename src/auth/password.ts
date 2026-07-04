import bcrypt from "bcryptjs";

const SALT_ROUNDS = 12;

/**
 * Hashes a plaintext password using bcrypt with 12 salt rounds.
 *
 * @param password - The plaintext password to hash.
 * @returns The bcrypt hash string.
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verifies a plaintext password against a bcrypt hash.
 *
 * @param password - The plaintext password to check.
 * @param hash - The bcrypt hash to compare against.
 * @returns `true` if the password matches the hash.
 */
export async function verifyPassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Pre-generated 12-round hash of a discarded random value; no input can match it.
const DUMMY_HASH = "$2a$12$OEaomAAOeWzTNFbUlb5nBOrXzARn6YSYo3TbdcnluN7NkGPE0DRqO";

/**
 * Burns one bcrypt compare and always fails. Used on login when there is no
 * usable stored hash (unknown email, or a null/empty `passwordHash` row) so
 * that branch costs the same as a real comparison and response timing cannot
 * reveal whether an email exists.
 *
 * Timing uniformity assumes stored hashes use cost 12, like `hashPassword`
 * and `seed()` produce. Hashes imported from another system at a different
 * cost (commonly 10) make the real-compare branch measurably faster or slower
 * than this dummy, reopening the enumeration oracle — rehash imported
 * credentials at cost 12 to keep the guarantee.
 */
export async function dummyPasswordCompare(password: string): Promise<false> {
  await bcrypt.compare(password, DUMMY_HASH);
  return false;
}
