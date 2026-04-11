import { Hono } from 'hono'
import { eq, getTableColumns } from 'drizzle-orm'
import { verifyPassword } from '@/auth/password.ts'
import { createToken } from '@/auth/jwt.ts'
import { setAuthCookie, clearAuthCookie } from '@/auth/middleware.ts'
import { setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { adminUrl } from '@/utils/url.ts'

import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'

interface AuthRoutesConfig {
  db: AnyPgDatabase
  adminUsers: PgTable
  sessionSecret: string
  basePath: string
  renderLogin: (props: { error?: string; csrfToken: string; basePath: string }) => string
}

export function createAuthRoutes(config: AuthRoutesConfig): Hono {
  const { basePath } = config
  const app = new Hono()
  const adminTable = config.adminUsers
  const cols = getTableColumns(config.adminUsers)

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

    const [row] = await config.db
      .select()
      .from(adminTable)
      .where(eq(cols.email!, email))
      .limit(1)

    const admin = row as Record<string, unknown> | undefined

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
