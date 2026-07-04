import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Context } from 'hono'
import {
  createInMemoryLoginRateLimiter,
  getClientIdentifier,
  MAX_IDENTIFIER_LENGTH,
} from '@/auth/rate-limit.ts'

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
    // Writes after expiry must clear stale entries (the sweep is amortized,
    // so it may take up to `size` writes to run); verify stale keys never
    // count regardless.
    for (let i = 0; i < 101; i++) {
      limiter.recordFailure(null, 'fresh@test.com')
    }
    expect(limiter.isLimited(null, 'bot-0@test.com')).toBe(false)
  })

  it('reports how long until a tripped budget resets', () => {
    const limiter = createInMemoryLoginRateLimiter({ maxAttemptsPerEmail: 2, emailWindowMs: 60_000 })
    limiter.recordFailure(null, 'victim@test.com')
    expect(limiter.retryAfterMs!(null, 'victim@test.com')).toBe(0)

    limiter.recordFailure(null, 'victim@test.com')
    vi.advanceTimersByTime(10_000)
    expect(limiter.retryAfterMs!(null, 'victim@test.com')).toBe(50_000)
  })

  it('reports the longer wait when both budgets are tripped', () => {
    const limiter = createInMemoryLoginRateLimiter({
      maxAttemptsPerIdentifier: 1,
      identifierWindowMs: 60_000,
      maxAttemptsPerEmail: 1,
      emailWindowMs: 900_000,
    })
    limiter.recordFailure('1.1.1.1', 'victim@test.com')
    expect(limiter.retryAfterMs!('1.1.1.1', 'victim@test.com')).toBe(900_000)
  })
})

describe('getClientIdentifier', () => {
  function makeContext(options: { xff?: string; env?: unknown } = {}): Context {
    return {
      req: { header: (name: string) => (name === 'x-forwarded-for' ? options.xff : undefined) },
      env: options.env,
    } as unknown as Context
  }

  it('uses the last x-forwarded-for entry when the proxy is trusted', () => {
    // Append-style proxies (nginx $proxy_add_x_forwarded_for, ALB) append the
    // real client last; leftmost entries are client-supplied and spoofable.
    const c = makeContext({ xff: 'spoofed-by-client, 203.0.113.9' })
    expect(getClientIdentifier(c, true)).toBe('203.0.113.9')
  })

  it('ignores x-forwarded-for when the proxy is not trusted', () => {
    const c = makeContext({
      xff: 'spoofed-by-client',
      env: { incoming: { socket: { remoteAddress: '10.0.0.5' } } },
    })
    expect(getClientIdentifier(c, false)).toBe('10.0.0.5')
  })

  it('caps attacker-chosen identifiers at MAX_IDENTIFIER_LENGTH', () => {
    const c = makeContext({ xff: 'x'.repeat(10_000) })
    expect(getClientIdentifier(c, true)).toHaveLength(MAX_IDENTIFIER_LENGTH)
  })

  it('reads the Deno connection-info shape', () => {
    const c = makeContext({ env: { remoteAddr: { hostname: '198.51.100.7' } } })
    expect(getClientIdentifier(c, false)).toBe('198.51.100.7')
  })

  it('returns null when the runtime exposes no address', () => {
    expect(getClientIdentifier(makeContext(), false)).toBeNull()
  })
})
