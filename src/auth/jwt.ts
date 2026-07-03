import { SignJWT, jwtVerify, JWTPayload } from 'jose'

const TOKEN_EXPIRY = '24h'
const ALGORITHM = 'HS256'

/**
 * Distinguishes what a token may be used for. Session and CSRF tokens are both
 * HS256 JWTs signed with the same secret, so the type is carried in the `aud`
 * claim and verified on every check to stop one from being replayed as the other.
 */
export type TokenType = 'session' | 'csrf'

export interface AdminTokenPayload extends JWTPayload {
  adminId: number
  email: string
}

export async function createToken(
  payload: { adminId: number; email: string },
  secret: string,
  type: TokenType
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setAudience(type)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey)
}

export async function verifyToken(
  token: string,
  secret: string,
  expectedType: TokenType
): Promise<AdminTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, secretKey, {
      algorithms: [ALGORITHM],
      audience: expectedType,
    })
    return payload as AdminTokenPayload
  } catch {
    return null
  }
}
