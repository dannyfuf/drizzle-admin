import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import { styles } from '@/views/styles.ts'
import { renderField } from '@/views/components/field.ts'
import { button, linkButton } from '@/views/components/button.ts'
import { csrfInput } from '@/auth/csrf.ts'

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

  let editableColumns = columns.filter(col => !isAutoManaged(col))

  if (resource.options.permitParams) {
    const permitted = new Set(resource.options.permitParams)
    editableColumns = editableColumns.filter(col => permitted.has(col.name))
  }

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

export function isAutoManaged(column: ColumnMeta): boolean {
  if (column.isPrimaryKey) return true
  if (['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(column.name)) {
    return column.hasDefault
  }
  return false
}
