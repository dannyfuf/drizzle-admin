import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '../auth/password.js'
import { createToken } from '../auth/jwt.js'
import { setAuthCookie, clearAuthCookie } from '../auth/middleware.js'
import { setCsrfCookie, validateCsrf } from '../auth/csrf.js'

interface AuthRoutesConfig {
  db: any
  adminUsers: any
  sessionSecret: string
  renderLogin: (props: { error?: string; csrfToken: string }) => string
}

export function createAuthRoutes(config: AuthRoutesConfig): Hono {
  const app = new Hono()

  app.get('/login', async (c) => {
    const csrfToken = await setCsrfCookie(c, config.sessionSecret)
    const html = config.renderLogin({ csrfToken })
    return c.html(html)
  })

  app.post('/login', async (c) => {
    const csrfValid = await validateCsrf(c, config.sessionSecret)
    if (!csrfValid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid request. Please try again.',
        csrfToken,
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
      }))
    }

    const [admin] = await config.db
      .select()
      .from(config.adminUsers)
      .where(eq(config.adminUsers.email, email))
      .limit(1)

    if (!admin) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
      }))
    }

    const valid = await verifyPassword(password, admin.passwordHash)
    if (!valid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
      }))
    }

    const token = await createToken(
      { adminId: admin.id, email: admin.email },
      config.sessionSecret
    )
    setAuthCookie(c, token)

    return c.redirect('/')
  })

  app.all('/logout', (c) => {
    clearAuthCookie(c)
    return c.redirect('/login')
  })

  return app
}
