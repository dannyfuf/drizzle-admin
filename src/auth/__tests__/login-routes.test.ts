import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { AdminBackend, BackendRecord } from '@/backends/types.ts'
import type { LoginRateLimiter } from '@/auth/rate-limit.ts'
import { createAuthRoutes, readCredentialField } from '@/routes/auth.ts'
import { loginPage } from '@/views/login.ts'

const SECRET = 'login-routes-test-secret-32-chars-ok!'
const GENERIC_ERROR = 'Invalid email or password.'

let passwordHash: string

beforeAll(async () => {
  passwordHash = await bcrypt.hash('correct-password', 4)
})

function makeStubLimiter(overrides: Partial<LoginRateLimiter> = {}): LoginRateLimiter {
  return {
    isLimited: vi.fn(() => false),
    recordFailure: vi.fn(),
    recordSuccess: vi.fn(),
    ...overrides,
  }
}

function makeApp(options: {
  admin?: BackendRecord | null
  rateLimiter?: LoginRateLimiter
  trustProxyHeader?: boolean
} = {}) {
  const findAdminByEmail = vi.fn(async () => options.admin ?? undefined)
  const backend = { findAdminByEmail } as unknown as AdminBackend
  const app = createAuthRoutes({
    backend,
    adminUsers: {},
    sessionSecret: SECRET,
    basePath: '',
    renderLogin: (props) => loginPage(props),
    rateLimiter: options.rateLimiter,
    trustProxyHeader: options.trustProxyHeader,
  })
  return { app, findAdminByEmail }
}

async function getCsrf(app: Hono): Promise<{ cookie: string; token: string }> {
  const res = await app.request('/login')
  const setCookie = res.headers.get('set-cookie') ?? ''
  const match = setCookie.match(/_csrf=([^;]+)/)
  if (!match) throw new Error('login page did not set a CSRF cookie')
  return { cookie: `_csrf=${match[1]}`, token: match[1]! }
}

async function postLogin(
  app: Hono,
  fields: Record<string, string>,
  headers: Record<string, string> = {},
): Promise<Response> {
  const { cookie, token } = await getCsrf(app)
  const params = new URLSearchParams({ _csrf: token, ...fields })
  return app.request('/login', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded', ...headers },
    body: params.toString(),
  })
}

describe('readCredentialField', () => {
  it('accepts a plain string within the length cap', () => {
    expect(readCredentialField('admin@test.com', 254)).toBe('admin@test.com')
  })

  it('rejects arrays (duplicate form fields)', () => {
    expect(readCredentialField(['a@test.com', 'b@test.com'], 254)).toBeNull()
  })

  it('rejects File objects (multipart uploads)', () => {
    expect(readCredentialField(new File(['x'], 'email.txt'), 254)).toBeNull()
  })

  it('rejects undefined and empty strings', () => {
    expect(readCredentialField(undefined, 254)).toBeNull()
    expect(readCredentialField('', 254)).toBeNull()
  })

  it('rejects strings over the length cap', () => {
    expect(readCredentialField('a'.repeat(255), 254)).toBeNull()
    expect(readCredentialField('a'.repeat(254), 254)).toBe('a'.repeat(254))
  })
})

describe('POST /login body validation', () => {
  it('rejects a File-valued email field without touching the backend', async () => {
    const { app, findAdminByEmail } = makeApp()
    const { cookie, token } = await getCsrf(app)

    const form = new FormData()
    form.set('_csrf', token)
    form.set('email', new File(['attacker'], 'email.txt', { type: 'text/plain' }))
    form.set('password', 'whatever')

    const res = await app.request('/login', {
      method: 'POST',
      headers: { Cookie: cookie },
      body: form,
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain(GENERIC_ERROR)
    expect(findAdminByEmail).not.toHaveBeenCalled()
  })

  it('rejects an over-length email without touching the backend', async () => {
    const { app, findAdminByEmail } = makeApp()
    const res = await postLogin(app, {
      email: `${'a'.repeat(250)}@test.com`,
      password: 'whatever',
    })

    expect(await res.text()).toContain(GENERIC_ERROR)
    expect(findAdminByEmail).not.toHaveBeenCalled()
  })

  it('rejects an over-length password without invoking bcrypt', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare')
    const { app, findAdminByEmail } = makeApp()
    const res = await postLogin(app, {
      email: 'admin@test.com',
      password: 'p'.repeat(257),
    })

    expect(await res.text()).toContain(GENERIC_ERROR)
    expect(findAdminByEmail).not.toHaveBeenCalled()
    expect(compareSpy).not.toHaveBeenCalled()
    compareSpy.mockRestore()
  })

  it('rejects missing fields with the generic error', async () => {
    const { app, findAdminByEmail } = makeApp()
    const res = await postLogin(app, { email: 'admin@test.com' })

    expect(await res.text()).toContain(GENERIC_ERROR)
    expect(findAdminByEmail).not.toHaveBeenCalled()
  })

  it('re-issues a fresh CSRF token on validation failure', async () => {
    const { app } = makeApp()
    const res = await postLogin(app, { email: '', password: '' })

    expect(res.headers.get('set-cookie')).toContain('_csrf=')
    expect(await res.text()).toContain('name="_csrf"')
  })

  it('trims the email but preserves its case before lookup', async () => {
    const { app, findAdminByEmail } = makeApp()
    await postLogin(app, { email: '  Admin@Test.com  ', password: 'whatever' })

    expect(findAdminByEmail).toHaveBeenCalledWith({}, 'Admin@Test.com')
  })

  it('performs exactly one bcrypt compare whether the email exists or not', async () => {
    const compareSpy = vi.spyOn(bcrypt, 'compare')

    const { app: unknownApp } = makeApp()
    await postLogin(unknownApp, { email: 'ghost@test.com', password: 'guess' })
    expect(compareSpy).toHaveBeenCalledTimes(1)

    compareSpy.mockClear()
    const { app: knownApp } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash },
    })
    await postLogin(knownApp, { email: 'admin@test.com', password: 'guess' })
    expect(compareSpy).toHaveBeenCalledTimes(1)

    compareSpy.mockRestore()
  })

  it('returns indistinguishable error pages for unknown and known emails', async () => {
    // The CSRF token is the only legitimate per-response difference; normalize it.
    const normalize = (html: string) => html.replace(/name="_csrf" value="[^"]*"/g, 'name="_csrf" value=""')

    const { app: unknownApp } = makeApp()
    const unknownRes = await postLogin(unknownApp, { email: 'ghost@test.com', password: 'guess' })

    const { app: knownApp } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash },
    })
    const knownRes = await postLogin(knownApp, { email: 'admin@test.com', password: 'guess' })

    expect(unknownRes.status).toBe(knownRes.status)
    expect(normalize(await unknownRes.text())).toBe(normalize(await knownRes.text()))
  })

  it.each([
    ['null', null],
    ['empty string', ''],
    ['non-string', 12345],
  ])('fails generically instead of crashing when the stored hash is %s', async (_label, badHash) => {
    const compareSpy = vi.spyOn(bcrypt, 'compare')
    const { app } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash: badHash },
    })

    const res = await postLogin(app, { email: 'admin@test.com', password: 'guess' })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain(GENERIC_ERROR)
    // The dummy compare keeps this branch timing-uniform too.
    expect(compareSpy).toHaveBeenCalledTimes(1)
    compareSpy.mockRestore()
  })

  it('answers a failed attempt with 429 and Retry-After when rate limited', async () => {
    const rateLimiter = makeStubLimiter({
      isLimited: vi.fn(() => true),
      retryAfterMs: vi.fn(() => 90_000),
    })
    const { app, findAdminByEmail } = makeApp({ rateLimiter })

    const res = await postLogin(app, { email: 'victim@test.com', password: 'guess' })

    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('90')
    expect(await res.text()).toContain('Too many attempts, try again later.')
    // Credentials are still verified while limited — a hard pre-auth block
    // would let unauthenticated traffic lock legitimate admins out.
    expect(findAdminByEmail).toHaveBeenCalled()
    expect(rateLimiter.recordFailure).toHaveBeenCalled()
  })

  it('lets a correct password through even when the counters are tripped', async () => {
    const rateLimiter = makeStubLimiter({ isLimited: vi.fn(() => true) })
    const { app } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash },
      rateLimiter,
    })

    const { cookie, token } = await getCsrf(app)
    const res = await app.request('/login', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        _csrf: token,
        email: 'admin@test.com',
        password: 'correct-password',
      }).toString(),
      redirect: 'manual',
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toContain('admin_session=')
    expect(rateLimiter.recordSuccess).toHaveBeenCalledWith('admin@test.com')
  })

  it('records a failure for unknown emails and wrong passwords', async () => {
    const unknownLimiter = makeStubLimiter()
    const { app: unknownApp } = makeApp({ rateLimiter: unknownLimiter })
    await postLogin(unknownApp, { email: 'ghost@test.com', password: 'guess' })
    expect(unknownLimiter.recordFailure).toHaveBeenCalledWith(null, 'ghost@test.com')

    const wrongPasswordLimiter = makeStubLimiter()
    const { app: knownApp } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash },
      rateLimiter: wrongPasswordLimiter,
    })
    await postLogin(knownApp, { email: 'admin@test.com', password: 'wrong-password' })
    expect(wrongPasswordLimiter.recordFailure).toHaveBeenCalledWith(null, 'admin@test.com')
  })

  it('records a success that clears the email counter on valid login', async () => {
    const rateLimiter = makeStubLimiter()
    const { app } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash },
      rateLimiter,
    })
    await postLogin(app, { email: 'admin@test.com', password: 'correct-password' })

    expect(rateLimiter.recordSuccess).toHaveBeenCalledWith('admin@test.com')
    expect(rateLimiter.recordFailure).not.toHaveBeenCalled()
  })

  it('uses the last x-forwarded-for entry as identifier only when the proxy is trusted', async () => {
    // The last entry is the one appended by your own proxy; leftmost entries
    // are client-supplied even behind a trusted append-style proxy.
    const trustedLimiter = makeStubLimiter()
    const { app: trustedApp } = makeApp({ rateLimiter: trustedLimiter, trustProxyHeader: true })
    await postLogin(
      trustedApp,
      { email: 'ghost@test.com', password: 'guess' },
      { 'x-forwarded-for': '203.0.113.9, 10.0.0.1' },
    )
    expect(trustedLimiter.recordFailure).toHaveBeenCalledWith('10.0.0.1', 'ghost@test.com')

    const untrustedLimiter = makeStubLimiter()
    const { app: untrustedApp } = makeApp({ rateLimiter: untrustedLimiter })
    await postLogin(
      untrustedApp,
      { email: 'ghost@test.com', password: 'guess' },
      { 'x-forwarded-for': '203.0.113.9' },
    )
    expect(untrustedLimiter.recordFailure).toHaveBeenCalledWith(null, 'ghost@test.com')
  })

  it('rate limits end-to-end with the default limiter after repeated failures', async () => {
    const { app } = makeApp() // real in-memory limiter via default
    for (let i = 0; i < 10; i++) {
      const res = await postLogin(app, { email: 'victim@test.com', password: `guess-${i}` })
      expect(res.status).toBe(200)
    }

    const res = await postLogin(app, { email: 'victim@test.com', password: 'guess-again' })
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toMatch(/^\d+$/)
  })

  it('treats an unparseable body as a request failure instead of a 500', async () => {
    const { app, findAdminByEmail } = makeApp()
    const { cookie } = await getCsrf(app)

    // multipart/form-data with no boundary makes parseBody reject.
    const res = await app.request('/login', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'multipart/form-data' },
      body: 'not-a-multipart-body',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Invalid request. Please try again.')
    expect(findAdminByEmail).not.toHaveBeenCalled()
  })

  it('serves the login page and failed re-renders with Cache-Control: no-store', async () => {
    const { app } = makeApp()

    const getRes = await app.request('/login')
    expect(getRes.headers.get('cache-control')).toBe('no-store')

    const failedPost = await postLogin(app, { email: 'ghost@test.com', password: 'guess' })
    expect(failedPost.headers.get('cache-control')).toBe('no-store')
  })

  it('still logs in successfully with valid credentials', async () => {
    const { app } = makeApp({
      admin: { id: 1, email: 'admin@test.com', passwordHash },
    })
    const { cookie, token } = await getCsrf(app)
    const params = new URLSearchParams({
      _csrf: token,
      email: 'admin@test.com',
      password: 'correct-password',
    })
    const res = await app.request('/login', {
      method: 'POST',
      headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
      redirect: 'manual',
    })

    expect(res.status).toBe(302)
    expect(res.headers.get('set-cookie')).toContain('admin_session=')
  })
})
