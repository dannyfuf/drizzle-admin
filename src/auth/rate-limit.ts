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
   * Trust the **last** entry of the `x-forwarded-for` header as the client
   * identifier — the address your own proxy appended. Only enable when the
   * admin runs behind a proxy you control. The leftmost entries are
   * client-supplied even behind a trusted append-style proxy (nginx
   * `$proxy_add_x_forwarded_for`, AWS ALB, …), so they are never used.
   * Default: `false`.
   */
  trustProxyHeader?: boolean
}

/**
 * Failure-counting contract used by the login route. `identifier` is the
 * best-effort client identity (usually an IP) and may be `null` when the
 * runtime does not expose one — implementations must then rely on the
 * per-email key alone.
 *
 * Being over-limit never blocks a correct password: the login route treats
 * `isLimited` as "reject *failed* attempts with 429", not as a hard gate, so
 * unauthenticated traffic cannot lock legitimate admins out.
 */
export interface LoginRateLimiter {
  /** Returns `true` when the identifier or the email has exhausted its failure budget. */
  isLimited(identifier: string | null, email: string): boolean
  /** Records a failed login attempt against both keys. */
  recordFailure(identifier: string | null, email: string): void
  /** Clears the email counter after a successful login. */
  recordSuccess(email: string): void
  /**
   * Milliseconds until the tripped budget(s) reset, for the `Retry-After`
   * header. Optional; return `0` (or omit the method) when unknown.
   */
  retryAfterMs?(identifier: string | null, email: string): number
}

interface WindowEntry {
  count: number
  expiresAt: number
}

interface WindowMap {
  entries: Map<string, WindowEntry>
  writesSinceSweep: number
}

// Attacker-chosen identifiers (e.g. spoofed x-forwarded-for values) must not
// grow map keys without bound.
export const MAX_IDENTIFIER_LENGTH = 256

/**
 * Fixed-window limiter backed by per-process `Map`s.
 *
 * Single-process only: counters are not shared across processes and reset on
 * restart. For multi-process or distributed deployments, supply your own
 * `LoginRateLimiter` via the `loginRateLimiter` config option instead.
 */
export function createInMemoryLoginRateLimiter(
  options: LoginRateLimitOptions = {},
): LoginRateLimiter {
  const maxPerIdentifier = options.maxAttemptsPerIdentifier ?? 5
  const identifierWindowMs = options.identifierWindowMs ?? 60_000
  const maxPerEmail = options.maxAttemptsPerEmail ?? 10
  const emailWindowMs = options.emailWindowMs ?? 900_000

  const identifierFailures: WindowMap = { entries: new Map(), writesSinceSweep: 0 }
  const emailFailures: WindowMap = { entries: new Map(), writesSinceSweep: 0 }

  function activeEntry(map: WindowMap, key: string): WindowEntry | null {
    const entry = map.entries.get(key)
    if (!entry || entry.expiresAt <= Date.now()) return null
    return entry
  }

  function bump(map: WindowMap, key: string, windowMs: number): void {
    const now = Date.now()
    const existing = map.entries.get(key)
    if (existing && existing.expiresAt <= now) map.entries.delete(key)

    const entry = map.entries.get(key)
    if (!entry) {
      map.entries.set(key, { count: 1, expiresAt: now + windowMs })
    } else {
      entry.count += 1
    }

    // Amortized prune: a full sweep once per `size` writes bounds the map at
    // roughly twice its active population while costing O(1) per write, so
    // attack traffic cannot buy an O(n) scan on every request.
    map.writesSinceSweep += 1
    if (map.writesSinceSweep >= map.entries.size) {
      for (const [entryKey, entry] of map.entries) {
        if (entry.expiresAt <= now) map.entries.delete(entryKey)
      }
      map.writesSinceSweep = 0
    }
  }

  function remainingMs(map: WindowMap, key: string, max: number): number {
    const entry = activeEntry(map, key)
    if (!entry || entry.count < max) return 0
    return entry.expiresAt - Date.now()
  }

  return {
    isLimited(identifier, email) {
      if (identifier !== null && (activeEntry(identifierFailures, identifier)?.count ?? 0) >= maxPerIdentifier) {
        return true
      }
      return (activeEntry(emailFailures, email)?.count ?? 0) >= maxPerEmail
    },
    recordFailure(identifier, email) {
      if (identifier !== null) bump(identifierFailures, identifier, identifierWindowMs)
      bump(emailFailures, email, emailWindowMs)
    },
    recordSuccess(email) {
      emailFailures.entries.delete(email)
    },
    retryAfterMs(identifier, email) {
      const identifierWait = identifier !== null
        ? remainingMs(identifierFailures, identifier, maxPerIdentifier)
        : 0
      return Math.max(identifierWait, remainingMs(emailFailures, email, maxPerEmail))
    },
  }
}

/**
 * Best-effort client identifier for rate limiting. Reads the last
 * `x-forwarded-for` entry (the one appended by your own proxy) only when
 * explicitly trusted, then falls back to the Node server's socket address or
 * Deno's connection info. Returns `null` when the runtime exposes none —
 * per-email limiting still applies in that case.
 */
export function getClientIdentifier(c: Context, trustProxyHeader: boolean): string | null {
  if (trustProxyHeader) {
    const forwarded = c.req.header('x-forwarded-for')
    const parts = forwarded?.split(',') ?? []
    const last = parts[parts.length - 1]?.trim()
    if (last) return last.slice(0, MAX_IDENTIFIER_LENGTH)
  }
  const env = c.env as {
    incoming?: { socket?: { remoteAddress?: string } }
    remoteAddr?: { hostname?: string }
  } | undefined
  return env?.incoming?.socket?.remoteAddress ?? env?.remoteAddr?.hostname ?? null
}
