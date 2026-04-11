import { describe, it, expect, vi } from 'vitest'
import type { Table } from 'drizzle-orm'
import type { AnyPgDatabase } from '@/types.ts'
import type { DrizzleAdminConfig } from '@/config.ts'

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns ?? {},
  eq: () => {},
}))

vi.mock('@/resources/loader.ts', () => ({
  loadResources: async () => ({ resources: [], errors: [] }),
  validateResources: () => [],
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

function makeConfig(overrides: Partial<DrizzleAdminConfig> = {}): DrizzleAdminConfig {
  return {
    db: {} as AnyPgDatabase,
    dialect: 'postgresql',
    adminUsers: makeAdminUsers() as unknown as Table,
    sessionSecret: 'test-secret',
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
})
