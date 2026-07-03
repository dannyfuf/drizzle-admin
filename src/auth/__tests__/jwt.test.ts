import { describe, it, expect } from 'vitest'
import { createToken, verifyToken } from '@/auth/jwt.ts'

const TEST_SECRET = 'test-secret-at-least-32-chars-long!'

describe('jwt', () => {
  it('createToken produces valid JWT string', async () => {
    const token = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET, 'session')
    expect(token).toBeTruthy()
    expect(token.split('.')).toHaveLength(3)
  })

  it('verifyToken decodes valid tokens of the expected type', async () => {
    const token = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET, 'session')
    const payload = await verifyToken(token, TEST_SECRET, 'session')
    expect(payload).not.toBeNull()
    expect(payload!.adminId).toBe(1)
    expect(payload!.email).toBe('test@test.com')
  })

  it('verifyToken returns null for invalid signatures', async () => {
    const token = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET, 'session')
    const payload = await verifyToken(token, 'different-secret-that-is-wrong-xx', 'session')
    expect(payload).toBeNull()
  })

  it('verifyToken returns null for malformed tokens', async () => {
    const payload = await verifyToken('not-a-valid-token', TEST_SECRET, 'session')
    expect(payload).toBeNull()
  })

  it('createToken sets the jti claim only when one is provided', async () => {
    const withJti = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET, 'session', { jti: 'abc123' })
    const withoutJti = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET, 'session')

    expect((await verifyToken(withJti, TEST_SECRET, 'session'))!.jti).toBe('abc123')
    expect((await verifyToken(withoutJti, TEST_SECRET, 'session'))!.jti).toBeUndefined()
  })

  it('verifyToken rejects a csrf token when a session token is expected', async () => {
    const csrfToken = await createToken({ adminId: 0, email: 'csrf' }, TEST_SECRET, 'csrf')
    const payload = await verifyToken(csrfToken, TEST_SECRET, 'session')
    expect(payload).toBeNull()
  })

  it('verifyToken rejects a session token when a csrf token is expected', async () => {
    const sessionToken = await createToken({ adminId: 1, email: 'test@test.com' }, TEST_SECRET, 'session')
    const payload = await verifyToken(sessionToken, TEST_SECRET, 'csrf')
    expect(payload).toBeNull()
  })
})
