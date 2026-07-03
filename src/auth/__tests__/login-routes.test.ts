import { describe, it, expect, vi, beforeAll } from 'vitest'
import type { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import type { AdminBackend, BackendRecord } from '@/backends/types.ts'
import { createAuthRoutes, readCredentialField } from '@/routes/auth.ts'
import { loginPage } from '@/views/login.ts'

const SECRET = 'login-routes-test-secret-32-chars-ok!'
const GENERIC_ERROR = 'Invalid email or password.'

let passwordHash: string

beforeAll(async () => {
  passwordHash = await bcrypt.hash('correct-password', 4)
})

function makeApp(options: { admin?: BackendRecord | null } = {}) {
  const findAdminByEmail = vi.fn(async () => options.admin ?? undefined)
  const backend = { findAdminByEmail } as unknown as AdminBackend
  const app = createAuthRoutes({
    backend,
    adminUsers: {},
    sessionSecret: SECRET,
    basePath: '',
    renderLogin: (props) => loginPage(props),
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
): Promise<Response> {
  const { cookie, token } = await getCsrf(app)
  const params = new URLSearchParams({ _csrf: token, ...fields })
  return app.request('/login', {
    method: 'POST',
    headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' },
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
