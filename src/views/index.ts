import type { ColumnMeta } from '@/dialects/types.ts'
import type { DeclaredFilter } from '@/resources/filters.ts'
import { isSortableColumn, type SortState } from '@/resources/sort.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import { styles } from '@/views/styles.ts'
import { escapeHtml } from '@/views/components/flash.ts'
import { renderPagination, PaginationProps } from '@/views/components/pagination.ts'
import { button, linkButton } from '@/views/components/button.ts'
import { renderCollectionActions } from '@/views/components/actions.ts'
import { adminUrl } from '@/utils/url.ts'
import { formatTimestamp } from '@/utils/date.ts'
import { referenceLink } from '@/views/components/reference-link.ts'
import { referencedByLink, type ReferencedByRoute } from '@/views/components/referenced-by-link.ts'

export interface IndexViewProps<TableRef = unknown, ActionDatabase = never> {
  resource: ResourceDefinition<TableRef, ActionDatabase>
  columns: ColumnMeta[]
  records: Record<string, unknown>[]
  filters: DeclaredFilter[]
  activeFilterQuery: Record<string, string>
  sort?: SortState
  pagination: PaginationProps
  csrfToken: string
  basePath: string
  referenceRoutes: Record<string, string>
  referencedByRoutes: ReferencedByRoute[]
}

export function indexView<TableRef, ActionDatabase>(props: IndexViewProps<TableRef, ActionDatabase>): string {
  const { resource, columns, records, filters, activeFilterQuery, sort, pagination, csrfToken, basePath, referenceRoutes, referencedByRoutes } = props

  const visibleColumns = getVisibleColumns(columns, resource.options.index)
  const listUrl = adminUrl(basePath, `/${resource.routePath}`)

  const collectionActions = renderCollectionActions({ resource, csrfToken, basePath })
  const filterForm = renderFilterForm({
    actionUrl: listUrl,
    filters,
    activeFilterQuery,
    sort,
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
    .map(col => renderHeaderCell({ column: col, sort, listUrl, activeFilterQuery }))
    .join('')
  const referencedByHeaderCells = referencedByRoutes
    .map(route => `<th class="${styles.tableHeader} px-4 py-3">${escapeHtml(formatColumnHeader(route.label))}</th>`)
    .join('')

  const rows = records.map(record => {
    const cells = visibleColumns
      .map(col => `<td class="${styles.tableCell}">${formatCellValue(record[col.name], col, referenceRoutes, basePath)}</td>`)
      .join('')
    const referencedByCells = referencedByRoutes.map((route) => {
      const value = record[route.parentKeyName]
      const content = value === null || value === undefined
        ? `<span class="${styles.textMuted}">—</span>`
        : referencedByLink({
            label: formatColumnHeader(route.label),
            childRoutePath: route.childRoutePath,
            foreignKey: route.foreignKey,
            value,
            basePath,
          })

      return `<td class="${styles.tableCell}">${content}</td>`
    }).join('')

    const id = record[resource.primaryKey]
    const actions = `
      <td class="${styles.tableCell} text-right">
        <a href="${adminUrl(basePath, `/${resource.routePath}/${id}`)}" class="${styles.btnGhost} text-sm">View</a>
        <a href="${adminUrl(basePath, `/${resource.routePath}/${id}/edit`)}" class="${styles.btnGhost} text-sm">Edit</a>
      </td>
    `

    return `<tr class="${styles.tableRow}">${cells}${referencedByCells}${actions}</tr>`
  }).join('')

  return `
    ${actionBar}
    ${filterForm}
    <div class="${styles.card} overflow-hidden mt-4">
      <table class="${styles.table}">
        <thead class="border-b border-zinc-800">
          <tr>${headerCells}${referencedByHeaderCells}<th class="${styles.tableHeader} px-4 py-3 text-right">Actions</th></tr>
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

interface RenderHeaderCellProps {
  column: ColumnMeta
  sort: SortState | undefined
  listUrl: string
  activeFilterQuery: Record<string, string>
}

function renderHeaderCell(props: RenderHeaderCellProps): string {
  const { column, sort, listUrl, activeFilterQuery } = props
  const label = escapeHtml(formatColumnHeader(column.name))

  if (!isSortableColumn(column)) {
    return `<th class="${styles.tableHeader} px-4 py-3">${label}</th>`
  }

  const isActive = sort?.column === column.name
  const nextDirection = isActive && sort.direction === 'asc' ? 'desc' : 'asc'

  const searchParams = new URLSearchParams(activeFilterQuery)
  searchParams.set('sort', column.name)
  searchParams.set('order', nextDirection)

  const arrow = isActive
    ? (sort.direction === 'asc' ? '▲' : '▼')
    : '<span class="opacity-0 group-hover:opacity-50">▲</span>'
  const ariaSort = isActive
    ? (sort.direction === 'asc' ? 'ascending' : 'descending')
    : 'none'

  const href = escapeHtml(`${listUrl}?${searchParams.toString()}`)

  return `<th class="${styles.tableHeader} px-4 py-3" aria-sort="${ariaSort}"><a href="${href}" class="group inline-flex items-center gap-1 hover:text-zinc-100">${label}<span class="text-xs" aria-hidden="true">${arrow}</span></a></th>`
}

interface RenderFilterFormProps {
  actionUrl: string
  filters: DeclaredFilter[]
  activeFilterQuery: Record<string, string>
  sort?: SortState
}

function renderFilterForm(props: RenderFilterFormProps): string {
  const { actionUrl, filters, activeFilterQuery, sort } = props

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

  const sortFields = sort
    ? `<input type="hidden" name="sort" value="${escapeHtml(sort.column)}"><input type="hidden" name="order" value="${sort.direction}">`
    : ''

  return `
    <div class="${styles.cardPadded} mt-4">
      <form method="GET" action="${actionUrl}" class="space-y-4">
        ${sortFields}
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

export function formatCellValue(
  value: unknown,
  column: ColumnMeta,
  referenceRoutes: Record<string, string> = {},
  basePath = '',
): string {
  if (value === null || value === undefined) {
    return `<span class="${styles.textMuted}">—</span>`
  }

  const referenceRoute = referenceRoutes[column.name]
  if (referenceRoute) {
    return referenceLink({ value, routePath: referenceRoute, basePath })
  }

  if (column.dataType === 'timestamp' && value instanceof Date) {
    return escapeHtml(formatTimestamp(value))
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
