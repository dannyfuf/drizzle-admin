import { describe, it, expect } from 'vitest'
import { loginPage } from '@/views/login.ts'

describe('loginPage', () => {
  it('returns full HTML document', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '' })
    expect(html).toContain('<!DOCTYPE html>')
    expect(html).toContain('</html>')
  })

  it('includes CSRF hidden input', () => {
    const html = loginPage({ csrfToken: 'my-csrf-token', basePath: '' })
    expect(html).toContain('name="_csrf"')
    expect(html).toContain('value="my-csrf-token"')
  })

  it('includes email input field', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '' })
    expect(html).toContain('type="email"')
    expect(html).toContain('name="email"')
  })

  it('includes password input field', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '' })
    expect(html).toContain('type="password"')
    expect(html).toContain('name="password"')
  })

  it('includes submit button', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '' })
    expect(html).toContain('type="submit"')
    expect(html).toContain('Sign in')
  })

  it('renders error message when provided', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '', error: 'Invalid credentials' })
    expect(html).toContain('Invalid credentials')
  })

  it('does not render error div when no error', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '' })
    expect(html).not.toContain('bg-red-900')
  })

  it('escapes HTML in error message', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '', error: '<script>xss</script>' })
    expect(html).toContain('&lt;script&gt;')
    expect(html).not.toContain('<script>xss</script>')
  })

  it('uses basePath in form action', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '/admin' })
    expect(html).toContain('action="/admin/login"')
  })

  it('uses root path when basePath is empty', () => {
    const html = loginPage({ csrfToken: 'token', basePath: '' })
    expect(html).toContain('action="/login"')
  })
})
