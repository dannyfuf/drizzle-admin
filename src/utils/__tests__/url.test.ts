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
})
