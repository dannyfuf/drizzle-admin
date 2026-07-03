import type { Context } from 'hono'

/** Tuning options for the built-in in-memory login rate limiter. */
export interface LoginRateLimitOptions {
  /** Max failed attempts per client identifier per window. Default: `5`. */
  maxAttemptsPerIdentifier?: number
  /** Window for the per-identifier counter, in milliseconds. Default: `60_000` (1 minute). */
  identifierWindowMs?: number
  /** Max failed attempts per email per window. Default: `10`. */
  maxAttemptsPerEmail?: number
  /** Window for the per-email counter, in milliseconds. Default: `900_000` (15 minutes). */
  emailWindowMs?: number
  /**
   * Trust the first entry of the `x-forwarded-for` header as the client
   * identifier. Only enable when the admin runs behind a proxy you control —
   * otherwise clients can spoof their identity and dodge the per-identifier
   * limit. Default: `false`.
   */
  trustProxyHeader?: boolean
}

/**
 * Failure-counting contract used by the login route. `identifier` is the
 * best-effort client identity (usually an IP) and may be `null` when the
 * runtime does not expose one — implementations must then rely on the
 * per-email key alone.
 */
export interface LoginRateLimiter {
  /** Returns `true` when the identifier or the email has exhausted its failure budget. */
  isLimited(identifier: string | null, email: string): boolean
  /** Records a failed login attempt against both keys. */
  recordFailure(identifier: string | null, email: string): void
  /** Clears the email counter after a successful login. */
  recordSuccess(email: string): void
}

interface WindowEntry {
  count: number
  expiresAt: number
}

/**
 * Fixed-window limiter backed by per-process `Map`s.
 *
 * Single-process only: counters are not shared across processes and reset on
 * restart. For multi-process or distributed deployments, supply your own
 * `LoginRateLimiter` backed by shared storage instead.
 */
export function createInMemoryLoginRateLimiter(
  options: LoginRateLimitOptions = {},
): LoginRateLimiter {
  const maxPerIdentifier = options.maxAttemptsPerIdentifier ?? 5
  const identifierWindowMs = options.identifierWindowMs ?? 60_000
  const maxPerEmail = options.maxAttemptsPerEmail ?? 10
  const emailWindowMs = options.emailWindowMs ?? 900_000

  const identifierFailures = new Map<string, WindowEntry>()
  const emailFailures = new Map<string, WindowEntry>()

  function activeCount(entries: Map<string, WindowEntry>, key: string): number {
    const entry = entries.get(key)
    if (!entry || entry.expiresAt <= Date.now()) return 0
    return entry.count
  }

  function bump(entries: Map<string, WindowEntry>, key: string, windowMs: number): void {
    const now = Date.now()
    // Prune on write so abandoned keys cannot grow the map unboundedly.
    for (const [entryKey, entry] of entries) {
      if (entry.expiresAt <= now) entries.delete(entryKey)
    }
    const entry = entries.get(key)
    if (!entry) {
      entries.set(key, { count: 1, expiresAt: now + windowMs })
    } else {
      entry.count += 1
    }
  }

  return {
    isLimited(identifier, email) {
      if (identifier !== null && activeCount(identifierFailures, identifier) >= maxPerIdentifier) {
        return true
      }
      return activeCount(emailFailures, email) >= maxPerEmail
    },
    recordFailure(identifier, email) {
      if (identifier !== null) bump(identifierFailures, identifier, identifierWindowMs)
      bump(emailFailures, email, emailWindowMs)
    },
    recordSuccess(email) {
      emailFailures.delete(email)
    },
  }
}

/**
 * Best-effort client identifier for rate limiting. Reads `x-forwarded-for`
 * only when explicitly trusted, then falls back to the Node server's socket
 * address. Returns `null` when the runtime exposes neither — per-email
 * limiting still applies in that case.
 */
export function getClientIdentifier(c: Context, trustProxyHeader: boolean): string | null {
  if (trustProxyHeader) {
    const forwarded = c.req.header('x-forwarded-for')
    const first = forwarded?.split(',')[0]?.trim()
    if (first) return first
  }
  const env = c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined
  return env?.incoming?.socket?.remoteAddress ?? null
}
