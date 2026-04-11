import { describe, it, expect } from 'vitest'
import { defineConfig } from '@/config.ts'

describe('defineConfig', () => {
  it('returns the exact same config object passed in', () => {
    const config = {
      db: {},
      dialect: 'postgresql' as const,
      adminUsers: { id: {}, email: {}, passwordHash: {}, createdAt: {}, updatedAt: {} },
      sessionSecret: 'secret',
      resourcesDir: './resources',
    }
    const result = defineConfig(config)
    expect(result).toBe(config)
  })

  it('preserves all config properties', () => {
    const config = {
      db: { fake: true },
      dialect: 'postgresql' as const,
      adminUsers: { id: {}, email: {}, passwordHash: {}, createdAt: {}, updatedAt: {} },
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
