import { describe, it, expect } from 'vitest'
import type { DrizzleAdminHandler } from '@/DrizzleAdmin.ts'
import { expressAdapter } from '@/adapters/express.ts'

describe('expressAdapter', () => {
  it('returns a function (Node middleware)', () => {
    const handler: DrizzleAdminHandler = {
      app: {} as DrizzleAdminHandler['app'],
      fetch: async (req: Request) => new Response('ok'),
    }

    const middleware = expressAdapter(handler)
    expect(typeof middleware).toBe('function')
    // Express middleware signature: (req, res, next) => void
    expect(middleware.length).toBe(3)
  })
})
