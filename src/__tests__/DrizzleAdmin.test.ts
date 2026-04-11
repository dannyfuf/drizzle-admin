import { describe, it, expect, vi } from 'vitest'

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: any) => table._columns ?? {},
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

function makeConfig(overrides: Record<string, unknown> = {}) {
  return {
    db: {},
    dialect: 'postgresql' as const,
    adminUsers: makeAdminUsers(),
    sessionSecret: 'test-secret',
    resourcesDir: './resources',
    ...overrides,
  }
}

describe('DrizzleAdmin', () => {
  it('creates instance successfully with valid config', () => {
    const admin = new DrizzleAdmin(makeConfig())
    expect(admin).toBeInstanceOf(DrizzleAdmin)
  })

  it('throws when unsupported dialect is provided', () => {
    expect(() => {
      new DrizzleAdmin(makeConfig({ dialect: 'mysql' }))
    }).toThrow('not yet supported')
  })

  it('throws when admin users table is missing required columns', () => {
    const badAdminUsers = {
      _columns: {
        id: {},
        // missing email, passwordHash, etc.
      },
      id: {},
    }
    expect(() => {
      new DrizzleAdmin(makeConfig({ adminUsers: badAdminUsers }))
    }).toThrow()
  })

  it('returns empty resources before initialization', () => {
    const admin = new DrizzleAdmin(makeConfig())
    expect(admin.getResources()).toEqual([])
  })
})
