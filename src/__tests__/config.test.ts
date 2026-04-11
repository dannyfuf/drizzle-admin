import { describe, it, expect } from 'vitest'
import { defineConfig } from '@/config.ts'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'

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
})
