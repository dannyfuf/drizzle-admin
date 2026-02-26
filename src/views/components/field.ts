import type { ColumnMeta } from '../../dialects/types.js'
import { styles } from '../styles.js'
import { escapeHtml } from './flash.js'

export interface FieldProps {
  column: ColumnMeta
  value?: unknown
  error?: string
}

export function renderField(props: FieldProps): string {
  const { column, value, error } = props

  if (isAutoManaged(column)) {
    return ''
  }

  const inputHtml = renderInput(column, value)

  return `
    <div class="space-y-1">
      <label for="${column.name}" class="${styles.label}">
        ${formatLabel(column.name)}
        ${column.isNullable ? '' : '<span class="text-red-400">*</span>'}
      </label>
      ${inputHtml}
      ${error ? `<p class="text-sm ${styles.textError}">${escapeHtml(error)}</p>` : ''}
    </div>
  `
}

function renderInput(column: ColumnMeta, value: unknown): string {
  const name = column.name
  const required = !column.isNullable && !column.hasDefault

  if (isPasswordColumn(column)) {
    return `
      <input
        type="password"
        id="${name}"
        name="${name}"
        class="${styles.input}"
        ${required ? 'required' : ''}
      >
    `
  }

  if (column.dataType === 'enum' && column.enumValues) {
    const options = column.enumValues
      .map(v => `<option value="${v}" ${value === v ? 'selected' : ''}>${v}</option>`)
      .join('')

    return `
      <select id="${name}" name="${name}" class="${styles.input}" ${required ? 'required' : ''}>
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
        class="${styles.checkbox}"
        ${value === true ? 'checked' : ''}
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
        class="${styles.input} font-mono text-sm"
        ${required ? 'required' : ''}
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
        class="${styles.input}"
        ${required ? 'required' : ''}
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
        class="${styles.input}"
        ${required ? 'required' : ''}
      >
    `
  }

  return `
    <input
      type="text"
      id="${name}"
      name="${name}"
      value="${escapeHtml(String(value ?? ''))}"
      class="${styles.input}"
      ${required ? 'required' : ''}
    >
  `
}

function isAutoManaged(column: ColumnMeta): boolean {
  if (column.isPrimaryKey) return true
  if (['createdAt', 'created_at', 'updatedAt', 'updated_at'].includes(column.name)) {
    return column.hasDefault
  }
  return false
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
