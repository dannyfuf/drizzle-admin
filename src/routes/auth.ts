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
    const email = body.email as string
    const password = body.password as string

    if (!email || !password) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Email and password are required.',
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
      config.sessionSecret
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
