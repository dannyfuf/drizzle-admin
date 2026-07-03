import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { authMiddleware } from '@/auth/middleware.ts'
import { generateCsrfToken } from '@/auth/csrf.ts'

const SECRET = 'test-secret-at-least-32-chars-long!'

function makeProtectedApp() {
  const app = new Hono()
  app.use('*', authMiddleware(SECRET))
  app.get('/protected', (c) => c.text('secret-data'))
  return app
}

describe('authMiddleware token-type separation', () => {
  // T01 reproduction: a CSRF token is a validly-signed JWT minted with the same
  // secret. Against the vulnerable code it is accepted as a session, so this
  // request reaches the protected handler. T04 inverts this to assert rejection.
  it('DEMONSTRATES BYPASS: a CSRF token is currently accepted as an admin_session', async () => {
    const csrfToken = await generateCsrfToken(SECRET)

    const res = await makeProtectedApp().request('/protected', {
      headers: { Cookie: `admin_session=${csrfToken}` },
      redirect: 'manual',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('secret-data')
  })
})
