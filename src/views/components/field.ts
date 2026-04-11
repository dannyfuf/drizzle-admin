import type { ColumnMeta } from '@/dialects/types.ts'
import { styles } from '@/views/styles.ts'
import { escapeHtml } from '@/views/components/flash.ts'

export interface FieldProps {
  column: ColumnMeta
  value?: unknown
  error?: string
  disabled?: boolean
}

export function renderField(props: FieldProps): string {
  const { column, value, error, disabled } = props

  const inputHtml = renderInput(column, value, disabled)

  return `
    <div class="space-y-1">
      <label for="${column.name}" class="${styles.label}">
        ${formatLabel(column.name)}
        ${column.isNullable || disabled ? '' : '<span class="text-red-400">*</span>'}
      </label>
      ${inputHtml}
      ${error ? `<p class="text-sm ${styles.textError}">${escapeHtml(error)}</p>` : ''}
    </div>
  `
}

function renderInput(column: ColumnMeta, value: unknown, disabled?: boolean): string {
  const name = column.name
  const required = !disabled && !column.isNullable && !column.hasDefault
  const disabledAttr = disabled ? 'disabled' : ''
  const inputStyle = disabled ? styles.inputDisabled : styles.input
  const checkboxStyle = disabled ? styles.checkboxDisabled : styles.checkbox

  if (isPasswordColumn(column)) {
    return `
      <input
        type="password"
        id="${name}"
        name="${name}"
        class="${inputStyle}"
        ${required ? 'required' : ''}
        ${disabledAttr}
      >
    `
  }

  if (column.dataType === 'enum' && column.enumValues) {
    const options = column.enumValues
      .map(v => `<option value="${v}" ${value === v ? 'selected' : ''}>${v}</option>`)
      .join('')

    return `
      <select id="${name}" name="${name}" class="${inputStyle}" ${required ? 'required' : ''} ${disabledAttr}>
        <option value="">Select...</option>
        ${options}
      </select>
    `
  }

  if (column.dataType === 'boolean') {
    return `
      <input
        type="checkbox"
        id="${name}"
        name="${name}"
        value="true"
        class="${checkboxStyle}"
        ${value === true ? 'checked' : ''}
        ${disabledAttr}
      >
    `
  }

  if (column.dataType === 'json') {
    const formatted = value ? JSON.stringify(value, null, 2) : ''
    return `
      <textarea
        id="${name}"
        name="${name}"
        rows="4"
        class="${inputStyle} font-mono text-sm"
        ${required ? 'required' : ''}
        ${disabledAttr}
      >${escapeHtml(formatted)}</textarea>
    `
  }

  if (column.dataType === 'timestamp') {
    const formatted = value instanceof Date
      ? value.toISOString().slice(0, 16)
      : (typeof value === 'string' ? value.slice(0, 16) : '')

    return `
      <input
        type="datetime-local"
        id="${name}"
        name="${name}"
        value="${formatted}"
        class="${inputStyle}"
        ${required ? 'required' : ''}
        ${disabledAttr}
      >
    `
  }

  if (column.dataType === 'integer') {
    return `
      <input
        type="number"
        id="${name}"
        name="${name}"
        value="${value ?? ''}"
        class="${inputStyle}"
        ${required ? 'required' : ''}
        ${disabledAttr}
      >
    `
  }

  return `
    <input
      type="text"
      id="${name}"
      name="${name}"
      value="${escapeHtml(String(value ?? ''))}"
      class="${inputStyle}"
      ${required ? 'required' : ''}
      ${disabledAttr}
    >
  `
}

function isPasswordColumn(column: ColumnMeta): boolean {
  const name = column.name.toLowerCase()
  return name.includes('password')
}

function formatLabel(name: string): string {
  return name
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^\w/, c => c.toUpperCase())
    .trim()
}
