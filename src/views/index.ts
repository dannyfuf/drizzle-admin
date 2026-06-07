import type { ColumnMeta } from '@/dialects/types.ts'
import type { DeclaredFilter } from '@/resources/filters.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import { styles } from '@/views/styles.ts'
import { escapeHtml } from '@/views/components/flash.ts'
import { renderPagination, PaginationProps } from '@/views/components/pagination.ts'
import { button, linkButton } from '@/views/components/button.ts'
import { renderCollectionActions } from '@/views/components/actions.ts'
import { adminUrl } from '@/utils/url.ts'

export interface IndexViewProps<TableRef = unknown, ActionDatabase = never> {
  resource: ResourceDefinition<TableRef, ActionDatabase>
  columns: ColumnMeta[]
  records: Record<string, unknown>[]
  filters: DeclaredFilter[]
  activeFilterQuery: Record<string, string>
  pagination: PaginationProps
  csrfToken: string
  basePath: string
}

export function indexView<TableRef, ActionDatabase>(props: IndexViewProps<TableRef, ActionDatabase>): string {
  const { resource, columns, records, filters, activeFilterQuery, pagination, csrfToken, basePath } = props

  const visibleColumns = getVisibleColumns(columns, resource.options.index)

  const collectionActions = renderCollectionActions({ resource, csrfToken, basePath })
  const filterForm = renderFilterForm({
    actionUrl: adminUrl(basePath, `/${resource.routePath}`),
    filters,
    activeFilterQuery,
  })

  const actionBar = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        ${linkButton({ label: 'Create New', href: adminUrl(basePath, `/${resource.routePath}/new`), variant: 'primary' })}
        ${collectionActions}
      </div>
    </div>
  `

  if (records.length === 0) {
    return `
      ${actionBar}
      ${filterForm}
      <div class="${styles.cardPadded} text-center ${styles.textMuted} mt-4">
        No ${resource.displayName.toLowerCase()}s found.
      </div>
    `
  }

  const headerCells = visibleColumns
    .map(col => `<th class="${styles.tableHeader} px-4 py-3">${formatColumnHeader(col.name)}</th>`)
    .join('')

  const rows = records.map(record => {
    const cells = visibleColumns
      .map(col => `<td class="${styles.tableCell}">${formatCellValue(record[col.name], col)}</td>`)
      .join('')

    const id = record[resource.primaryKey]
    const actions = `
      <td class="${styles.tableCell} text-right">
        <a href="${adminUrl(basePath, `/${resource.routePath}/${id}`)}" class="${styles.btnGhost} text-sm">View</a>
        <a href="${adminUrl(basePath, `/${resource.routePath}/${id}/edit`)}" class="${styles.btnGhost} text-sm">Edit</a>
      </td>
    `

    return `<tr class="${styles.tableRow}">${cells}${actions}</tr>`
  }).join('')

  return `
    ${actionBar}
    ${filterForm}
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

export function getVisibleColumns(columns: ColumnMeta[], config?: { columns?: string[]; exclude?: string[] }): ColumnMeta[] {
  let result = columns

  result = result.filter(col => !isPasswordColumn(col))

  if (config?.columns) {
    result = result.filter(col => config.columns!.includes(col.name))
  } else if (config?.exclude) {
    result = result.filter(col => !config.exclude!.includes(col.name))
  }

  return result
}

interface RenderFilterFormProps {
  actionUrl: string
  filters: DeclaredFilter[]
  activeFilterQuery: Record<string, string>
}

function renderFilterForm(props: RenderFilterFormProps): string {
  const { actionUrl, filters, activeFilterQuery } = props

  if (filters.length === 0) {
    return ''
  }

  const fields = filters.map((filter) => {
    const value = activeFilterQuery[filter.queryKey] ?? ''
    return `
      <div class="space-y-1 min-w-40 flex-1">
        <label for="${filter.queryKey}" class="${styles.label}">${escapeHtml(formatColumnHeader(filter.name))}</label>
        ${renderFilterInput(filter, value)}
      </div>
    `
  }).join('')

  return `
    <div class="${styles.cardPadded} mt-4">
      <form method="GET" action="${actionUrl}" class="space-y-4">
        <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          ${fields}
        </div>
        <div class="flex items-center gap-2">
          ${button({ label: 'Apply Filters', type: 'submit', variant: 'secondary' })}
          ${linkButton({ label: 'Clear', href: actionUrl, variant: 'ghost' })}
        </div>
      </form>
    </div>
  `
}

function renderFilterInput(filter: DeclaredFilter, value: string): string {
  const { column, queryKey } = filter

  if (column.dataType === 'enum' && column.enumValues) {
    const options = column.enumValues
      .map((option) => `<option value="${escapeHtml(option)}" ${value === option ? 'selected' : ''}>${escapeHtml(option)}</option>`)
      .join('')

    return `
      <select id="${queryKey}" name="${queryKey}" class="${styles.input}">
        <option value="">All</option>
        ${options}
      </select>
    `
  }

  if (column.dataType === 'boolean') {
    return `
      <select id="${queryKey}" name="${queryKey}" class="${styles.input}">
        <option value="">All</option>
        <option value="true" ${value === 'true' ? 'selected' : ''}>True</option>
        <option value="false" ${value === 'false' ? 'selected' : ''}>False</option>
      </select>
    `
  }

  if (column.dataType === 'timestamp') {
    return `
      <input
        type="datetime-local"
        id="${queryKey}"
        name="${queryKey}"
        value="${escapeHtml(value)}"
        class="${styles.input}"
      >
    `
  }

  if (column.dataType === 'integer') {
    return `
      <input
        type="number"
        id="${queryKey}"
        name="${queryKey}"
        value="${escapeHtml(value)}"
        class="${styles.input}"
      >
    `
  }

  return `
    <input
      type="text"
      id="${queryKey}"
      name="${queryKey}"
      value="${escapeHtml(value)}"
      class="${styles.input}"
    >
  `
}

function isPasswordColumn(col: ColumnMeta): boolean {
  return col.name.toLowerCase().includes('password')
}

export function formatColumnHeader(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}

export function formatCellValue(value: unknown, column: ColumnMeta): string {
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
    const str = JSON.stringify(value)
    const truncated = str.length > 50 ? str.slice(0, 50) + '...' : str
    return `<code class="text-xs">${escapeHtml(truncated)}</code>`
  }

  return escapeHtml(String(value))
}
