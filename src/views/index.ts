import type { ColumnMeta } from '../dialects/types.js'
import type { ResourceDefinition } from '../resources/types.js'
import { styles } from './styles.js'
import { escapeHtml } from './components/flash.js'
import { renderPagination, PaginationProps } from './components/pagination.js'
import { linkButton } from './components/button.js'
import { renderCollectionActions } from './components/actions.js'

export interface IndexViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  records: Record<string, unknown>[]
  pagination: PaginationProps
  csrfToken: string
}

export function indexView(props: IndexViewProps): string {
  const { resource, columns, records, pagination, csrfToken } = props

  const visibleColumns = getVisibleColumns(columns, resource.options.index)

  const collectionActions = renderCollectionActions({ resource, csrfToken })

  const actionBar = `
    <div class="flex items-center justify-between">
      <div class="flex items-center gap-2">
        ${linkButton({ label: 'Create New', href: `/${resource.routePath}/new`, variant: 'primary' })}
        ${collectionActions}
      </div>
    </div>
  `

  if (records.length === 0) {
    return `
      ${actionBar}
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
    const str = JSON.stringify(value)
    const truncated = str.length > 50 ? str.slice(0, 50) + '...' : str
    return `<code class="text-xs">${escapeHtml(truncated)}</code>`
  }

  return escapeHtml(String(value))
}
