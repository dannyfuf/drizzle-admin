import { Hono } from 'hono'
import type { AdminBackend } from '@/backends/types.ts'
import type { ResourceDefinition, MemberAction, CollectionAction } from '@/resources/types.ts'
import { validateCsrf } from '@/auth/csrf.ts'
import { setFlash } from '@/utils/flash.ts'
import { slugify } from '@/views/components/actions.ts'
import { adminUrl } from '@/utils/url.ts'

export interface ActionRoutesConfig<ActionDatabase = unknown, TableRef = unknown> {
  backend: AdminBackend<ActionDatabase, TableRef>
  resource: ResourceDefinition<TableRef, ActionDatabase>
  sessionSecret: string
  basePath: string
}

export function createActionRoutes<ActionDatabase = unknown, TableRef = unknown>(config: ActionRoutesConfig<ActionDatabase, TableRef>): Hono {
  const { backend, resource, sessionSecret, basePath } = config
  const app = new Hono()
  const actionContext = () => backend.getActionContext?.(resource) ?? backend.actionDatabase

  // Member action routes: POST /:id/actions/:actionName
  app.post('/:id/actions/:actionName', async (c) => {
    const id = c.req.param('id')
    const actionName = c.req.param('actionName')

    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/${id}`))
    }

    const action = findMemberAction(resource, actionName)
    if (!action) {
      setFlash(c, 'error', `Action "${actionName}" not found.`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/${id}`))
    }

    try {
      await action.handler(id, actionContext())
      setFlash(c, 'success', `${action.name} completed successfully.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `${action.name} failed: ${message}`)
    }

    return c.redirect(adminUrl(basePath, `/${resource.routePath}/${id}`))
  })

  // Collection action routes: POST /actions/:actionName
  app.post('/actions/:actionName', async (c) => {
    const actionName = c.req.param('actionName')

    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(adminUrl(basePath, `/${resource.routePath}`))
    }

    const action = findCollectionAction(resource, actionName)
    if (!action) {
      setFlash(c, 'error', `Action "${actionName}" not found.`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}`))
    }

    try {
      const result = await action.handler(c, actionContext())

      if (result instanceof Response) {
        return result
      }

      setFlash(c, 'success', `${action.name} completed successfully.`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}`))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `${action.name} failed: ${message}`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}`))
    }
  })

  return app
}

function findMemberAction<ActionDatabase>(
  resource: ResourceDefinition<unknown, ActionDatabase>,
  slugName: string,
): MemberAction<ActionDatabase> | undefined {
  return resource.options.memberActions?.find(a => slugify(a.name) === slugName)
}

function findCollectionAction<ActionDatabase>(
  resource: ResourceDefinition<unknown, ActionDatabase>,
  slugName: string,
): CollectionAction<ActionDatabase> | undefined {
  return resource.options.collectionActions?.find(a => slugify(a.name) === slugName)
}
