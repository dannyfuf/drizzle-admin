import { Hono } from 'hono'
import type { Context } from 'hono'
import type { ContentfulStatusCode } from 'hono/utils/http-status'
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

  // Login pages carry a fresh CSRF token and error details for one viewer
  // only — they must never land in a shared cache.
  async function renderLoginPage(c: Context, error?: string, status?: ContentfulStatusCode) {
    const csrfToken = await setCsrfCookie(c, config.sessionSecret)
    c.header('Cache-Control', 'no-store')
    return c.html(config.renderLogin({ error, csrfToken, basePath }), status)
  }

  app.get('/login', (c) => renderLoginPage(c))

  app.post('/login', async (c) => {
    const csrfValid = await validateCsrf(c, config.sessionSecret)
    if (!csrfValid) {
      return renderLoginPage(c, 'Invalid request. Please try again.')
    }

    // A body that fails to parse (e.g. multipart with no boundary) is a
    // validation failure, not a 500 from Hono's error boundary.
    let body: Record<string, string | File>
    try {
      body = await c.req.parseBody()
    } catch {
      return renderLoginPage(c, 'Invalid email or password.')
    }
    const email = readCredentialField(
      typeof body.email === 'string' ? body.email.trim() : body.email,
      EMAIL_MAX_LENGTH,
    )
    const password = readCredentialField(body.password, PASSWORD_MAX_LENGTH)

    if (email === null || password === null) {
      return renderLoginPage(c, 'Invalid email or password.')
    }

    // Being over-limit rejects *failed* attempts only. Credentials are still
    // verified so a correct password always gets in — otherwise unauthenticated
    // traffic could hold the counters over their limit and lock legitimate
    // admins out (a pre-auth denial of service). The cost is that over-limit
    // guesses still burn a bcrypt compare.
    const identifier = getClientIdentifier(c, trustProxyHeader)
    const limited = rateLimiter.isLimited(identifier, email)

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
      if (limited) {
        const retryAfterMs = rateLimiter.retryAfterMs?.(identifier, email) ?? 0
        if (retryAfterMs > 0) {
          c.header('Retry-After', String(Math.ceil(retryAfterMs / 1000)))
        }
        // Never reveal which key tripped.
        return renderLoginPage(c, 'Too many attempts, try again later.', 429)
      }
      return renderLoginPage(c, 'Invalid email or password.')
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

  // Logout is idempotent and a forced logout is only a nuisance, so POST
  // clears the session unconditionally instead of requiring a fresh CSRF
  // token. Requiring one silently left sessions alive on shared machines:
  // every page render rotates the `_csrf` cookie, so the token embedded in an
  // older tab (or a page revisited via Back) no longer matches and a "Sign
  // out" click would no-op without any error.
  app.post('/logout', (c) => {
    clearAuthCookie(c, basePath)
    return c.redirect(adminUrl(basePath, '/login'))
  })

  // Old bookmarks still resolve, but a cross-site GET (link, img, redirect)
  // can no longer force a logout: the session is left untouched.
  app.get('/logout', (c) => c.redirect(adminUrl(basePath, '/')))

  return app
}
