import { describe, it, expect } from 'vitest'
import { csrfInput, generateCsrfToken } from '@/auth/csrf.ts'

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
