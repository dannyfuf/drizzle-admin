import type { ColumnMeta } from '../dialects/types.js'
import type { ResourceDefinition } from '../resources/types.js'
import { styles } from './styles.js'
import { escapeHtml } from './components/flash.js'
import { linkButton } from './components/button.js'
import { renderMemberActions } from './components/actions.js'
import { confirmModal, modalTrigger } from './components/modal.js'

export interface ShowViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  record: Record<string, unknown>
  csrfToken: string
}

export function showView(props: ShowViewProps): { content: string; modals: string } {
  const { resource, columns, record, csrfToken } = props
  const id = record.id

  const visibleColumns = getVisibleColumns(columns, resource.options.show)

  const { buttons: actionButtons, modals } = renderMemberActions({
    resource,
    recordId: id as string | number,
    csrfToken,
  })

  const deleteModalId = `delete-${id}`
  const deleteModal = confirmModal({
    id: deleteModalId,
    title: 'Delete ' + resource.displayName,
    message: `Are you sure you want to delete this ${resource.displayName.toLowerCase()}? This action cannot be undone.`,
    confirmLabel: 'Delete',
    confirmVariant: 'danger',
    formAction: `/${resource.routePath}/${id}?_method=DELETE`,
    csrfToken,
  })

  const actionBar = `
    <div class="flex items-center gap-2">
      ${actionButtons}
      ${linkButton({ label: 'Edit', href: `/${resource.routePath}/${id}/edit`, variant: 'secondary' })}
      ${modalTrigger(deleteModalId, 'Delete', 'danger')}
      ${linkButton({ label: 'Back to list', href: `/${resource.routePath}`, variant: 'ghost' })}
    </div>
  `

  const rows = visibleColumns.map(col => {
    const value = formatShowValue(record[col.name], col)
    return `
      <div class="py-3 border-b border-zinc-800 last:border-0">
        <dt class="text-sm ${styles.textMuted}">${formatColumnHeader(col.name)}</dt>
        <dd class="mt-1">${value}</dd>
      </div>
    `
  }).join('')

  const content = `
    ${actionBar}
    <div class="${styles.cardPadded} mt-4">
      <dl>
        ${rows}
      </dl>
    </div>
  `

  return {
    content,
    modals: modals + deleteModal,
  }
}

function getVisibleColumns(columns: ColumnMeta[], config?: { columns?: string[]; exclude?: string[] }): ColumnMeta[] {
  let result = columns

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
