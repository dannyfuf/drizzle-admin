import { Hono } from 'hono'
import { eq } from 'drizzle-orm'
import { verifyPassword } from '@/auth/password.ts'
import { createToken } from '@/auth/jwt.ts'
import { setAuthCookie, clearAuthCookie } from '@/auth/middleware.ts'
import { setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { adminUrl } from '@/utils/url.ts'

import type { Table } from 'drizzle-orm'
import type { PgColumn, PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'

type PgTableWithColumns = PgTable<TableConfig> & Record<string, PgColumn>

interface AuthRoutesConfig {
  db: AnyPgDatabase
  adminUsers: Table
  sessionSecret: string
  basePath: string
  renderLogin: (props: { error?: string; csrfToken: string }) => string
}

export function createAuthRoutes(config: AuthRoutesConfig): Hono {
  const { basePath } = config
  const app = new Hono()
  const adminUsers = config.adminUsers as PgTableWithColumns

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

    const [row] = await config.db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1)

    const admin = row as Record<string, unknown> | undefined

    if (!admin) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
      }))
    }

    const valid = await verifyPassword(password, admin.passwordHash as string)
    if (!valid) {
      const csrfToken = await setCsrfCookie(c, config.sessionSecret)
      return c.html(config.renderLogin({
        error: 'Invalid email or password.',
        csrfToken,
      }))
    }

    const token = await createToken(
      { adminId: admin.id as number, email: admin.email as string },
      config.sessionSecret
    )
    setAuthCookie(c, token)

    return c.redirect(adminUrl(basePath, '/'))
  })

  app.all('/logout', (c) => {
    clearAuthCookie(c)
    return c.redirect(adminUrl(basePath, '/login'))
  })

  return app
}
