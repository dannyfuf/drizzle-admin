import { describe, it, expect } from 'vitest'
import { adminUrl } from '@/utils/url.ts'

describe('adminUrl', () => {
  it('returns path unchanged when basePath is empty', () => {
    expect(adminUrl('', '/login')).toBe('/login')
  })

  it('joins basePath and path', () => {
    expect(adminUrl('/admin', '/login')).toBe('/admin/login')
  })

  it('handles root path', () => {
    expect(adminUrl('/admin', '/')).toBe('/admin/')
  })

  it('handles deeply nested basePath', () => {
    expect(adminUrl('/app/admin', '/users')).toBe('/app/admin/users')
  })

  it('handles path with dynamic segments', () => {
    expect(adminUrl('/admin', '/users/123/edit')).toBe('/admin/users/123/edit')
  })

  it('handles path with query string', () => {
    expect(adminUrl('/admin', '/users?page=2')).toBe('/admin/users?page=2')
  })

  it('handles empty path with basePath', () => {
    expect(adminUrl('/admin', '')).toBe('/admin')
  })

  it('returns empty string when both are empty', () => {
    expect(adminUrl('', '')).toBe('')
  })

  it('handles basePath "/" — produces protocol-relative-looking URL (design note)', () => {
    // basePath should never be just "/" after validation strips trailing slash.
    // But documenting the raw behavior: adminUrl('/', '/login') → '//login'
    // This is prevented by the basePath validation in DrizzleAdmin constructor.
    expect(adminUrl('/', '/login')).toBe('//login')
  })
})
