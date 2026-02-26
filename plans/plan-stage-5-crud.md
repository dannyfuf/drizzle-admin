# Stage 5: CRUD Operations

**Part of:** [DrizzleAdmin Implementation Plan](./plan-drizzle-admin-2026-02-26.md)
**Depends on:** [Stage 4: View Layer](./plan-stage-4-views.md)

## Summary

Implement the 7 CRUD routes per resource: index (listing), show (detail), new (create form), create, edit (edit form), update, and destroy. This includes pagination, validation, and proper flash messaging.

## Prerequisites

- Stage 4 completed
- Resources loading correctly
- Views and layout working

## Scope

**IN scope:**
- All 7 CRUD routes per resource
- Paginated index view with table
- Show view with all field values
- Create/edit form with validation
- Delete functionality
- Flash messages after actions
- 404 handling for missing records

**OUT of scope:**
- Custom actions (Stage 6)
- Confirmation modals (Stage 6)
- Sorting/filtering (future)
- Bulk operations (future)

---

## Task Breakdown

### 5.1 Pagination Component
**Complexity:** Medium
**Files:** `src/views/components/pagination.ts`

Pagination controls for index view.

```ts
import { styles } from '../styles'

export interface PaginationProps {
  currentPage: number
  totalPages: number
  baseUrl: string  // e.g., '/cards'
}

export function renderPagination(props: PaginationProps): string {
  const { currentPage, totalPages, baseUrl } = props

  if (totalPages <= 1) return ''

  const pages: (number | '...')[] = []

  // Always show first page
  pages.push(1)

  // Show ellipsis if needed
  if (currentPage > 3) {
    pages.push('...')
  }

  // Pages around current
  for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
    if (!pages.includes(i)) {
      pages.push(i)
    }
  }

  // Show ellipsis if needed
  if (currentPage < totalPages - 2) {
    pages.push('...')
  }

  // Always show last page
  if (totalPages > 1 && !pages.includes(totalPages)) {
    pages.push(totalPages)
  }

  const pageLinks = pages.map(page => {
    if (page === '...') {
      return `<span class="${styles.textMuted} px-2">...</span>`
    }

    const isActive = page === currentPage
    const className = isActive
      ? 'px-3 py-1 rounded bg-zinc-700 text-zinc-100'
      : 'px-3 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100'

    return `<a href="${baseUrl}?page=${page}" class="${className}">${page}</a>`
  }).join('')

  const prevDisabled = currentPage === 1
  const nextDisabled = currentPage === totalPages

  return `
    <nav class="flex items-center justify-center gap-1 mt-6" aria-label="Pagination">
      <a
        href="${baseUrl}?page=${currentPage - 1}"
        class="px-3 py-1 rounded ${prevDisabled ? 'text-zinc-600 pointer-events-none' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
        ${prevDisabled ? 'aria-disabled="true"' : ''}
      >
        Previous
      </a>
      ${pageLinks}
      <a
        href="${baseUrl}?page=${currentPage + 1}"
        class="px-3 py-1 rounded ${nextDisabled ? 'text-zinc-600 pointer-events-none' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'}"
        ${nextDisabled ? 'aria-disabled="true"' : ''}
      >
        Next
      </a>
    </nav>
  `
}
```

**Acceptance criteria:**
- [ ] Shows page numbers with current highlighted
- [ ] Ellipsis for large page counts
- [ ] Previous/Next links
- [ ] Disabled state for first/last page
- [ ] Returns empty string for single page

---

### 5.2 Index View
**Complexity:** High
**Files:** `src/views/index.ts`

Table listing view for resources.

```ts
import type { ColumnMeta } from '../dialects/types'
import type { ResourceDefinition } from '../resources/types'
import { styles } from './styles'
import { escapeHtml } from './components/flash'
import { renderPagination, PaginationProps } from './components/pagination'
import { linkButton } from './components/button'

export interface IndexViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  records: Record<string, unknown>[]
  pagination: PaginationProps
}

export function indexView(props: IndexViewProps): string {
  const { resource, columns, records, pagination } = props

  // Filter columns based on resource options
  const visibleColumns = getVisibleColumns(columns, resource.options.index)

  // Action bar
  const actionBar = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        ${linkButton({ label: 'Create New', href: `/${resource.routePath}/new`, variant: 'primary' })}
      </div>
    </div>
  `

  // Empty state
  if (records.length === 0) {
    return `
      ${actionBar}
      <div class="${styles.cardPadded} text-center ${styles.textMuted}">
        No ${resource.displayName.toLowerCase()}s found.
      </div>
    `
  }

  // Table
  const headerCells = visibleColumns
    .map(col => `<th class="${styles.tableHeader} px-4 py-3">${formatColumnHeader(col.name)}</th>`)
    .join('')

  const rows = records.map(record => {
    const cells = visibleColumns
      .map(col => `<td class="${styles.tableCell}">${formatCellValue(record[col.name], col)}</td>`)
      .join('')

    const id = record.id
    const actions = `
      <td class="${styles.tableCell} text-right">
        <a href="/${resource.routePath}/${id}" class="${styles.btnGhost} text-sm">View</a>
        <a href="/${resource.routePath}/${id}/edit" class="${styles.btnGhost} text-sm">Edit</a>
      </td>
    `

    return `<tr class="${styles.tableRow}">${cells}${actions}</tr>`
  }).join('')

  return `
    ${actionBar}
    <div class="${styles.card} overflow-hidden mt-4">
      <table class="${styles.table}">
        <thead class="border-b border-zinc-800">
          <tr>${headerCells}<th class="${styles.tableHeader} px-4 py-3 text-right">Actions</th></tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    ${renderPagination(pagination)}
  `
}

function getVisibleColumns(columns: ColumnMeta[], config?: { columns?: string[]; exclude?: string[] }): ColumnMeta[] {
  let result = columns

  // Filter out password columns by default
  result = result.filter(col => !isPasswordColumn(col))

  if (config?.columns) {
    result = result.filter(col => config.columns!.includes(col.name))
  } else if (config?.exclude) {
    result = result.filter(col => !config.exclude!.includes(col.name))
  }

  return result
}

function isPasswordColumn(col: ColumnMeta): boolean {
  return col.name.toLowerCase().includes('password')
}

function formatColumnHeader(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

function formatCellValue(value: unknown, column: ColumnMeta): string {
  if (value === null || value === undefined) {
    return `<span class="${styles.textMuted}">—</span>`
  }

  if (column.dataType === 'timestamp' && value instanceof Date) {
    return escapeHtml(value.toLocaleString())
  }

  if (column.dataType === 'boolean') {
    return value ? '✓' : '✗'
  }

  if (column.dataType === 'json') {
    return `<code class="text-xs">${escapeHtml(JSON.stringify(value).slice(0, 50))}...</code>`
  }

  return escapeHtml(String(value))
}
```

**Acceptance criteria:**
- [ ] Displays table with all visible columns
- [ ] Respects column whitelist/blacklist config
- [ ] Hides password columns by default
- [ ] View/Edit action links per row
- [ ] Empty state message
- [ ] Pagination controls

---

### 5.3 Show View
**Complexity:** Medium
**Files:** `src/views/show.ts`

Record detail view.

```ts
import type { ColumnMeta } from '../dialects/types'
import type { ResourceDefinition } from '../resources/types'
import { styles } from './styles'
import { escapeHtml } from './components/flash'
import { linkButton } from './components/button'

export interface ShowViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  record: Record<string, unknown>
}

export function showView(props: ShowViewProps): string {
  const { resource, columns, record } = props
  const id = record.id

  // Filter columns
  const visibleColumns = getVisibleColumns(columns, resource.options.show)

  // Action bar
  const actionBar = `
    <div class="flex items-center gap-2">
      ${linkButton({ label: 'Edit', href: `/${resource.routePath}/${id}/edit`, variant: 'secondary' })}
      <form method="POST" action="/${resource.routePath}/${id}?_method=DELETE" class="inline">
        <button type="submit" class="${styles.btnDanger}" onclick="return confirm('Are you sure you want to delete this ${resource.displayName.toLowerCase()}?')">
          Delete
        </button>
      </form>
      ${linkButton({ label: 'Back to list', href: `/${resource.routePath}`, variant: 'ghost' })}
    </div>
  `

  // Detail card
  const rows = visibleColumns.map(col => {
    const value = formatShowValue(record[col.name], col)
    return `
      <div class="py-3 border-b border-zinc-800 last:border-0">
        <dt class="text-sm ${styles.textMuted}">${formatColumnHeader(col.name)}</dt>
        <dd class="mt-1">${value}</dd>
      </div>
    `
  }).join('')

  return `
    ${actionBar}
    <div class="${styles.cardPadded} mt-4">
      <dl>
        ${rows}
      </dl>
    </div>
  `
}

function getVisibleColumns(columns: ColumnMeta[], config?: { columns?: string[]; exclude?: string[] }): ColumnMeta[] {
  let result = columns

  // Filter out password columns by default
  result = result.filter(col => !col.name.toLowerCase().includes('password'))

  if (config?.columns) {
    result = result.filter(col => config.columns!.includes(col.name))
  } else if (config?.exclude) {
    result = result.filter(col => !config.exclude!.includes(col.name))
  }

  return result
}

function formatColumnHeader(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

function formatShowValue(value: unknown, column: ColumnMeta): string {
  if (value === null || value === undefined) {
    return `<span class="${styles.textMuted}">—</span>`
  }

  if (column.dataType === 'timestamp' && value instanceof Date) {
    return escapeHtml(value.toLocaleString())
  }

  if (column.dataType === 'boolean') {
    return value
      ? '<span class="text-emerald-400">Yes</span>'
      : '<span class="text-zinc-500">No</span>'
  }

  if (column.dataType === 'json') {
    return `<pre class="text-sm bg-zinc-800 p-3 rounded-lg overflow-auto max-h-48">${escapeHtml(JSON.stringify(value, null, 2))}</pre>`
  }

  return escapeHtml(String(value))
}
```

**Acceptance criteria:**
- [ ] Shows all visible fields as key-value pairs
- [ ] Edit and Delete buttons in action bar
- [ ] Back to list link
- [ ] Delete has confirmation dialog
- [ ] JSON fields displayed formatted
- [ ] Password fields hidden

---

### 5.4 Form View (Create/Edit)
**Complexity:** High
**Files:** `src/views/form.ts`

Shared form for create and edit.

```ts
import type { ColumnMeta } from '../dialects/types'
import type { ResourceDefinition } from '../resources/types'
import { styles } from './styles'
import { renderField } from './components/field'
import { button, linkButton } from './components/button'
import { csrfInput } from '../auth/csrf'

export interface FormViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  record?: Record<string, unknown>  // undefined for create
  csrfToken: string
  errors?: Record<string, string>
}

export function formView(props: FormViewProps): string {
  const { resource, columns, record, csrfToken, errors } = props

  const isEdit = !!record
  const id = record?.id
  const title = isEdit ? `Edit ${resource.displayName}` : `Create ${resource.displayName}`

  const actionUrl = isEdit
    ? `/${resource.routePath}/${id}?_method=PUT`
    : `/${resource.routePath}`

  // Filter to editable columns
  const editableColumns = columns.filter(col => !isAutoManaged(col))

  // Render form fields
  const fields = editableColumns.map(col => renderField({
    column: col,
    value: record?.[col.name],
    error: errors?.[col.name],
  })).join('')

  // Action bar (edit mode only)
  const actionBar = isEdit ? `
    <div class="flex items-center gap-2">
      ${linkButton({ label: 'View', href: `/${resource.routePath}/${id}`, variant: 'ghost' })}
      ${linkButton({ label: 'Back to list', href: `/${resource.routePath}`, variant: 'ghost' })}
    </div>
  ` : `
    <div class="flex items-center gap-2">
      ${linkButton({ label: 'Back to list', href: `/${resource.routePath}`, variant: 'ghost' })}
    </div>
  `

  return `
    ${actionBar}
    <div class="${styles.cardPadded} mt-4">
      <form method="POST" action="${actionUrl}" class="space-y-4">
        ${csrfInput(csrfToken)}

        ${fields}

        <div class="flex items-center gap-2 pt-4">
          ${button({ label: isEdit ? 'Update' : 'Create', type: 'submit', variant: 'primary' })}
          ${linkButton({ label: 'Cancel', href: `/${resource.routePath}`, variant: 'ghost' })}
        </div>
      </form>
    </div>
  `
}

function isAutoManaged(column: ColumnMeta): boolean {
  if (column.isPrimaryKey) return true
  if (['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(column.name)) {
    return column.hasDefault
  }
  return false
}
```

**Acceptance criteria:**
- [ ] Renders all editable fields
- [ ] Pre-fills values in edit mode
- [ ] Shows validation errors per field
- [ ] CSRF token included
- [ ] Correct action URL for create vs edit
- [ ] Cancel link back to list

---

### 5.5 CRUD Route Handler
**Complexity:** High
**Files:** `src/routes/crud.ts`

Generate all 7 CRUD routes for a resource.

```ts
import { Hono } from 'hono'
import { eq, sql } from 'drizzle-orm'
import type { ResourceDefinition } from '../resources/types'
import type { DialectAdapter } from '../dialects/types'
import { setFlash, getFlash } from '../utils/flash'
import { setCsrfCookie, validateCsrf } from '../auth/csrf'
import { layout } from '../views/layout'
import { indexView } from '../views/index'
import { showView } from '../views/show'
import { formView } from '../views/form'

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

    // Get total count
    const [{ count }] = await db.select({ count: sql`count(*)` }).from(table)
    const totalPages = Math.ceil(Number(count) / perPage)

    // Get records
    const records = await db.select().from(table).limit(perPage).offset(offset)

    const flash = getFlash(c)
    const admin = c.get('admin')

    const content = indexView({
      resource,
      columns,
      records,
      pagination: { currentPage: page, totalPages, baseUrl: `/${resource.routePath}` },
    })

    return c.html(layout({
      title: `${resource.displayName}s`,
      content,
      admin,
      resources: allResources,
      currentPath: c.req.path,
      flash,
    }))
  })

  // GET /new - Create form
  app.get('/new', async (c) => {
    const csrfToken = await setCsrfCookie(c, sessionSecret)
    const admin = c.get('admin')

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
      currentPath: c.req.path,
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
    const values = parseFormValues(body, columns)

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
    const admin = c.get('admin')

    const content = showView({
      resource,
      columns,
      record,
    })

    return c.html(layout({
      title: `${resource.displayName} #${id}`,
      content,
      admin,
      resources: allResources,
      currentPath: c.req.path,
      flash,
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
    const admin = c.get('admin')

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
      currentPath: c.req.path,
    }))
  })

  // POST /:id?_method=PUT - Update (method override)
  app.post('/:id', async (c) => {
    const method = c.req.query('_method')
    if (method === 'DELETE') {
      return handleDelete(c)
    }

    // PUT update
    const id = c.req.param('id')

    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}/${id}/edit`)
    }

    const body = await c.req.parseBody()
    const values = parseFormValues(body, columns)
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

  // DELETE handler (called via method override)
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

  return app
}

// Parse form body into values object
function parseFormValues(body: Record<string, any>, columns: ColumnMeta[]): Record<string, any> {
  const values: Record<string, any> = {}

  for (const col of columns) {
    if (col.isPrimaryKey) continue
    if (col.name === 'createdAt' || col.name === 'created_at') continue

    const rawValue = body[col.name]

    // Handle different types
    if (col.dataType === 'boolean') {
      values[col.name] = rawValue === 'true' || rawValue === true
    } else if (col.dataType === 'integer') {
      values[col.name] = rawValue ? parseInt(rawValue, 10) : null
    } else if (col.dataType === 'json') {
      values[col.name] = rawValue ? JSON.parse(rawValue) : null
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
```

**Acceptance criteria:**
- [ ] GET `/` lists records with pagination
- [ ] GET `/new` shows create form
- [ ] POST `/` creates record and redirects
- [ ] GET `/:id` shows record details
- [ ] GET `/:id/edit` shows edit form
- [ ] POST `/:id?_method=PUT` updates record
- [ ] POST `/:id?_method=DELETE` deletes record
- [ ] Flash messages set after each action
- [ ] 404 for missing records

---

### 5.6 Wire Routes into DrizzleAdmin
**Complexity:** Medium
**Files:** `src/DrizzleAdmin.ts` (update)

Register CRUD routes for all resources.

```ts
import { Hono } from 'hono'
import { createAuthRoutes } from './routes/auth'
import { createCrudRoutes } from './routes/crud'
import { authMiddleware } from './auth/middleware'
import { postgresqlAdapter } from './dialects/postgresql'
import { loginPage } from './views/login'

export class DrizzleAdmin<T extends MinimalAdminUsersTable> {
  private app: Hono

  constructor(config: DrizzleAdminConfig<T>) {
    // ... existing validation
    this.app = new Hono()
  }

  private setupRoutes(): void {
    const adapter = postgresqlAdapter  // Future: select based on dialect

    // Auth routes (public)
    const authRoutes = createAuthRoutes({
      db: this.config.db,
      adminUsers: this.config.adminUsers,
      sessionSecret: this.config.sessionSecret,
      renderLogin: (props) => loginPage(props),
    })
    this.app.route('/', authRoutes)

    // Protected routes
    this.app.use('/*', authMiddleware(this.config.sessionSecret))

    // Dashboard redirect
    this.app.get('/', (c) => {
      if (this.resources.length === 0) {
        return c.text('No resources configured')
      }
      return c.redirect(`/${this.resources[0].routePath}`)
    })

    // Resource CRUD routes
    for (const resource of this.resources) {
      const crudRoutes = createCrudRoutes({
        db: this.config.db,
        resource,
        adapter,
        sessionSecret: this.config.sessionSecret,
        allResources: this.resources,
      })
      this.app.route(`/${resource.routePath}`, crudRoutes)
    }
  }

  async start(): Promise<void> {
    await this.initialize()
    this.setupRoutes()

    const port = this.config.port ?? 3001
    console.log(`DrizzleAdmin running on http://localhost:${port}`)

    // Start Hono server
    const { serve } = await import('@hono/node-server')
    serve({
      fetch: this.app.fetch,
      port,
    })
  }
}
```

**Acceptance criteria:**
- [ ] Auth routes mounted at root
- [ ] Auth middleware protects all routes after `/login`
- [ ] Dashboard redirects to first resource
- [ ] Each resource gets its own route prefix
- [ ] Server starts on configured port

---

## Testing Strategy

### Unit Tests to Write

| Test File | Coverage |
|-----------|----------|
| `src/views/components/pagination.test.ts` | Pagination logic, edge cases |
| `src/views/index.test.ts` | Table rendering, column filtering |
| `src/views/show.test.ts` | Detail rendering |
| `src/views/form.test.ts` | Form field rendering |
| `src/routes/crud.test.ts` | Form parsing, route handlers |

### Integration Tests

Test full request/response cycle:
- GET `/cards` returns 200 with table
- GET `/cards/new` returns 200 with form
- POST `/cards` creates record, redirects
- GET `/cards/1` returns 200 with details
- GET `/cards/1/edit` returns 200 with form
- POST `/cards/1?_method=PUT` updates, redirects
- POST `/cards/1?_method=DELETE` deletes, redirects
- GET `/cards/999` returns 404

### Manual Verification

1. Start DrizzleAdmin with test database
2. Create a new record via form
3. View the created record
4. Edit the record
5. Delete the record
6. Test pagination with 50+ records
7. Verify flash messages appear after actions

---

## Definition of Done

- [ ] All 6 subtasks completed
- [ ] `pnpm test` passes all tests
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] All 7 CRUD operations work end-to-end
- [ ] Pagination works correctly
- [ ] Flash messages display properly
- [ ] 404 pages render for missing records
