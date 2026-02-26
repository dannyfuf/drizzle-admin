import { Hono } from 'hono'
import type { ResourceDefinition, MemberAction, CollectionAction } from '../resources/types.js'
import { validateCsrf } from '../auth/csrf.js'
import { setFlash } from '../utils/flash.js'
import { slugify } from '../views/components/actions.js'

interface ActionRoutesConfig {
  db: any
  resource: ResourceDefinition
  sessionSecret: string
}

export function createActionRoutes(config: ActionRoutesConfig): Hono {
  const { db, resource, sessionSecret } = config
  const app = new Hono()

  // Member action routes: POST /:id/actions/:actionName
  app.post('/:id/actions/:actionName', async (c) => {
    const id = c.req.param('id')
    const actionName = c.req.param('actionName')

    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}/${id}`)
    }

    const action = findMemberAction(resource, actionName)
    if (!action) {
      setFlash(c, 'error', `Action "${actionName}" not found.`)
      return c.redirect(`/${resource.routePath}/${id}`)
    }

    try {
      await action.handler(id, db)
      setFlash(c, 'success', `${action.name} completed successfully.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `${action.name} failed: ${message}`)
    }

    return c.redirect(`/${resource.routePath}/${id}`)
  })

  // Collection action routes: POST /actions/:actionName
  app.post('/actions/:actionName', async (c) => {
    const actionName = c.req.param('actionName')

    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}`)
    }

    const action = findCollectionAction(resource, actionName)
    if (!action) {
      setFlash(c, 'error', `Action "${actionName}" not found.`)
      return c.redirect(`/${resource.routePath}`)
    }

    try {
      const result = await action.handler(c, db)

      if (result instanceof Response) {
        return result
      }

      setFlash(c, 'success', `${action.name} completed successfully.`)
      return c.redirect(`/${resource.routePath}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `${action.name} failed: ${message}`)
      return c.redirect(`/${resource.routePath}`)
    }
  })

  return app
}

function findMemberAction(resource: ResourceDefinition, slugName: string): MemberAction | undefined {
  return resource.options.memberActions?.find(a => slugify(a.name) === slugName)
}

function findCollectionAction(resource: ResourceDefinition, slugName: string): CollectionAction | undefined {
  return resource.options.collectionActions?.find(a => slugify(a.name) === slugName)
}
