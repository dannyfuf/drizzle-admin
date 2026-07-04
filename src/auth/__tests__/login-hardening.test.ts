/**
 * Login-surface threat checklist. Each test is one attack the hardening pass
 * (plans/login-surface-hardening-2026-07-03-plan.md) closed, exercised
 * end-to-end against the real auth routes and middleware.
 *
 * Related focused coverage:
 * - CSRF-token-as-session replay: src/auth/__tests__/middleware.test.ts
 * - Body validation and throttling details: src/auth/__tests__/login-routes.test.ts
 * - Limiter windows/reset: src/auth/__tests__/rate-limit.test.ts
 */
import { describe, it, expect, vi } from 'vitest'
import { Hono } from 'hono'
import { SignJWT } from 'jose'
import bcrypt from 'bcryptjs'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'
import type { AdminBackend, BackendRecord } from '@/backends/types.ts'
import { createAuthRoutes } from '@/routes/auth.ts'
import { authMiddleware } from '@/auth/middleware.ts'
import { generateCsrfToken } from '@/auth/csrf.ts'
import { verifyToken } from '@/auth/jwt.ts'
import { loginPage } from '@/views/login.ts'

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns ?? {},
  getTableName: () => 'admin_users',
  eq: () => {},
  and: () => ({}),
  ilike: () => ({}),
  sql: (strings: TemplateStringsArray) => strings.join(''),
}))

import { DrizzleAdmin } from '@/DrizzleAdmin.ts'

const SECRET = 'login-hardening-checklist-secret-32ch!'

function makeApp(options: { admin?: BackendRecord } = {}) {
  const backend = {
    findAdminByEmail: vi.fn(async () => options.admin ?? undefined),
  } as unknown as AdminBackend

  const app = new Hono()
  app.route('/', createAuthRoutes({
    backend,
    adminUsers: {},
    sessionSecret: SECRET,
    basePath: '',
    renderLogin: (props) => loginPage(props),
    rateLimiter: undefined,
  }))
  app.use('/*', authMiddleware(SECRET, ''))
  app.get('/protected', (c) => c.text('admin-only'))
  return app
}

async function getCsrf(app: Hono): Promise<{ cookie: string; token: string }> {
  const res = await app.request('/login')
  const token = (res.headers.get('set-cookie') ?? '').match(/_csrf=([^;]+)/)?.[1]
  if (!token) throw new Error('login page did not set a CSRF cookie')
  return { cookie: `_csrf=${token}`, token }
}

describe('login-surface hardening checklist', () => {
  it('rejects a CSRF token replayed as a session cookie', async () => {
    const csrfToken = await generateCsrfToken(SECRET)
    const res = await makeApp().request('/protected', {
      headers: { Cookie: `admin_session=${csrfToken}` },
      redirect: 'manual',
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login')
  })

  it('rejects validly-signed tokens with a missing or wrong audience', async () => {
    const secretKey = new TextEncoder().encode(SECRET)
    const noAud = await new SignJWT({ adminId: 1, email: 'admin@test.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secretKey)
    const wrongAud = await new SignJWT({ adminId: 1, email: 'admin@test.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setAudience('something-else')
      .setExpirationTime('24h')
      .sign(secretKey)

    expect(await verifyToken(noAud, SECRET, 'session')).toBeNull()
    expect(await verifyToken(wrongAud, SECRET, 'session')).toBeNull()

    for (const token of [noAud, wrongAud]) {
      const res = await makeApp().request('/protected', {
        headers: { Cookie: `admin_session=${token}` },
        redirect: 'manual',
      })
      expect(res.status).toBe(302)
      expect(res.headers.get('Location')).toBe('/login')
    }
  })

  it('answers sustained credential guessing with 429', async () => {
    const app = makeApp()
    let finalStatus = 0
    for (let i = 0; i < 11; i++) {
      const { cookie, token } = await getCsrf(app)
      const res = await app.request('/login', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _csrf: token, email: 'victim@test.com', password: `guess-${i}` }).toString(),
      })
      finalStatus = res.status
    }
    expect(finalStatus).toBe(429)
  })

  it('makes unknown and known emails indistinguishable on failed login', async () => {
    const normalize = (html: string) => html.replace(/name="_csrf" value="[^"]*"/g, 'name="_csrf" value=""')
    const passwordHash = await bcrypt.hash('real-password', 4)

    const post = async (app: Hono, email: string) => {
      const { cookie, token } = await getCsrf(app)
      return app.request('/login', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _csrf: token, email, password: 'a-wrong-guess' }).toString(),
      })
    }

    const unknownRes = await post(makeApp(), 'nobody@test.com')
    const knownRes = await post(
      makeApp({ admin: { id: 1, email: 'admin@test.com', passwordHash } }),
      'admin@test.com',
    )

    expect(unknownRes.status).toBe(knownRes.status)
    expect(normalize(await unknownRes.text())).toBe(normalize(await knownRes.text()))
  })

  it('does not let sustained bad guesses lock the real admin out', async () => {
    const passwordHash = await bcrypt.hash('real-password', 4)
    const app = makeApp({ admin: { id: 1, email: 'admin@test.com', passwordHash } })

    // An attacker trips the per-email failure budget…
    for (let i = 0; i < 11; i++) {
      const { cookie, token } = await getCsrf(app)
      await app.request('/login', {
        method: 'POST',
        headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ _csrf: token, email: 'admin@test.com', password: `guess-${i}` }).toString(),
      })
    }

    // …but the admin still gets in with the correct password.
    const { cookie, token } = await getCsrf(app)
    const res = await app.request('/login', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: token, email: 'admin@test.com', password: 'real-password' }).toString(),
      redirect: 'manual',
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toContain('admin_session=')
  })

  it('clears the session on POST /logout even with a stale CSRF token', async () => {
    // Every page render rotates the _csrf cookie, so a second tab's embedded
    // token is routinely stale; "Sign out" must still end the session.
    const app = makeApp()
    const res = await app.request('/logout', {
      method: 'POST',
      headers: {
        Cookie: 'admin_session=whatever',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ _csrf: 'stale-token-from-an-old-render' }).toString(),
      redirect: 'manual',
    })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login')
    const setCookieHeader = res.headers.get('set-cookie') ?? ''
    expect(setCookieHeader).toContain('admin_session=')
    expect(setCookieHeader).toContain('Max-Age=0')
  })

  it('ignores GET /logout as a forced-logout vector', async () => {
    const app = makeApp()
    const res = await app.request('/logout', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/')
    expect(res.headers.get('set-cookie')).toBeNull()
  })

  it('refuses to construct with a weak sessionSecret', () => {
    const adminUsers = {
      _columns: { id: {}, email: {}, passwordHash: {}, createdAt: {}, updatedAt: {} },
    }
    expect(() => new DrizzleAdmin({
      db: {} as AnyPgDatabase,
      dialect: 'postgresql',
      adminUsers: adminUsers as unknown as PgTable,
      sessionSecret: 'weak',
      resourcesDir: './resources',
    })).toThrow('sessionSecret must be a string of at least 32 characters')
  })
})
