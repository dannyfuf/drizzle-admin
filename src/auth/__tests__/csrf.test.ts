import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { csrfInput, generateCsrfToken, setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { verifyToken } from '@/auth/jwt.ts'

describe('csrfInput', () => {
  it('returns a hidden input element with correct name and value', () => {
    const html = csrfInput('test-token-123')
    expect(html).toContain('type="hidden"')
    expect(html).toContain('name="_csrf"')
    expect(html).toContain('value="test-token-123"')
  })

  it('embeds the token value exactly', () => {
    const token = 'abc.def.ghi'
    const html = csrfInput(token)
    expect(html).toContain(`value="${token}"`)
  })
})

describe('generateCsrfToken', () => {
  it('returns a JWT-like string with three dot-separated segments', async () => {
    const token = await generateCsrfToken('my-secret-key')
    const parts = token.split('.')
    expect(parts).toHaveLength(3)
  })

  it('returns a non-empty string', async () => {
    const token = await generateCsrfToken('secret')
    expect(token.length).toBeGreaterThan(0)
  })

  it('mints a unique token on every call', async () => {
    const secret = 'per-issue-uniqueness-secret'
    const first = await generateCsrfToken(secret)
    const second = await generateCsrfToken(secret)
    expect(first).not.toBe(second)
  })

  it('carries a random jti claim and still validates round-trip', async () => {
    const secret = 'per-issue-uniqueness-secret'
    const token = await generateCsrfToken(secret)
    const payload = await verifyToken(token, secret, 'csrf')
    expect(payload).not.toBeNull()
    expect(payload!.jti).toMatch(/^[0-9a-f]{32}$/)
  })
})

describe('setCsrfCookie', () => {
  it('sets cookie with explicit path=/ regardless of request path', async () => {
    const app = new Hono()
    app.get('/deep/nested/path', async (c) => {
      await setCsrfCookie(c, 'test-secret')
      return c.text('ok')
    })

    const res = await app.request('/deep/nested/path')
    const setCookieHeader = res.headers.get('set-cookie') ?? ''
    // Must contain Path=/ (not Path=/deep/nested or absent)
    // Without explicit path, browsers default to the request URI directory
    expect(setCookieHeader).toMatch(/Path=\/(?:;|$)/)
  })

  it('lives as long as the session cookie so idle forms stay submittable', async () => {
    const app = new Hono()
    app.get('/x', async (c) => {
      await setCsrfCookie(c, 'test-secret')
      return c.text('ok')
    })

    const res = await app.request('/x')
    // 24h — must match the session cookie's maxAge in middleware.ts.
    expect(res.headers.get('set-cookie')).toContain('Max-Age=86400')
  })
})

describe('validateCsrf', () => {
  it('fails closed instead of throwing on an unparseable body', async () => {
    const app = new Hono()
    app.post('/x', async (c) => c.text((await validateCsrf(c, 'test-secret')) ? 'valid' : 'invalid'))

    // multipart/form-data with no boundary makes parseBody reject.
    const res = await app.request('/x', {
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data' },
      body: 'garbage',
    })

    expect(res.status).toBe(200)
    expect(await res.text()).toBe('invalid')
  })
})
