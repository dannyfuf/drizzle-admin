import { Hono } from 'hono'
import type { Context } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { PgColumn, PgTable, TableConfig } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'

type PgTableWithColumns = PgTable<TableConfig> & Record<string, PgColumn>
import type { ResourceDefinition } from '@/resources/types.ts'
import type { ColumnMeta, DialectAdapter } from '@/dialects/types.ts'
import { setFlash, getFlash } from '@/utils/flash.ts'
import { setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { layout } from '@/views/layout.ts'
import { indexView } from '@/views/index.ts'
import { showView } from '@/views/show.ts'
import { formView } from '@/views/form.ts'
import { createActionRoutes } from '@/routes/actions.ts'
import { getAdmin } from '@/auth/middleware.ts'

interface CrudRoutesConfig {
  db: AnyPgDatabase
  resource: ResourceDefinition
  adapter: DialectAdapter
  sessionSecret: string
  allResources: ResourceDefinition[]
}

export function createCrudRoutes(config: CrudRoutesConfig): Hono {
  const { db, resource, adapter, sessionSecret, allResources } = config
  const app = new Hono()
  const table = resource.table as PgTableWithColumns
  const columns = adapter.extractColumns(resource.table)
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

  async function handleDelete(c: Context) {
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

export function parseFormValues(body: Record<string, string | File>, columns: ColumnMeta[], permitParams?: string[]): Record<string, unknown> {
  const values: Record<string, unknown> = {}

  for (const col of columns) {
    if (col.isPrimaryKey) continue
    if (col.name === 'createdAt' || col.name === 'created_at') continue
    if (col.name === 'updatedAt' || col.name === 'updated_at') continue
    if (permitParams && !permitParams.includes(col.name)) continue

    const rawValue = body[col.name]

    if (col.dataType === 'boolean') {
      values[col.name] = rawValue === 'true'
    } else if (col.dataType === 'integer') {
      values[col.name] = rawValue ? parseInt(String(rawValue), 10) : null
    } else if (col.dataType === 'json') {
      try {
        values[col.name] = rawValue ? JSON.parse(String(rawValue)) : null
      } catch {
        values[col.name] = null
      }
    } else if (col.dataType === 'timestamp') {
      values[col.name] = rawValue ? new Date(String(rawValue)) : null
    } else {
      values[col.name] = rawValue ?? null
    }
  }

  return values
}

export function render404(resource: ResourceDefinition): string {
  return `
    <div class="text-center py-12">
      <h2 class="text-xl font-semibold text-zinc-100">Not Found</h2>
      <p class="text-zinc-400 mt-2">${resource.displayName} not found.</p>
      <a href="/${resource.routePath}" class="text-zinc-100 underline mt-4 inline-block">Back to list</a>
    </div>
  `
}
