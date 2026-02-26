# Stage 6: Custom Actions

**Part of:** [DrizzleAdmin Implementation Plan](./plan-drizzle-admin-2026-02-26.md)
**Depends on:** [Stage 5: CRUD Operations](./plan-stage-5-crud.md)

## Summary

Implement custom member and collection actions. Member actions operate on a single record (displayed on show/edit pages), collection actions operate on the resource as a whole (displayed on index page). This stage also adds confirmation modals for destructive actions.

## Prerequisites

- Stage 5 completed
- CRUD routes working
- Views rendering correctly

## Scope

**IN scope:**
- Member action execution and display
- Collection action execution and display
- Confirmation modal component
- Action routes
- Flash messages after action execution

**OUT of scope:**
- Bulk actions (select multiple records)
- Async/background actions
- Action permissions/roles

---

## Task Breakdown

### 6.1 Confirmation Modal Component
**Complexity:** Medium
**Files:** `src/views/components/modal.ts`

HTML/CSS/vanilla JS modal for confirming destructive actions.

```ts
import { styles } from '../styles'
import { escapeHtml } from './flash'

let modalId = 0

export interface ConfirmModalProps {
  id?: string
  title: string
  message: string
  confirmLabel?: string
  confirmVariant?: 'danger' | 'primary'
  formAction: string
  csrfToken: string
}

export function confirmModal(props: ConfirmModalProps): string {
  const {
    title,
    message,
    confirmLabel = 'Confirm',
    confirmVariant = 'danger',
    formAction,
    csrfToken,
  } = props

  const id = props.id ?? `modal-${++modalId}`
  const confirmClass = confirmVariant === 'danger' ? styles.btnDanger : styles.btnPrimary

  return `
    <div id="${id}" class="fixed inset-0 z-50 hidden" aria-modal="true" role="dialog">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60" onclick="closeModal('${id}')"></div>

      <!-- Modal -->
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div class="${styles.card} w-full max-w-md p-6 relative">
          <h3 class="text-lg font-semibold text-zinc-100">${escapeHtml(title)}</h3>
          <p class="${styles.textMuted} mt-2">${escapeHtml(message)}</p>

          <div class="flex items-center justify-end gap-2 mt-6">
            <button type="button" onclick="closeModal('${id}')" class="${styles.btnGhost}">
              Cancel
            </button>
            <form method="POST" action="${formAction}" class="inline">
              <input type="hidden" name="_csrf" value="${csrfToken}">
              <button type="submit" class="${confirmClass}">
                ${escapeHtml(confirmLabel)}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  `
}

// Trigger button that opens a modal
export function modalTrigger(modalId: string, label: string, variant: 'danger' | 'secondary' = 'secondary'): string {
  const className = variant === 'danger' ? styles.btnDanger : styles.btnSecondary

  return `
    <button type="button" onclick="openModal('${modalId}')" class="${className}">
      ${escapeHtml(label)}
    </button>
  `
}

// JavaScript for modal open/close (included once in layout)
export const modalScript = `
<script>
  function openModal(id) {
    document.getElementById(id).classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  function closeModal(id) {
    document.getElementById(id).classList.add('hidden');
    document.body.classList.remove('overflow-hidden');
  }

  // Close on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('[role="dialog"]:not(.hidden)').forEach(modal => {
        closeModal(modal.id);
      });
    }
  });
</script>
`
```

**Acceptance criteria:**
- [ ] Modal renders with backdrop
- [ ] Clicking backdrop closes modal
- [ ] Escape key closes modal
- [ ] Form submits to specified action
- [ ] CSRF token included

---

### 6.2 Action Button Rendering
**Complexity:** Medium
**Files:** `src/views/components/actions.ts`

Render member and collection action buttons with modals.

```ts
import type { MemberAction, CollectionAction, ResourceDefinition } from '../../resources/types'
import { confirmModal, modalTrigger } from './modal'
import { escapeHtml } from './flash'
import { styles } from '../styles'

export interface MemberActionsProps {
  resource: ResourceDefinition
  recordId: string | number
  csrfToken: string
}

export function renderMemberActions(props: MemberActionsProps): { buttons: string; modals: string } {
  const { resource, recordId, csrfToken } = props
  const actions = resource.options.memberActions ?? []

  if (actions.length === 0) {
    return { buttons: '', modals: '' }
  }

  const buttons: string[] = []
  const modals: string[] = []

  for (const action of actions) {
    const actionSlug = slugify(action.name)
    const actionUrl = `/${resource.routePath}/${recordId}/actions/${actionSlug}`
    const modalId = `modal-${actionSlug}-${recordId}`
    const isDestructive = action.destructive !== false  // default true

    if (isDestructive) {
      // Show confirmation modal
      buttons.push(modalTrigger(modalId, action.name, 'danger'))
      modals.push(confirmModal({
        id: modalId,
        title: action.name,
        message: `Are you sure you want to ${action.name.toLowerCase()} this ${resource.displayName.toLowerCase()}?`,
        confirmLabel: action.name,
        confirmVariant: 'danger',
        formAction: actionUrl,
        csrfToken,
      }))
    } else {
      // Direct form submit
      buttons.push(`
        <form method="POST" action="${actionUrl}" class="inline">
          <input type="hidden" name="_csrf" value="${csrfToken}">
          <button type="submit" class="${styles.btnSecondary}">
            ${escapeHtml(action.name)}
          </button>
        </form>
      `)
    }
  }

  return {
    buttons: buttons.join(''),
    modals: modals.join(''),
  }
}

export interface CollectionActionsProps {
  resource: ResourceDefinition
  csrfToken: string
}

export function renderCollectionActions(props: CollectionActionsProps): string {
  const { resource, csrfToken } = props
  const actions = resource.options.collectionActions ?? []

  if (actions.length === 0) {
    return ''
  }

  return actions.map(action => {
    const actionSlug = slugify(action.name)
    const actionUrl = `/${resource.routePath}/actions/${actionSlug}`

    return `
      <form method="POST" action="${actionUrl}" class="inline">
        <input type="hidden" name="_csrf" value="${csrfToken}">
        <button type="submit" class="${styles.btnSecondary}">
          ${escapeHtml(action.name)}
        </button>
      </form>
    `
  }).join('')
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
}

export { slugify }
```

**Acceptance criteria:**
- [ ] Member actions render on show/edit pages
- [ ] Destructive actions show modal
- [ ] Non-destructive actions submit directly
- [ ] Collection actions render on index page
- [ ] Action slugs derived from names

---

### 6.3 Action Routes
**Complexity:** High
**Files:** `src/routes/actions.ts`

Route handlers for executing custom actions.

```ts
import { Hono, Context } from 'hono'
import type { ResourceDefinition, MemberAction, CollectionAction } from '../resources/types'
import { validateCsrf } from '../auth/csrf'
import { setFlash } from '../utils/flash'
import { slugify } from '../views/components/actions'

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

    // Validate CSRF
    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}/${id}`)
    }

    // Find action
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

    // Validate CSRF
    const csrfValid = await validateCsrf(c, sessionSecret)
    if (!csrfValid) {
      setFlash(c, 'error', 'Invalid request. Please try again.')
      return c.redirect(`/${resource.routePath}`)
    }

    // Find action
    const action = findCollectionAction(resource, actionName)
    if (!action) {
      setFlash(c, 'error', `Action "${actionName}" not found.`)
      return c.redirect(`/${resource.routePath}`)
    }

    try {
      const result = await action.handler(c, db)

      // If handler returns a Response, use it
      if (result instanceof Response) {
        return result
      }

      // Otherwise, redirect with success message
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
```

**Acceptance criteria:**
- [ ] POST `/:id/actions/:name` executes member action
- [ ] POST `/actions/:name` executes collection action
- [ ] CSRF validation on all actions
- [ ] Flash messages for success/failure
- [ ] Collection actions can return custom Response
- [ ] Unknown actions return error

---

### 6.4 Integrate Actions into Views
**Complexity:** Medium
**Files:** `src/views/show.ts`, `src/views/index.ts`, `src/views/layout.ts` (updates)

Add action buttons and modals to views.

**Update `src/views/show.ts`:**
```ts
import { renderMemberActions } from './components/actions'

export interface ShowViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  record: Record<string, unknown>
  csrfToken: string  // NEW
}

export function showView(props: ShowViewProps): { content: string; modals: string } {
  const { resource, columns, record, csrfToken } = props
  const id = record.id

  // Get member action buttons and modals
  const { buttons: actionButtons, modals } = renderMemberActions({
    resource,
    recordId: id,
    csrfToken,
  })

  // Update action bar to include custom actions
  const actionBar = `
    <div class="flex items-center gap-2">
      ${actionButtons}
      ${linkButton({ label: 'Edit', href: `/${resource.routePath}/${id}/edit`, variant: 'secondary' })}
      <!-- Delete with confirmation -->
      ${modalTrigger(`delete-${id}`, 'Delete', 'danger')}
      ${linkButton({ label: 'Back to list', href: `/${resource.routePath}`, variant: 'ghost' })}
    </div>
  `

  // Add delete modal
  const deleteModal = confirmModal({
    id: `delete-${id}`,
    title: 'Delete ' + resource.displayName,
    message: `Are you sure you want to delete this ${resource.displayName.toLowerCase()}? This action cannot be undone.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    formAction: `/${resource.routePath}/${id}?_method=DELETE`,
    csrfToken,
  })

  // ... rest of view

  return {
    content: `${actionBar}${detailCard}`,
    modals: modals + deleteModal,
  }
}
```

**Update `src/views/index.ts`:**
```ts
import { renderCollectionActions } from './components/actions'

export interface IndexViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  records: Record<string, unknown>[]
  pagination: PaginationProps
  csrfToken: string  // NEW
}

export function indexView(props: IndexViewProps): string {
  const { resource, columns, records, pagination, csrfToken } = props

  // Collection actions
  const collectionActions = renderCollectionActions({ resource, csrfToken })

  // Action bar with collection actions
  const actionBar = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        ${linkButton({ label: 'Create New', href: `/${resource.routePath}/new`, variant: 'primary' })}
        ${collectionActions}
      </div>
    </div>
  `

  // ... rest of view
}
```

**Update `src/views/layout.ts` to include modal script:**
```ts
import { modalScript } from './components/modal'

export function layout(props: LayoutProps): string {
  // ...

  return `
<!DOCTYPE html>
<!-- ... -->
<body>
  <!-- ... content ... -->

  ${props.modals ?? ''}
  ${modalScript}
</body>
</html>
`
}
```

**Acceptance criteria:**
- [ ] Member actions appear on show page
- [ ] Collection actions appear on index page
- [ ] Delete button uses modal
- [ ] Modal script included in layout
- [ ] Modals appended at end of body

---

### 6.5 Wire Action Routes
**Complexity:** Low
**Files:** `src/routes/crud.ts` (update)

Add action routes to resource router.

```ts
import { createActionRoutes } from './actions'

export function createCrudRoutes(config: CrudRoutesConfig): Hono {
  const app = new Hono()

  // ... existing CRUD routes ...

  // Mount action routes
  const actionRoutes = createActionRoutes({
    db: config.db,
    resource: config.resource,
    sessionSecret: config.sessionSecret,
  })
  app.route('/', actionRoutes)

  return app
}
```

**Acceptance criteria:**
- [ ] Action routes mounted under resource path
- [ ] Member actions at `/:id/actions/:name`
- [ ] Collection actions at `/actions/:name`

---

### 6.6 Export CSV Example Action
**Complexity:** Low
**Files:** `src/actions/csv.ts` (optional utility)

Optional: Provide a reusable CSV export action.

```ts
import { Context } from 'hono'
import { getTableName } from 'drizzle-orm'

export function createCsvExportAction(table: unknown) {
  return {
    name: 'Export CSV',
    handler: async (c: Context, db: any) => {
      const tableName = getTableName(table as any)
      const records = await db.select().from(table as any)

      if (records.length === 0) {
        return c.text('No records to export', 200)
      }

      // Generate CSV
      const headers = Object.keys(records[0])
      const rows = records.map((r: any) =>
        headers.map(h => escapeCSV(r[h])).join(',')
      )
      const csv = [headers.join(','), ...rows].join('\n')

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${tableName}.csv"`,
        },
      })
    },
  }
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
```

Usage in consumer code:
```ts
import { defineResource } from 'drizzle-admin'
import { createCsvExportAction } from 'drizzle-admin/actions/csv'
import { cards } from '../db/tables/cards'

export default defineResource(cards, {
  collectionActions: [
    createCsvExportAction(cards),
  ],
})
```

**Acceptance criteria:**
- [ ] Downloads CSV file
- [ ] Correct Content-Type header
- [ ] Proper CSV escaping
- [ ] Empty state handled

---

## Testing Strategy

### Unit Tests to Write

| Test File | Coverage |
|-----------|----------|
| `src/views/components/modal.test.ts` | Modal HTML, script |
| `src/views/components/actions.test.ts` | Button rendering, slugification |
| `src/routes/actions.test.ts` | Action execution, error handling |

### Integration Tests

Test full action flow:
- Click member action button → modal appears
- Confirm → action executes → flash message
- Cancel → modal closes
- Click collection action → executes → redirect
- Test with custom Response return

### Manual Verification

1. Define a resource with member action (e.g., "Archive")
2. Define a collection action (e.g., "Export CSV")
3. View a record, click Archive, confirm
4. Verify flash message and action executed
5. Go to index, click Export CSV
6. Verify file downloads

---

## Definition of Done

- [ ] All 6 subtasks completed
- [ ] `pnpm test` passes all tests
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] Member actions work with confirmation modal
- [ ] Collection actions work and can return custom responses
- [ ] Delete uses modal instead of browser confirm()
- [ ] CSV export action works as example
