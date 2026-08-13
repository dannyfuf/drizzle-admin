import { Hono } from 'hono'
import type { Context } from 'hono'
import type { AdminBackend } from '@/backends/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import {
  buildFilterQuery,
  getDeclaredFilters,
  parseDeclaredFilterValues,
  type DeclaredFilter,
  type ParsedFilter,
} from '@/resources/filters.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import { buildSortQuery, isSortableColumn, parseSortState } from '@/resources/sort.ts'
import { setFlash, getFlash } from '@/utils/flash.ts'
import { setCsrfCookie, validateCsrf } from '@/auth/csrf.ts'
import { layout } from '@/views/layout.ts'
import { getVisibleColumns, indexView } from '@/views/index.ts'
import { showView } from '@/views/show.ts'
import { formView } from '@/views/form.ts'
import { createActionRoutes } from '@/routes/actions.ts'
import { getAdmin } from '@/auth/middleware.ts'
import { adminUrl } from '@/utils/url.ts'
import type { ReferencedByRoute } from '@/views/components/referenced-by-link.ts'

interface CrudRoutesConfig<ActionDatabase = unknown, TableRef = unknown> {
  backend: AdminBackend<ActionDatabase, TableRef>
  resource: ResourceDefinition<TableRef, ActionDatabase>
  sessionSecret: string
  allResources: ResourceDefinition<TableRef, ActionDatabase>[]
  basePath: string
}

export function createCrudRoutes<ActionDatabase = unknown, TableRef = unknown>(config: CrudRoutesConfig<ActionDatabase, TableRef>): Hono {
  const { backend, resource, sessionSecret, allResources, basePath } = config
  const app = new Hono()
  const columns = resource.columns
  const declaredFilters = getDeclaredFilters(resource, columns)
  const perPage = resource.options.index?.perPage ?? 20
  const sortableColumns = getVisibleColumns(columns, resource.options.index).filter(isSortableColumn)
  const referenceRoutes = buildReferenceRoutes(columns, allResources)
  const referencedByRoutes = buildReferencedByRoutes(resource, allResources)

  // GET / - Index
  app.get('/', async (c) => {
    const page = parsePageNumber(c.req.query('page'))
    const offset = (page - 1) * perPage
    const filterState = buildIndexFilterState({
      declaredFilters,
      getQueryValue: (queryKey) => c.req.query(queryKey) ?? undefined,
    })
    const sort = parseSortState({
      rawColumn: c.req.query('sort'),
      rawDirection: c.req.query('order'),
      sortableColumns,
    })

    const count = await backend.count(resource, filterState.activeFilters)
    const totalPages = Math.ceil(count / perPage)

    const records = await backend.list(resource, {
      filters: filterState.activeFilters,
      limit: perPage,
      offset,
      sort,
    })

    const flash = getFlash(c)
    const admin = getAdmin(c)
    const csrfToken = await setCsrfCookie(c, sessionSecret)
    const baseUrl = adminUrl(basePath, `/${resource.routePath}`)

    const content = indexView({
      resource,
      columns,
      records,
      filters: declaredFilters,
      activeFilterQuery: filterState.activeFilterQuery,
      sort,
      pagination: {
        currentPage: page,
        totalPages,
        baseUrl,
        query: { ...filterState.activeFilterQuery, ...buildSortQuery(sort) },
      },
      csrfToken,
      basePath,
      referenceRoutes,
      referencedByRoutes,
    })

    return c.html(layout({
      title: `${resource.displayName}s`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
      basePath,
      csrfToken,
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
      basePath,
    })

    return c.html(layout({
      title: `Create ${resource.displayName}`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
      basePath,
      csrfToken,
    }))
  })

  // POST / - Create
  app.post('/', async (c) => {
    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/new`))
    }

    const body = await c.req.parseBody()
    const values = parseFormValues(body, columns, resource.options.permitParams)

    try {
      const created = await backend.insert(resource, values)
      setFlash(c, 'success', `${resource.displayName} created successfully.`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/${created[resource.primaryKey]}`))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `Failed to create: ${message}`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/new`))
    }
  })

  // GET /:id - Show
  app.get('/:id', async (c) => {
    const id = c.req.param('id')
    const record = await backend.findById(resource, id)

    if (!record) {
      return c.html(render404(resource, basePath), 404)
    }

    const flash = getFlash(c)
    const admin = getAdmin(c)
    const csrfToken = await setCsrfCookie(c, sessionSecret)

    const { content, modals } = showView({
      resource,
      columns,
      record,
      csrfToken,
      basePath,
      referenceRoutes,
      referencedByRoutes,
    })

    return c.html(layout({
      title: `${resource.displayName} #${id}`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
      basePath,
      csrfToken,
      flash,
      modals,
    }))
  })

  // GET /:id/edit - Edit form
  app.get('/:id/edit', async (c) => {
    const id = c.req.param('id')
    const record = await backend.findById(resource, id)

    if (!record) {
      return c.html(render404(resource, basePath), 404)
    }

    const csrfToken = await setCsrfCookie(c, sessionSecret)
    const admin = getAdmin(c)

    const content = formView({
      resource,
      columns,
      record,
      csrfToken,
      basePath,
    })

    return c.html(layout({
      title: `Edit ${resource.displayName} #${id}`,
      content,
      admin,
      resources: allResources,
      currentPath: `/${resource.routePath}`,
      basePath,
      csrfToken,
    }))
  })

  // POST /:id - Update or Delete (method override)
  app.post('/:id', async (c) => {
    const method = c.req.query('_method')
    const id = c.req.param('id')

    // CSRF is validated before dispatch so the method override cannot route
    // around it: deletes need the double-submit token just like updates.
    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      const target = method === 'DELETE'
        ? `/${resource.routePath}/${id}`
        : `/${resource.routePath}/${id}/edit`
      return c.redirect(adminUrl(basePath, target))
    }

    if (method === 'DELETE') {
      return handleDelete(c)
    }

    const body = await c.req.parseBody()
    const values = parseFormValues(body, columns, resource.options.permitParams)
    const updatedAtColumn = columns.find((column) => column.name === 'updatedAt' || column.name === 'updated_at')
    if (updatedAtColumn) {
      values[updatedAtColumn.name] = new Date()
    }

    try {
      await backend.update(resource, id, values)
      setFlash(c, 'success', `${resource.displayName} updated successfully.`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/${id}`))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `Failed to update: ${message}`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/${id}/edit`))
    }
  })

  async function handleDelete(c: Context) {
    const id = c.req.param('id')

    if (!id) {
      return c.html(render404(resource, basePath), 404)
    }

    try {
      await backend.delete(resource, id)
      setFlash(c, 'success', `${resource.displayName} deleted successfully.`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}`))
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setFlash(c, 'error', `Failed to delete: ${message}`)
      return c.redirect(adminUrl(basePath, `/${resource.routePath}/${id}`))
    }
  }

  // Mount action routes
  const actionRoutes = createActionRoutes({
    backend,
    resource,
    sessionSecret,
    basePath,
  })
  app.route('/', actionRoutes)

  return app
}

function buildReferenceRoutes<TableRef, ActionDatabase>(
  columns: ColumnMeta[],
  allResources: ResourceDefinition<TableRef, ActionDatabase>[],
): Record<string, string> {
  const routes: Record<string, string> = {}

  for (const column of columns) {
    if (!column.references) continue
    const target = allResources.find((candidate) => candidate.tableName === column.references?.table)
    if (target) routes[column.name] = target.routePath
  }

  return routes
}

export function buildReferencedByRoutes<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  allResources: ResourceDefinition<TableRef, ActionDatabase>[],
): ReferencedByRoute[] {
  const routes: ReferencedByRoute[] = []

  for (const [label, config] of Object.entries(resource.options.referencedBy ?? {})) {
    const child = allResources.find((candidate) => candidate.tableName === config.table)
    if (!child) continue

    const foreignKeyColumn = child.columns.find((column) => column.name === config.foreignKey)
    const referencedColumn = foreignKeyColumn?.references?.column
    const parentKeyName = resource.columns.find((column) => column.sqlName === referencedColumn)?.name
      ?? referencedColumn
      ?? resource.primaryKey

    routes.push({
      label,
      childRoutePath: child.routePath,
      foreignKey: config.foreignKey,
      parentKeyName,
    })
  }

  return routes
}

export interface IndexFilterState {
  activeFilters: ParsedFilter[]
  activeFilterQuery: Record<string, string>
}

interface BuildIndexFilterStateOptions {
  declaredFilters: DeclaredFilter[]
  getQueryValue: (queryKey: string) => string | undefined
}

export function buildIndexFilterState(options: BuildIndexFilterStateOptions): IndexFilterState {
  const { declaredFilters, getQueryValue } = options
  const activeFilters = parseDeclaredFilterValues(declaredFilters, getQueryValue)

  return {
    activeFilters,
    activeFilterQuery: buildFilterQuery(activeFilters),
  }
}

export function parsePageNumber(rawValue: string | undefined): number {
  const page = Number.parseInt(rawValue ?? '1', 10)
  return Number.isNaN(page) || page < 1 ? 1 : page
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

export function render404<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  basePath: string = '',
): string {
  return `
    <div class="text-center py-12">
      <h2 class="text-xl font-semibold text-zinc-100">Not Found</h2>
      <p class="text-zinc-400 mt-2">${resource.displayName} not found.</p>
      <a href="${adminUrl(basePath, `/${resource.routePath}`)}" class="text-zinc-100 underline mt-4 inline-block">Back to list</a>
    </div>
  `
}
