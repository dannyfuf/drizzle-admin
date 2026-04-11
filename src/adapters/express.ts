import type { IncomingMessage, ServerResponse } from 'node:http'
import { getRequestListener } from '@hono/node-server'
import type { DrizzleAdminHandler } from '@/DrizzleAdmin.ts'

type NodeMiddleware = (
  req: IncomingMessage,
  res: ServerResponse,
  next: (err?: unknown) => void,
) => void

/**
 * Converts a DrizzleAdminHandler into Express/Connect-compatible middleware.
 * Mount it with: expressApp.use('/admin', expressAdapter(handler))
 */
export function expressAdapter(handler: DrizzleAdminHandler): NodeMiddleware {
  const listener = getRequestListener(handler.fetch)

  return (req, res, _next) => {
    listener(req, res)
  }
}
