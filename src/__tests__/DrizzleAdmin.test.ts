import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'
import type { DrizzleAdminConfig } from '@/config.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

const loaderMocks = vi.hoisted(() => ({
  loadResourcesMock: vi.fn<() => Promise<{ resources: ResourceDefinition[]; errors: string[] }>>(
    async () => ({ resources: [], errors: [] }),
  ),
  validateResourcesMock: vi.fn(() => []),
}))

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns ?? {},
  eq: () => {},
  and: () => ({}),
  ilike: () => ({}),
  sql: (strings: TemplateStringsArray) => strings.join(''),
}))

vi.mock('@/resources/loader.ts', () => ({
  loadResources: loaderMocks.loadResourcesMock,
  validateResources: loaderMocks.validateResourcesMock,
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
    adminUsers: makeAdminUsers() as unknown as PgTable,
    sessionSecret: 'test-secret',
    resourcesDir: './resources',
    ...overrides,
  }
}

describe('DrizzleAdmin', () => {
  beforeEach(() => {
    loaderMocks.loadResourcesMock.mockResolvedValue({ resources: [], errors: [] })
    loaderMocks.validateResourcesMock.mockReturnValue([])
  })

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
      new DrizzleAdmin(makeConfig({ adminUsers: badAdminUsers as unknown as PgTable }))
    }).toThrow()
  })

  it('returns empty resources before initialization', () => {
    const admin = new DrizzleAdmin(makeConfig())
    expect(admin.getResources()).toEqual([])
  })

  describe('basePath validation', () => {
    it('accepts valid basePath with leading slash', () => {
      expect(() => new DrizzleAdmin(makeConfig({ basePath: '/admin' }))).not.toThrow()
    })

    it('normalizes trailing slash', () => {
      const admin = new DrizzleAdmin(makeConfig({ basePath: '/admin/' }))
      expect(admin).toBeInstanceOf(DrizzleAdmin)
    })

    it('accepts empty basePath', () => {
      expect(() => new DrizzleAdmin(makeConfig({ basePath: '' }))).not.toThrow()
    })

    it('accepts undefined basePath (defaults to empty)', () => {
      expect(() => new DrizzleAdmin(makeConfig({ basePath: undefined }))).not.toThrow()
    })

    it('throws when basePath is missing leading slash', () => {
      expect(() => new DrizzleAdmin(makeConfig({ basePath: 'admin' }))).toThrow(
        'basePath must start with "/"'
      )
    })

    it('throws when basePath contains double slashes', () => {
      expect(() => new DrizzleAdmin(makeConfig({ basePath: '//admin' }))).toThrow(
        'basePath must not contain "//"'
      )
    })
  })

  describe('initialize', () => {
    it('fails fast for invalid declared filters', async () => {
      const resource: ResourceDefinition = {
        table: {
          _columns: {
            id: { name: 'id' },
            title: { name: 'title' },
          },
          id: { name: 'id' },
          title: { name: 'title' },
        } as unknown as PgTable,
        tableName: 'posts',
        routePath: 'posts',
        displayName: 'Post',
        options: {
          index: {
            filters: ['missing'],
          },
        },
      }

      loaderMocks.loadResourcesMock.mockResolvedValue({ resources: [resource], errors: [] })

      const admin = new DrizzleAdmin(makeConfig())
      await expect(admin.initialize()).rejects.toThrow('Invalid resource configuration')
    })
  })
})
