import { describe, it, expect } from 'vitest'
import type { Hono } from 'hono'
import type { DrizzleAdminHandler } from '@/DrizzleAdmin.ts'
import { honoAdapter } from '@/adapters/hono.ts'

describe('honoAdapter', () => {
  it('returns the handler app directly', () => {
    const mockApp = { fetch: () => new Response() } as unknown as Hono
    const handler: DrizzleAdminHandler = {
      app: mockApp,
      fetch: mockApp.fetch,
    }

    const result = honoAdapter(handler)
    expect(result).toBe(mockApp)
  })
})
