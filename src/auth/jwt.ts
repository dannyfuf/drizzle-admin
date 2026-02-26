import { SignJWT, jwtVerify, JWTPayload } from 'jose'

const TOKEN_EXPIRY = '24h'
const ALGORITHM = 'HS256'

export interface AdminTokenPayload extends JWTPayload {
  adminId: number
  email: string
}

export async function createToken(
  payload: { adminId: number; email: string },
  secret: string
): Promise<string> {
  const secretKey = new TextEncoder().encode(secret)

  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALGORITHM })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(secretKey)
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<AdminTokenPayload | null> {
  try {
    const secretKey = new TextEncoder().encode(secret)
    const { payload } = await jwtVerify(token, secretKey)
    return payload as AdminTokenPayload
  } catch {
    return null
  }
}
