import { Hono } from 'hono'
import type { AdminBackend } from '@/backends/types.ts'
import { dummyPasswordCompare, verifyPassword } from '@/auth/password.ts'
import { createToken } from '@/auth/jwt.ts'
import { setAuthCookie, clearAuthCookie } from '@/auth/middleware.ts'
import { setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { createInMemoryLoginRateLimiter, getClientIdentifier, type LoginRateLimiter } from '@/auth/rate-limit.ts'
import { adminUrl } from '@/utils/url.ts'

interface AuthRoutesConfig<ActionDatabase = unknown, TableRef = unknown> {
  backend: AdminBackend<ActionDatabase, TableRef>
  adminUsers: TableRef
  sessionSecret: string
  basePath: string
  renderLogin: (props: { error?: string; csrfToken: string; basePath: string }) => string
  /** Failure throttle for the login form. Defaults to the in-memory single-process limiter. */
  rateLimiter?: LoginRateLimiter
  /** Trust `x-forwarded-for` for the rate-limit client identifier. Default: `false`. */
  trustProxyHeader?: boolean
}

// RFC 5321 caps addresses at 254 octets; the password cap bounds CPU spent on
// oversized input (bcrypt only reads the first 72 bytes anyway).
const EMAIL_MAX_LENGTH = 254
const PASSWORD_MAX_LENGTH = 256

/**
 * Narrows a parseBody value to a plain, non-empty, bounded string. Hono's
 * parseBody can yield arrays (duplicate fields) or File objects (multipart
 * uploads); both must be rejected — not coerced — before any DB or bcrypt work.
 */
export function readCredentialField(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') return null
  if (value.length === 0 || value.length > maxLength) return null
  return value
}

export function createAuthRoutes<ActionDatabase = unknown, TableRef = unknown>(config: AuthRoutesConfig<ActionDatabase, TableRef>): Hono {
  const { basePath } = config
  const rateLimiter = config.rateLimiter ?? createInMemoryLoginRateLimiter()
  const trustProxyHeader = config.trustProxyHeader ?? false
  const app = new Hono()

  app.get('/login', async (c) => {
    const csrfToken = await setCsrfCookie(c, config.sessionSecret)
    const html = config.renderLogin({ csrfToken, basePath })
    return c.html(html)
  })

  app.post('/login', async (c) => {
    const csrfValid = await validateCsrf(c, config.sessionSecret)
    if (!csrfValid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid request. Please try again.',
        csrfToken,
        basePath,
      }))
    }

    const body = await c.req.parseBody()
    const email = readCredentialField(
      typeof body.email === 'string' ? body.email.trim() : body.email,
      EMAIL_MAX_LENGTH,
    )
    const password = readCredentialField(body.password, PASSWORD_MAX_LENGTH)

    if (email === null || password === null) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
        basePath,
      }))
    }

    // Short-circuit before any DB or bcrypt work; never reveal which key tripped.
    const identifier = getClientIdentifier(c, trustProxyHeader)
    if (rateLimiter.isLimited(identifier, email)) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Too many attempts, try again later.',
        csrfToken,
        basePath,
      }), 429)
    }

    const admin = await config.backend.findAdminByEmail(config.adminUsers, email)

    // Unknown email, broken stored hash, and wrong password must all cost
    // exactly one bcrypt compare and share one response, so neither timing nor
    // content reveals whether the email exists.
    const storedHash = admin && typeof admin.passwordHash === 'string' && admin.passwordHash.length > 0
      ? admin.passwordHash
      : null
    const valid = storedHash !== null
      ? await verifyPassword(password, storedHash)
      : await dummyPasswordCompare(password)

    if (!admin || !valid) {
      rateLimiter.recordFailure(identifier, email)
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
        basePath,
      }))
    }

    rateLimiter.recordSuccess(email)

    const token = await createToken(
      { adminId: admin.id as number, email: admin.email as string },
      config.sessionSecret,
      'session'
    )
    setAuthCookie(c, token, basePath)

    return c.redirect(adminUrl(basePath, '/'))
  })

  app.post('/logout', async (c) => {
    const csrfValid = await validateCsrf(c, config.sessionSecret)
    if (!csrfValid) {
      return c.redirect(adminUrl(basePath, '/'))
    }
    clearAuthCookie(c, basePath)
    return c.redirect(adminUrl(basePath, '/login'))
  })

  // Old bookmarks still resolve, but a cross-site GET (link, img, redirect)
  // can no longer force a logout: the session is left untouched.
  app.get('/logout', (c) => c.redirect(adminUrl(basePath, '/')))

  return app
}
