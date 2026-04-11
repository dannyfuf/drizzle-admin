import { describe, it, expect } from 'vitest'
import { renderField } from '@/views/components/field.ts'
import { styles } from '@/views/styles.ts'
import type { ColumnMeta } from '@/dialects/types.ts'

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

  it('renders primary key columns (caller decides visibility)', () => {
    const html = renderField({
      column: makeColumn({ name: 'id', isPrimaryKey: true }),
      value: '42',
    })
    expect(html).toContain('type="text"')
    expect(html).toContain('name="id"')
  })

  it('renders auto-managed timestamp columns when not disabled', () => {
    const html = renderField({
      column: makeColumn({ name: 'createdAt', dataType: 'timestamp', hasDefault: true }),
      value: '2024-01-15T10:30',
    })
    expect(html).toContain('type="datetime-local"')
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

  describe('disabled rendering', () => {
    it('renders disabled text input with disabled attribute', () => {
      const html = renderField({ column: makeColumn(), value: 'Test', disabled: true })
      expect(html).toContain('disabled')
      expect(html).toContain('type="text"')
    })

    it('renders disabled input with inputDisabled style', () => {
      const html = renderField({ column: makeColumn(), value: 'Test', disabled: true })
      expect(html).toContain(styles.inputDisabled)
      expect(html).not.toContain(styles.input)
    })

    it('does not add required attribute when disabled', () => {
      const html = renderField({
        column: makeColumn({ isNullable: false, hasDefault: false }),
        disabled: true,
      })
      expect(html).not.toContain('required')
    })

    it('renders disabled select (enum) with disabled attribute', () => {
      const html = renderField({
        column: makeColumn({ dataType: 'enum', enumValues: ['a', 'b'] }),
        disabled: true,
      })
      expect(html).toContain('<select')
      expect(html).toContain('disabled')
      expect(html).toContain(styles.inputDisabled)
    })

    it('renders disabled checkbox with disabled attribute', () => {
      const html = renderField({
        column: makeColumn({ dataType: 'boolean' }),
        value: true,
        disabled: true,
      })
      expect(html).toContain('type="checkbox"')
      expect(html).toContain('disabled')
      expect(html).toContain(styles.checkboxDisabled)
    })

    it('renders disabled textarea (json) with disabled attribute', () => {
      const html = renderField({
        column: makeColumn({ dataType: 'json' }),
        value: { key: 'val' },
        disabled: true,
      })
      expect(html).toContain('<textarea')
      expect(html).toContain('disabled')
      expect(html).toContain(styles.inputDisabled)
    })

    it('renders disabled timestamp input with disabled attribute', () => {
      const html = renderField({
        column: makeColumn({ dataType: 'timestamp' }),
        value: '2024-01-15T10:30',
        disabled: true,
      })
      expect(html).toContain('type="datetime-local"')
      expect(html).toContain('disabled')
      expect(html).toContain(styles.inputDisabled)
    })

    it('renders disabled number input with disabled attribute', () => {
      const html = renderField({
        column: makeColumn({ dataType: 'integer' }),
        value: 42,
        disabled: true,
      })
      expect(html).toContain('type="number"')
      expect(html).toContain('disabled')
      expect(html).toContain(styles.inputDisabled)
    })
  })
})
