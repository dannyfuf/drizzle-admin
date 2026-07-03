import { Hono } from 'hono'
import type { AdminBackend } from '@/backends/types.ts'
import { verifyPassword } from '@/auth/password.ts'
import { createToken } from '@/auth/jwt.ts'
import { setAuthCookie, clearAuthCookie } from '@/auth/middleware.ts'
import { setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { adminUrl } from '@/utils/url.ts'

interface AuthRoutesConfig<ActionDatabase = unknown, TableRef = unknown> {
  backend: AdminBackend<ActionDatabase, TableRef>
  adminUsers: TableRef
  sessionSecret: string
  basePath: string
  renderLogin: (props: { error?: string; csrfToken: string; basePath: string }) => string
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

    const admin = await config.backend.findAdminByEmail(config.adminUsers, email)

    if (!admin) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
        basePath,
      }))
    }

    const valid = await verifyPassword(password, admin.passwordHash as string)
    if (!valid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
        basePath,
      }))
    }

    const token = await createToken(
      { adminId: admin.id as number, email: admin.email as string },
      config.sessionSecret,
      'session'
    )
    setAuthCookie(c, token, basePath)

    return c.redirect(adminUrl(basePath, '/'))
  })

  app.all('/logout', (c) => {
    clearAuthCookie(c, basePath)
    return c.redirect(adminUrl(basePath, '/login'))
  })

  return app
}
