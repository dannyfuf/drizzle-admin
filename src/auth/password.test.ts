import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from './password.js'

describe('password', () => {
  it('hashPassword returns a bcrypt hash', async () => {
    const hash = await hashPassword('test123')
    expect(hash).toBeTruthy()
    expect(hash).toMatch(/^\$2[aby]\$/)
  })

  it('verifyPassword returns true for correct password', async () => {
    const hash = await hashPassword('test123')
    const valid = await verifyPassword('test123', hash)
    expect(valid).toBe(true)
  })

  it('verifyPassword returns false for incorrect password', async () => {
    const hash = await hashPassword('test123')
    const valid = await verifyPassword('wrong', hash)
    expect(valid).toBe(false)
  })

  it('produces different hashes for same password', async () => {
    const hash1 = await hashPassword('test123')
    const hash2 = await hashPassword('test123')
    expect(hash1).not.toBe(hash2)
  })
})
