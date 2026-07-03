import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from '@/auth/middleware.ts'
import { generateCsrfToken } from '@/auth/csrf.ts'
import { createToken } from '@/auth/jwt.ts'

const SECRET = 'test-secret-at-least-32-chars-long!'

function makeProtectedApp() {
  const app = new Hono()
  app.use('*', authMiddleware(SECRET))
  app.get('/protected', (c) => c.text('secret-data'))
  return app
}

describe('authMiddleware token-type separation', () => {
  // Regression for the auth bypass: a CSRF token is a validly-signed JWT minted
  // with the same secret, but it is typed `csrf`, so it must NOT authenticate.
  it('rejects a CSRF token presented as an admin_session cookie', async () => {
    const csrfToken = await generateCsrfToken(SECRET)

    const res = await makeProtectedApp().request('/protected', {
      headers: { Cookie: `admin_session=${csrfToken}` },
      redirect: 'manual',
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe('/login')
  })

  it('clears the admin_session cookie when it is not a session token', async () => {
    const csrfToken = await generateCsrfToken(SECRET)

    const res = await makeProtectedApp().request('/protected', {
      headers: { Cookie: `admin_session=${csrfToken}` },
      redirect: 'manual',
    })

    const setCookieHeader = res.headers.get('set-cookie') ?? ''
    expect(setCookieHeader).toContain('admin_session=')
    expect(setCookieHeader).toContain('Max-Age=0')
  })

  it('clears the rejected cookie at the basePath, matching where it was set', async () => {
    const csrfToken = await generateCsrfToken(SECRET)

    const app = new Hono()
    app.use('*', authMiddleware(SECRET, '/admin'))
    app.get('/protected', (c) => c.text('secret-data'))

    const res = await app.request('/protected', {
      headers: { Cookie: `admin_session=${csrfToken}` },
      redirect: 'manual',
    })

    const setCookieHeader = res.headers.get('set-cookie') ?? ''
    expect(setCookieHeader).toContain('admin_session=')
    expect(setCookieHeader).toContain('Max-Age=0')
    // setAuthCookie scopes the cookie to the basePath; clearing anywhere else
    // leaves the stale cookie alive in the browser.
    expect(setCookieHeader).toContain('Path=/admin')
  })

  it('accepts a legitimately issued session token', async () => {
    const sessionToken = await createToken(
      { adminId: 1, email: 'admin@test.com' },
      SECRET,
      'session'
    )

    const res = await makeProtectedApp().request('/protected', {
      headers: { Cookie: `admin_session=${sessionToken}` },
      redirect: 'manual',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('secret-data')
  })
})
