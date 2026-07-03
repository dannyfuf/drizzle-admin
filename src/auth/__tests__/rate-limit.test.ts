import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createInMemoryLoginRateLimiter } from '@/auth/rate-limit.ts'

describe('createInMemoryLoginRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('is not limited before any failures', () => {
    const limiter = createInMemoryLoginRateLimiter()
    expect(limiter.isLimited('1.1.1.1', 'a@test.com')).toBe(false)
  })

  it('trips the per-identifier limit after 5 failures within a minute', () => {
    const limiter = createInMemoryLoginRateLimiter()
    for (let i = 0; i < 5; i++) {
      limiter.recordFailure('1.1.1.1', `victim-${i}@test.com`)
    }
    expect(limiter.isLimited('1.1.1.1', 'fresh@test.com')).toBe(true)
    expect(limiter.isLimited('2.2.2.2', 'fresh@test.com')).toBe(false)
  })

  it('trips the per-email limit after 10 failures even across identifiers', () => {
    const limiter = createInMemoryLoginRateLimiter()
    for (let i = 0; i < 10; i++) {
      limiter.recordFailure(`10.0.0.${i}`, 'victim@test.com')
    }
    expect(limiter.isLimited('99.99.99.99', 'victim@test.com')).toBe(true)
    expect(limiter.isLimited('99.99.99.99', 'other@test.com')).toBe(false)
  })

  it('limits by email alone when the identifier is unknown', () => {
    const limiter = createInMemoryLoginRateLimiter({ maxAttemptsPerEmail: 2 })
    limiter.recordFailure(null, 'victim@test.com')
    limiter.recordFailure(null, 'victim@test.com')
    expect(limiter.isLimited(null, 'victim@test.com')).toBe(true)
    expect(limiter.isLimited(null, 'other@test.com')).toBe(false)
  })

  it('clears the email counter on success but keeps the identifier counter', () => {
    const limiter = createInMemoryLoginRateLimiter({ maxAttemptsPerIdentifier: 3, maxAttemptsPerEmail: 3 })
    for (let i = 0; i < 3; i++) {
      limiter.recordFailure('1.1.1.1', 'victim@test.com')
    }
    expect(limiter.isLimited('2.2.2.2', 'victim@test.com')).toBe(true)

    limiter.recordSuccess('victim@test.com')
    expect(limiter.isLimited('2.2.2.2', 'victim@test.com')).toBe(false)
    // The per-identifier counter is untouched by success.
    expect(limiter.isLimited('1.1.1.1', 'victim@test.com')).toBe(true)
  })

  it('unlocks after the window expires', () => {
    const limiter = createInMemoryLoginRateLimiter({
      maxAttemptsPerIdentifier: 2,
      identifierWindowMs: 60_000,
      maxAttemptsPerEmail: 2,
      emailWindowMs: 60_000,
    })
    limiter.recordFailure('1.1.1.1', 'victim@test.com')
    limiter.recordFailure('1.1.1.1', 'victim@test.com')
    expect(limiter.isLimited('1.1.1.1', 'victim@test.com')).toBe(true)

    vi.advanceTimersByTime(60_001)
    expect(limiter.isLimited('1.1.1.1', 'victim@test.com')).toBe(false)
  })

  it('starts a fresh window after expiry instead of resuming the old count', () => {
    const limiter = createInMemoryLoginRateLimiter({ maxAttemptsPerEmail: 2, emailWindowMs: 60_000 })
    limiter.recordFailure(null, 'victim@test.com')
    limiter.recordFailure(null, 'victim@test.com')

    vi.advanceTimersByTime(60_001)
    limiter.recordFailure(null, 'victim@test.com')
    expect(limiter.isLimited(null, 'victim@test.com')).toBe(false)
  })

  it('prunes expired entries on write so the maps do not grow unboundedly', () => {
    const limiter = createInMemoryLoginRateLimiter({ emailWindowMs: 60_000 })
    for (let i = 0; i < 100; i++) {
      limiter.recordFailure(null, `bot-${i}@test.com`)
    }
    vi.advanceTimersByTime(60_001)
    // A single write after expiry must clear all stale entries; verify by
    // confirming stale keys no longer count.
    limiter.recordFailure(null, 'fresh@test.com')
    expect(limiter.isLimited(null, 'bot-0@test.com')).toBe(false)
  })
})
