import { describe, it, expect } from 'vitest'
import { Hono } from 'hono'
import { csrfInput, generateCsrfToken, setCsrfCookie } from '@/auth/csrf.ts'

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
})
