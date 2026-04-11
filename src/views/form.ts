import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import { styles } from '@/views/styles.ts'
import { renderField } from '@/views/components/field.ts'
import { button, linkButton } from '@/views/components/button.ts'
import { csrfInput } from '@/auth/csrf.ts'
import { adminUrl } from '@/utils/url.ts'

export interface FormViewProps {
  resource: ResourceDefinition
  columns: ColumnMeta[]
  record?: Record<string, unknown>
  csrfToken: string
  basePath: string
  errors?: Record<string, string>
}

export function formView(props: FormViewProps): string {
  const { resource, columns, record, csrfToken, basePath, errors } = props

  const isEdit = !!record
  const id = record?.id

  const actionUrl = isEdit
    ? adminUrl(basePath, `/${resource.routePath}/${id}?_method=PUT`)
    : adminUrl(basePath, `/${resource.routePath}`)

  let fields: string

  if (isEdit) {
    // Edit: show ALL columns. Auto-managed ones are disabled.
    let editableColumns = columns.filter(col => !isAutoManaged(col))
    if (resource.options.permitParams) {
      const permitted = new Set(resource.options.permitParams)
      editableColumns = editableColumns.filter(col => permitted.has(col.name))
    }
    const disabledColumns = columns.filter(col => isAutoManaged(col))

    const disabledFields = disabledColumns.map(col => renderField({
      column: col,
      value: record[col.name],
      disabled: true,
    })).join('')

    const editableFields = editableColumns.map(col => renderField({
      column: col,
      value: record[col.name],
      error: errors?.[col.name],
    })).join('')

    fields = disabledFields + editableFields
  } else {
    // Create: hide auto-managed columns entirely
    let editableColumns = columns.filter(col => !isAutoManaged(col))
    if (resource.options.permitParams) {
      const permitted = new Set(resource.options.permitParams)
      editableColumns = editableColumns.filter(col => permitted.has(col.name))
    }
    fields = editableColumns.map(col => renderField({
      column: col,
      value: record?.[col.name],
      error: errors?.[col.name],
    })).join('')
  }

  const actionBar = isEdit ? `
    <div class="flex items-center gap-2">
      ${linkButton({ label: 'View', href: adminUrl(basePath, `/${resource.routePath}/${id}`), variant: 'ghost' })}
      ${linkButton({ label: 'Back to list', href: adminUrl(basePath, `/${resource.routePath}`), variant: 'ghost' })}
    </div>
  ` : `
    <div class="flex items-center gap-2">
      ${linkButton({ label: 'Back to list', href: adminUrl(basePath, `/${resource.routePath}`), variant: 'ghost' })}
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
          ${linkButton({ label: 'Cancel', href: adminUrl(basePath, `/${resource.routePath}`), variant: 'ghost' })}
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
