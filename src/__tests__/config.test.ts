import { describe, it, expect } from 'vitest'
import { defineConfig } from '@/config.ts'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyKnexDatabase, AnyPgDatabase } from '@/types.ts'
import { defineKnexAdminUsers } from '@/resources/define.ts'

describe('defineConfig', () => {
  it('returns the exact same config object passed in', () => {
    const config = {
      db: {} as AnyPgDatabase,
      dialect: 'postgresql' as const,
      adminUsers: { id: {}, email: {}, passwordHash: {}, createdAt: {}, updatedAt: {} } as unknown as PgTable,
      sessionSecret: 'secret',
      resourcesDir: './resources',
    }
    const result = defineConfig(config)
    expect(result).toBe(config)
  })

  it('preserves all config properties', () => {
    const config = {
      db: { fake: true } as unknown as AnyPgDatabase,
      dialect: 'postgresql' as const,
      adminUsers: { id: {}, email: {}, passwordHash: {}, createdAt: {}, updatedAt: {} } as unknown as PgTable,
      sessionSecret: 'my-secret',
      resourcesDir: '/path/to/resources',
      port: 4000,
    }
    const result = defineConfig(config)
    expect(result.port).toBe(4000)
    expect(result.sessionSecret).toBe('my-secret')
    expect(result.resourcesDir).toBe('/path/to/resources')
  })

  it('accepts Knex backend config', () => {
    const adminUsers = defineKnexAdminUsers('admin_users', [
      { name: 'id', sqlName: 'id', dataType: 'integer', isNullable: false, isPrimaryKey: true, hasDefault: true },
      { name: 'email', sqlName: 'email', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
      { name: 'passwordHash', sqlName: 'password_hash', dataType: 'text', isNullable: false, isPrimaryKey: false, hasDefault: false },
      { name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
      { name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isNullable: false, isPrimaryKey: false, hasDefault: true },
    ])
    const config = {
      backend: 'knex' as const,
      db: {} as AnyKnexDatabase,
      dialect: 'postgresql' as const,
      adminUsers,
      sessionSecret: 'secret',
      resourcesDir: './resources',
    }

    expect(defineConfig(config)).toBe(config)
  })
})
