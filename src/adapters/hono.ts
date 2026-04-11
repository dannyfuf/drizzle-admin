import type { Hono } from 'hono'
import type { DrizzleAdminHandler } from '@/DrizzleAdmin.ts'

/**
 * Returns the Hono sub-app from a DrizzleAdminHandler.
 * Mount it with: mainApp.route('/admin', honoAdapter(handler))
 */
export function honoAdapter(handler: DrizzleAdminHandler): Hono {
  return handler.app
}
