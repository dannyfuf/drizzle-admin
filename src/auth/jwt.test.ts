import { describe, it, expect } from 'vitest'
import { createToken, verifyToken } from './jwt.js'

const TEST_SECRET = 'test-secret-at-least-32-chars-long!'

describe('jwt', () => {
  it('createToken produces valid JWT string', async () => {
    const token = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET)
    expect(token).toBeTruthy()
    expect(token.split('.')).toHaveLength(3)
  })

  it('verifyToken decodes valid tokens', async () => {
    const token = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET)
    const payload = await verifyToken(token, TEST_SECRET)
    expect(payload).not.toBeNull()
    expect(payload!.adminId).toBe(1)
    expect(payload!.email).toBe('test@test.com')
  })

  it('verifyToken returns null for invalid signatures', async () => {
    const token = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET)
    const payload = await verifyToken(token, 'different-secret-that-is-wrong-xx')
    expect(payload).toBeNull()
  })

  it('verifyToken returns null for malformed tokens', async () => {
    const payload = await verifyToken('not-a-valid-token', TEST_SECRET)
    expect(payload).toBeNull()
  })
})
