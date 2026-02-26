import type { Context } from 'hono'
import { getCookie, setCookie } from 'hono/cookie'
import { createToken, verifyToken } from './jwt.js'

const CSRF_COOKIE_NAME = '_csrf'
const CSRF_FIELD_NAME = '_csrf'

export async function generateCsrfToken(secret: string): Promise<string> {
  return createToken({ adminId: 0, email: 'csrf' }, secret)
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

  const payload = await verifyToken(cookieToken, secret)
  return payload !== null
}

async function getFormCsrfToken(c: Context): Promise<string | null> {
  const body = await c.req.parseBody()
  return (body[CSRF_FIELD_NAME] as string) ?? null
}

export function csrfInput(token: string): string {
  return `<input type="hidden" name="${CSRF_FIELD_NAME}" value="${token}">`
}
