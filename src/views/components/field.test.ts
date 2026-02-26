import { describe, it, expect } from 'vitest'
import { renderField } from './field.js'
import type { ColumnMeta } from '../../dialects/types.js'

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: 'title',
    sqlName: 'title',
    dataType: 'text',
    isNullable: false,
    isPrimaryKey: false,
    hasDefault: false,
    ...overrides,
  }
}

describe('renderField', () => {
  it('renders text input for text columns', () => {
    const html = renderField({ column: makeColumn() })
    expect(html).toContain('type="text"')
    expect(html).toContain('name="title"')
  })

  it('renders password input for password columns', () => {
    const html = renderField({ column: makeColumn({ name: 'passwordHash' }) })
    expect(html).toContain('type="password"')
  })

  it('renders select for enum columns', () => {
    const html = renderField({
      column: makeColumn({ dataType: 'enum', enumValues: ['active', 'inactive'] }),
    })
    expect(html).toContain('<select')
    expect(html).toContain('active')
    expect(html).toContain('inactive')
  })

  it('renders checkbox for boolean columns', () => {
    const html = renderField({ column: makeColumn({ dataType: 'boolean' }) })
    expect(html).toContain('type="checkbox"')
  })

  it('renders textarea for json columns', () => {
    const html = renderField({ column: makeColumn({ dataType: 'json' }) })
    expect(html).toContain('<textarea')
  })

  it('renders datetime-local for timestamp columns', () => {
    const html = renderField({ column: makeColumn({ dataType: 'timestamp' }) })
    expect(html).toContain('type="datetime-local"')
  })

  it('renders number input for integer columns', () => {
    const html = renderField({ column: makeColumn({ dataType: 'integer' }) })
    expect(html).toContain('type="number"')
  })

  it('skips primary key columns', () => {
    const html = renderField({ column: makeColumn({ isPrimaryKey: true }) })
    expect(html).toBe('')
  })

  it('skips auto-managed timestamp columns', () => {
    const html = renderField({
      column: makeColumn({ name: 'createdAt', dataType: 'timestamp', hasDefault: true }),
    })
    expect(html).toBe('')
  })

  it('shows required indicator for non-nullable columns', () => {
    const html = renderField({ column: makeColumn({ isNullable: false }) })
    expect(html).toContain('text-red-400')
    expect(html).toContain('*')
  })

  it('shows error message when provided', () => {
    const html = renderField({ column: makeColumn(), error: 'Required' })
    expect(html).toContain('Required')
  })

  it('pre-fills value', () => {
    const html = renderField({ column: makeColumn(), value: 'Hello World' })
    expect(html).toContain('Hello World')
  })
})
