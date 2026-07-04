import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { createToken, verifyToken } from '@/auth/jwt.ts'

const CSRF_COOKIE_NAME = '_csrf'
const CSRF_FIELD_NAME = '_csrf'

export async function generateCsrfToken(secret: string): Promise<string> {
  // Without a random jti every CSRF token in a validity window would carry an
  // identical payload, making all of them interchangeable across forms/tabs.
  return createToken({ adminId: 0, email: 'csrf' }, secret, 'csrf', { jti: randomJti() })
}

function randomJti(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

export async function setCsrfCookie(
  c: Context,
  secret: string
): Promise<string> {
  const token = await generateCsrfToken(secret)
  setCookie(c, CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'Strict',
    maxAge: 60 * 60,
    path: '/',
  })
  return token
}

export async function validateCsrf(
  c: Context,
  secret: string
): Promise<boolean> {
  const cookieToken = getCookie(c, CSRF_COOKIE_NAME)
  const formToken = await getFormCsrfToken(c)

  if (!cookieToken || !formToken) return false
  if (cookieToken !== formToken) return false

  const payload = await verifyToken(cookieToken, secret, 'csrf')
  return payload !== null
}

async function getFormCsrfToken(c: Context): Promise<string | null> {
  // A malformed body (e.g. multipart/form-data with no boundary) makes
  // parseBody reject; that is a CSRF failure, not a 500.
  try {
    const body = await c.req.parseBody()
    const value = body[CSRF_FIELD_NAME]
    return typeof value === 'string' ? value : null
  } catch {
    return null
  }
}

export function csrfInput(token: string): string {
  return `<input type="hidden" name="${CSRF_FIELD_NAME}" value="${token}">`
}
