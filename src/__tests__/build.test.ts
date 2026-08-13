import { describe, it, expect, vi } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'
import type { DrizzleBackendConfig } from '@/config.ts'

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns ?? {},
  getTableName: () => 'posts',
  eq: () => {},
  and: () => ({}),
  ilike: () => ({}),
  sql: (strings: TemplateStringsArray) => strings.join(''),
}))

vi.mock('@/resources/loader.ts', () => ({
  loadResources: async () => ({ resources: [], errors: [] }),
  validateResources: () => [],
  applyReferencedBy: (resources: unknown[]) => resources,
}))

vi.mock('@/dialects/postgresql.ts', () => ({
  postgresqlAdapter: {
    name: 'postgresql',
    extractColumns: () => [],
  },
}))

import { DrizzleAdmin } from '@/DrizzleAdmin.ts'

function makeAdminUsers() {
  return {
    _columns: {
      id: {},
      email: {},
      passwordHash: {},
      createdAt: {},
      updatedAt: {},
    },
    id: {},
    email: {},
    passwordHash: {},
    createdAt: {},
    updatedAt: {},
  }
}

function makeConfig(overrides: Partial<DrizzleBackendConfig> = {}): DrizzleBackendConfig {
  return {
    db: {} as AnyPgDatabase,
    dialect: 'postgresql',
    adminUsers: makeAdminUsers() as unknown as PgTable,
    sessionSecret: 'test-secret-at-least-32-chars-long!',
    resourcesDir: './resources',
    ...overrides,
  }
}

describe('DrizzleAdmin.build()', () => {
  it('returns a handler with app and fetch properties', async () => {
    const admin = new DrizzleAdmin(makeConfig())
    const handler = await admin.build()

    expect(handler).toHaveProperty('app')
    expect(handler).toHaveProperty('fetch')
    expect(typeof handler.fetch).toBe('function')
  })

  it('handler.app is a Hono instance with fetch method', async () => {
    const admin = new DrizzleAdmin(makeConfig())
    const handler = await admin.build()

    expect(handler.app).toBeDefined()
    expect(typeof handler.app.fetch).toBe('function')
  })

  it('handler.fetch is callable', async () => {
    const admin = new DrizzleAdmin(makeConfig())
    const handler = await admin.build()

    // Calling fetch with a request to the login page should return a response
    const req = new Request('http://localhost/login')
    const res = await handler.fetch(req)
    expect(res).toBeInstanceOf(Response)
    expect(res.status).toBe(200)
  })

  it('respects basePath config', async () => {
    const admin = new DrizzleAdmin(makeConfig({ basePath: '/admin' }))
    const handler = await admin.build()

    expect(handler).toHaveProperty('app')
    expect(handler).toHaveProperty('fetch')
  })

  it('uses a custom loginRateLimiter when provided', async () => {
    const loginRateLimiter = {
      isLimited: vi.fn(() => false),
      recordFailure: vi.fn(),
      recordSuccess: vi.fn(),
      retryAfterMs: vi.fn(() => 0),
    }
    const admin = new DrizzleAdmin(makeConfig({ loginRateLimiter }))
    const handler = await admin.build()

    const loginPage = await handler.fetch(new Request('http://localhost/login'))
    const token = (loginPage.headers.get('set-cookie') ?? '').match(/_csrf=([^;]+)/)?.[1]
    expect(token).toBeTruthy()

    // The stub db makes the backend lookup blow up further down the handler;
    // all this test asserts is that the injected limiter is consulted.
    await handler.fetch(new Request('http://localhost/login', {
      method: 'POST',
      headers: { Cookie: `_csrf=${token}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ _csrf: token!, email: 'a@test.com', password: 'x' }).toString(),
    }))
    expect(loginRateLimiter.isLimited).toHaveBeenCalledWith(null, 'a@test.com')
  })
})
