import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyKnexDatabase, AnyPgDatabase } from '@/types.ts'
import type { DrizzleBackendConfig } from '@/config.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import { defineKnexAdminUsers } from '@/resources/define.ts'

const loaderMocks = vi.hoisted(() => ({
  loadResourcesMock: vi.fn<() => Promise<{ resources: ResourceDefinition[]; errors: string[] }>>(
    async () => ({ resources: [], errors: [] }),
  ),
  validateResourcesMock: vi.fn(() => []),
}))

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns ?? {},
  getTableName: () => 'posts',
  eq: () => {},
  and: () => ({}),
  ilike: () => ({}),
  sql: (strings: TemplateStringsArray) => strings.join(''),
}))

vi.mock('@/resources/loader.ts', () => ({
  loadResources: loaderMocks.loadResourcesMock,
  validateResources: loaderMocks.validateResourcesMock,
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

  it('throws clearly when Knex uses an unsupported dialect', () => {
    expect(() => {
      new DrizzleAdmin({
        backend: 'knex',
        db: {} as AnyKnexDatabase,
        dialect: 'sqlite',
        adminUsers: makeKnexAdminUsers(),
        sessionSecret: 'test-secret-at-least-32-chars-long!',
        resourcesDir: './resources',
      })
    }).toThrow('Knex backend only supports dialect "postgresql"')
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

  describe('sessionSecret validation', () => {
    it('throws when sessionSecret is shorter than 32 characters', () => {
      expect(() => new DrizzleAdmin(makeConfig({ sessionSecret: 'too-short' }))).toThrow(
        'sessionSecret must be a string of at least 32 characters'
      )
    })

    it('throws when sessionSecret is missing', () => {
      expect(() => new DrizzleAdmin(makeConfig({ sessionSecret: undefined as unknown as string }))).toThrow(
        'sessionSecret must be a string of at least 32 characters'
      )
    })

    it('throws when sessionSecret is not a string', () => {
      expect(() => new DrizzleAdmin(makeConfig({ sessionSecret: 12345678901234567890123456789012 as unknown as string }))).toThrow(
        'sessionSecret must be a string of at least 32 characters'
      )
    })

    it('accepts a 32-character sessionSecret', () => {
      expect(() => new DrizzleAdmin(makeConfig({ sessionSecret: 'a'.repeat(32) }))).not.toThrow()
    })

    it('never echoes the secret value back in the error message', () => {
      const secret = 'super-secret-value'
      try {
        new DrizzleAdmin(makeConfig({ sessionSecret: secret }))
        expect.unreachable('constructor should have thrown')
      } catch (err) {
        expect((err as Error).message).not.toContain(secret)
      }
    })
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
        primaryKey: 'id',
        columns: [
          { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
          { name: 'title', sqlName: 'title', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
        ],
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

    it('fails fast for references to unregistered resources', async () => {
      const resource: ResourceDefinition = {
        table: {
          _columns: {
            id: { name: 'id' },
            authorId: { name: 'author_id' },
          },
          id: { name: 'id' },
          authorId: { name: 'author_id' },
        } as unknown as PgTable,
        tableName: 'posts',
        routePath: 'posts',
        displayName: 'Post',
        primaryKey: 'id',
        columns: [
          { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
          { name: 'authorId', sqlName: 'author_id', dataType: 'integer', isNullable: false, isPrimaryKey: false, hasDefault: false },
        ],
        options: {
          references: {
            authorId: { table: 'users' },
          },
        },
      }

      loaderMocks.loadResourcesMock.mockResolvedValue({ resources: [resource], errors: [] })

      const admin = new DrizzleAdmin(makeConfig())
      await expect(admin.initialize()).rejects.toThrow('Invalid resource configuration')
    })

    it('fails fast with the aggregated message for invalid referencedBy configuration', async () => {
      const resource: ResourceDefinition = {
        table: {
          _columns: {
            id: { name: 'id' },
          },
          id: { name: 'id' },
        } as unknown as PgTable,
        tableName: 'posts',
        routePath: 'posts',
        displayName: 'Post',
        primaryKey: 'id',
        columns: [
          { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
        ],
        options: {
          referencedBy: {
            comments: { table: 'missing_comments', foreignKey: 'postId' },
          },
        },
      }

      loaderMocks.loadResourcesMock.mockResolvedValue({ resources: [resource], errors: [] })

      const admin = new DrizzleAdmin(makeConfig())
      await expect(admin.initialize()).rejects.toThrow(
        'Invalid resource configuration. 1 error(s) found.',
      )
    })
  })

  describe('seed with Knex', () => {
    it('inserts admin users using SQL column names', async () => {
      const db = new SeedKnex()
      const admin = new DrizzleAdmin({
        backend: 'knex',
        db: db.instance,
        dialect: 'postgresql',
        adminUsers: makeKnexAdminUsers(),
        sessionSecret: 'test-secret-at-least-32-chars-long!',
        resourcesDir: './resources',
      })

      await admin.seed({ email: 'admin@test.com', password: 'password' })

      const insertCall = db.calls.find((call) => call.method === 'insert')
      expect(insertCall?.args[0]).toMatchObject({
        email: 'admin@test.com',
        password_hash: expect.any(String),
        created_at: expect.any(Date),
        updated_at: expect.any(Date),
      })
    })

    it('skips seeding when a Knex admin already exists', async () => {
      const db = new SeedKnex()
      db.firstRow = { id: 1, email: 'admin@test.com', password_hash: 'hash' }
      const admin = new DrizzleAdmin({
        backend: 'knex',
        db: db.instance,
        dialect: 'postgresql',
        adminUsers: makeKnexAdminUsers(),
        sessionSecret: 'test-secret-at-least-32-chars-long!',
        resourcesDir: './resources',
      })

      await admin.seed({ email: 'admin@test.com', password: 'password' })

      expect(db.calls.some((call) => call.method === 'insert')).toBe(false)
    })
  })
})

function makeKnexAdminUsers() {
  return defineKnexAdminUsers('admin_users', [
    { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
    { name: 'email', sqlName: 'email', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
    { name: 'passwordHash', sqlName: 'password_hash', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
    { name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
    { name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
  ])
}

class SeedKnex {
  calls: Array<{ method: string; args: unknown[] }> = []
  firstRow: Record<string, unknown> | undefined

  instance = (() => new SeedQuery(this)) as unknown as AnyKnexDatabase
}

class SeedQuery {
  constructor(private readonly db: SeedKnex) {}

  select(...args: unknown[]) {
    this.db.calls.push({ method: 'select', args })
    return this
  }

  where(...args: unknown[]) {
    this.db.calls.push({ method: 'where', args })
    return this
  }

  first() {
    this.db.calls.push({ method: 'first', args: [] })
    return Promise.resolve(this.db.firstRow)
  }

  insert(values: Record<string, unknown>) {
    this.db.calls.push({ method: 'insert', args: [values] })
    return Promise.resolve(1)
  }
}
