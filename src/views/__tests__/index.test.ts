import { describe, it, expect } from 'vitest'
import {
  indexView,
  getVisibleColumns,
  formatCellValue,
  formatColumnHeader,
} from '@/views/index.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

import type { Table } from 'drizzle-orm'

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

function makeResource(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    table: {} as Table,
    tableName: 'cards',
    routePath: 'cards',
    displayName: 'Card',
    options: {},
    ...overrides,
  }
}

describe('formatCellValue', () => {
  it('returns em-dash span for null', () => {
    const result = formatCellValue(null, makeColumn())
    expect(result).toContain('—')
  })

  it('returns em-dash span for undefined', () => {
    const result = formatCellValue(undefined, makeColumn())
    expect(result).toContain('—')
  })

  it('formats Date as locale string for timestamp columns', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const result = formatCellValue(date, makeColumn({ dataType: 'timestamp' }))
    expect(result).toContain('2024')
  })

  it('returns checkmark for true boolean', () => {
    const result = formatCellValue(true, makeColumn({ dataType: 'boolean' }))
    expect(result).toContain('✓')
  })

  it('returns X for false boolean', () => {
    const result = formatCellValue(false, makeColumn({ dataType: 'boolean' }))
    expect(result).toContain('✗')
  })

  it('truncates long JSON to 50 chars with ellipsis', () => {
    const longObj = { key: 'a'.repeat(60) }
    const result = formatCellValue(longObj, makeColumn({ dataType: 'json' }))
    expect(result).toContain('...')
  })

  it('wraps JSON in code tag', () => {
    const result = formatCellValue({ a: 1 }, makeColumn({ dataType: 'json' }))
    expect(result).toContain('<code')
  })

  it('escapes HTML in string values', () => {
    const result = formatCellValue('<script>alert("xss")</script>', makeColumn())
    expect(result).toContain('&lt;script&gt;')
    expect(result).not.toContain('<script>')
  })
})

describe('formatColumnHeader', () => {
  it('converts camelCase to space-separated', () => {
    expect(formatColumnHeader('createdAt')).toBe('Created At')
  })

  it('converts snake_case to space-separated', () => {
    expect(formatColumnHeader('created_at')).toBe('Created at')
  })

  it('capitalizes first letter', () => {
    expect(formatColumnHeader('title')).toBe('Title')
  })
})

describe('getVisibleColumns', () => {
  it('filters out password columns', () => {
    const columns = [
      makeColumn({ name: 'email' }),
      makeColumn({ name: 'passwordHash' }),
    ]
    const result = getVisibleColumns(columns)
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('email')
  })

  it('filters by explicit column list', () => {
    const columns = [
      makeColumn({ name: 'id' }),
      makeColumn({ name: 'title' }),
      makeColumn({ name: 'body' }),
    ]
    const result = getVisibleColumns(columns, { columns: ['title'] })
    expect(result).toHaveLength(1)
    expect(result[0].name).toBe('title')
  })

  it('filters by exclude list', () => {
    const columns = [
      makeColumn({ name: 'id' }),
      makeColumn({ name: 'title' }),
      makeColumn({ name: 'body' }),
    ]
    const result = getVisibleColumns(columns, { exclude: ['body'] })
    expect(result).toHaveLength(2)
    expect(result.map(c => c.name)).toEqual(['id', 'title'])
  })

  it('returns all non-password columns when no config', () => {
    const columns = [
      makeColumn({ name: 'id' }),
      makeColumn({ name: 'title' }),
    ]
    const result = getVisibleColumns(columns)
    expect(result).toHaveLength(2)
  })
})

describe('indexView', () => {
  const baseProps = {
    resource: makeResource(),
    columns: [
      makeColumn({ name: 'id', isPrimaryKey: true }),
      makeColumn({ name: 'title' }),
    ],
    pagination: { currentPage: 1, totalPages: 1, baseUrl: '/cards' },
    csrfToken: 'test-token',
    basePath: '',
  }

  it('renders "no records" message when records array is empty', () => {
    const html = indexView({ ...baseProps, records: [] })
    expect(html.toLowerCase()).toContain('no card')
  })

  it('renders table with header row when records exist', () => {
    const html = indexView({
      ...baseProps,
      records: [{ id: 1, title: 'Test' }],
    })
    expect(html).toContain('<table')
    expect(html).toContain('<thead')
  })

  it('renders Create New button', () => {
    const html = indexView({ ...baseProps, records: [] })
    expect(html).toContain('Create New')
  })

  it('renders View and Edit links for each record', () => {
    const html = indexView({
      ...baseProps,
      records: [{ id: 1, title: 'Test' }],
    })
    expect(html).toContain('/cards/1')
    expect(html).toContain('View')
    expect(html).toContain('Edit')
  })
})
