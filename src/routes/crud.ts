import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { ResourceDefinition } from '../resources/types.js'
import type { ColumnMeta, DialectAdapter } from '../dialects/types.js'
import { setFlash, getFlash } from '../utils/flash.js'
import { setCsrfCookie, validateCsrf } from '../auth/csrf.js'
import { layout } from '../views/layout.js'
import { indexView } from '../views/index.js'
import { showView } from '../views/show.js'
import { formView } from '../views/form.js'
import { createActionRoutes } from './actions.js'
import { getAdmin } from '../auth/middleware.js'

interface CrudRoutesConfig {
  db: any
  resource: ResourceDefinition
  adapter: DialectAdapter
  sessionSecret: string
  allResources: ResourceDefinition[]
}

export function createCrudRoutes(config: CrudRoutesConfig): Hono {
  const { db, resource, adapter, sessionSecret, allResources } = config
  const app = new Hono()
  const table = resource.table as any
  const columns = adapter.extractColumns(table)
  const perPage = resource.options.index?.perPage ?? 20

  // GET / - Index
  app.get('/', async (c) => {
    const page = parseInt(c.req.query('page') ?? '1', 10)
    const offset = (page - 1) * perPage

    const [{ count }] = await db.select({ count: sql`count(*)` }).from(table)
    const totalPages = Math.ceil(Number(count) / perPage)

    const records = await db.select().from(table).limit(perPage).offset(offset)

    const flash = getFlash(c)
    const admin = getAdmin(c)
    const csrfToken = await setCsrfCookie(c, sessionSecret)

    const content = indexView({
      resource,
      columns,
      records,
      pagination: { currentPage: page, totalPages, baseUrl: `/${resource.routePath}` },
      csrfToken,
    })

    return c.html(layout({
      title: `${resource.displayName}s`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
      flash,
    }))
  })

  // GET /new - Create form
  app.get('/new', async (c) => {
    const csrfToken = await setCsrfCookie(c, sessionSecret)
    const admin = getAdmin(c)

    const content = formView({
      resource,
      columns,
      csrfToken,
    })

    return c.html(layout({
      title: `Create ${resource.displayName}`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
    }))
  })

  // POST / - Create
  app.post('/', async (c) => {
    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}/new`)
    }

    const body = await c.req.parseBody()
    const values = parseFormValues(body, columns, resource.options.permitParams)

    try {
      const [created] = await db.insert(table).values(values).returning()
      setFlash(c, 'success', `${resource.displayName} created successfully.`)
      return c.redirect(`/${resource.routePath}/${created.id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `Failed to create: ${message}`)
      return c.redirect(`/${resource.routePath}/new`)
    }
  })

  // GET /:id - Show
  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1)

    if (!record) {
      return c.html(render404(resource), 404)
    }

    const flash = getFlash(c)
    const admin = getAdmin(c)
    const csrfToken = await setCsrfCookie(c, sessionSecret)

    const { content, modals } = showView({
      resource,
      columns,
      record,
      csrfToken,
    })

    return c.html(layout({
      title: `${resource.displayName} #${id}`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
      flash,
      modals,
    }))
  })

  // GET /:id/edit - Edit form
  app.get('/:id/edit', async (c) => {
    const id = c.req.param('id')
    const [record] = await db.select().from(table).where(eq(table.id, id)).limit(1)

    if (!record) {
      return c.html(render404(resource), 404)
    }

    const csrfToken = await setCsrfCookie(c, sessionSecret)
    const admin = getAdmin(c)

    const content = formView({
      resource,
      columns,
      record,
      csrfToken,
    })

    return c.html(layout({
      title: `Edit ${resource.displayName} #${id}`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
    }))
  })

  // POST /:id - Update or Delete (method override)
  app.post('/:id', async (c) => {
    const method = c.req.query('_method')
    if (method === 'DELETE') {
      return handleDelete(c)
    }

    const id = c.req.param('id')

    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}/${id}/edit`)
    }

    const body = await c.req.parseBody()
    const values = parseFormValues(body, columns, resource.options.permitParams)
    values.updatedAt = new Date()

    try {
      await db.update(table).set(values).where(eq(table.id, id))
      setFlash(c, 'success', `${resource.displayName} updated successfully.`)
      return c.redirect(`/${resource.routePath}/${id}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `Failed to update: ${message}`)
      return c.redirect(`/${resource.routePath}/${id}/edit`)
    }
  })

  async function handleDelete(c: any) {
    const id = c.req.param('id')

    try {
      await db.delete(table).where(eq(table.id, id))
      setFlash(c, 'success', `${resource.displayName} deleted successfully.`)
      return c.redirect(`/${resource.routePath}`)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `Failed to delete: ${message}`)
      return c.redirect(`/${resource.routePath}/${id}`)
    }
  }

  // Mount action routes
  const actionRoutes = createActionRoutes({
    db,
    resource,
    sessionSecret,
  })
  app.route('/', actionRoutes)

  return app
}

function parseFormValues(body: Record<string, any>, columns: ColumnMeta[], permitParams?: string[]): Record<string, any> {
  const values: Record<string, any> = {}

  for (const col of columns) {
    if (col.isPrimaryKey) continue
    if (col.name === 'createdAt' || col.name === 'created_at') continue
    if (permitParams && !permitParams.includes(col.name)) continue

    const rawValue = body[col.name]

    if (col.dataType === 'boolean') {
      values[col.name] = rawValue === 'true' || rawValue === true
    } else if (col.dataType === 'integer') {
      values[col.name] = rawValue ? parseInt(rawValue, 10) : null
    } else if (col.dataType === 'json') {
      try {
        values[col.name] = rawValue ? JSON.parse(rawValue) : null
      } catch {
        values[col.name] = null
      }
    } else if (col.dataType === 'timestamp') {
      values[col.name] = rawValue ? new Date(rawValue) : null
    } else {
      values[col.name] = rawValue ?? null
    }
  }

  return values
}

function render404(resource: ResourceDefinition): string {
  return `
    <div class="text-center py-12">
      <h2 class="text-xl font-semibold text-zinc-100">Not Found</h2>
      <p class="text-zinc-400 mt-2">${resource.displayName} not found.</p>
      <a href="/${resource.routePath}" class="text-zinc-100 underline mt-4 inline-block">Back to list</a>
    </div>
  `
}
