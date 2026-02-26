import type { ColumnMeta } from '../dialects/types.js'
import type { ResourceDefinition } from '../resources/types.js'
import { styles } from './styles.js'
import { renderField } from './components/field.js'
import { button, linkButton } from './components/button.js'
import { csrfInput } from '../auth/csrf.js'

export interface FormViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  record?: Record<string, unknown>
  csrfToken: string
  errors?: Record<string, string>
}

export function formView(props: FormViewProps): string {
  const { resource, columns, record, csrfToken, errors } = props

  const isEdit = !!record
  const id = record?.id

  const actionUrl = isEdit
    ? `/${resource.routePath}/${id}?_method=PUT`
    : `/${resource.routePath}`

  const editableColumns = columns.filter(col => !isAutoManaged(col))

  const fields = editableColumns.map(col => renderField({
    column: col,
    value: record?.[col.name],
    error: errors?.[col.name],
  })).join('')

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
