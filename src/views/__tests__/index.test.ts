import { describe, it, expect } from 'vitest'
import {
  indexView,
  getVisibleColumns,
  formatCellValue,
  formatColumnHeader,
} from '@/views/index.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { DeclaredFilter } from '@/resources/filters.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

import type { PgTable } from 'drizzle-orm/pg-core'

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
    table: {} as PgTable,
    tableName: 'cards',
    routePath: 'cards',
    displayName: 'Card',
    primaryKey: 'id',
    columns: [],
    options: {},
    ...overrides,
  }
}

function makeFilter(overrides: Partial<DeclaredFilter> = {}): DeclaredFilter {
  const column = makeColumn({ name: 'title', dataType: 'text' })

  return {
    name: column.name,
    queryKey: 'filter_title',
    column,
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

  it('formats Date as ISO 8601 UTC for timestamp columns', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const result = formatCellValue(date, makeColumn({ dataType: 'timestamp' }))
    expect(result).toContain('2024-01-15T10:30:00Z')
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
    filters: [],
    activeFilterQuery: {},
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

  it('does not render filter form when no filters are declared', () => {
    const html = indexView({ ...baseProps, records: [] })
    expect(html).not.toContain('Apply Filters')
    expect(html).not.toContain('filter_title')
  })

  it('renders declared filters and active values', () => {
    const html = indexView({
      ...baseProps,
      filters: [
        makeFilter(),
        makeFilter({
          name: 'featured',
          queryKey: 'filter_featured',
          column: makeColumn({ name: 'featured', dataType: 'boolean' }),
        }),
      ],
      activeFilterQuery: {
        filter_title: 'Hello',
        filter_featured: 'false',
      },
      records: [{ id: 1, title: 'Test' }],
    })

    expect(html).toContain('Apply Filters')
    expect(html).toContain('name="filter_title"')
    expect(html).toContain('value="Hello"')
    expect(html).toContain('name="filter_featured"')
    expect(html).toContain('option value="false" selected')
  })

  it('renders sortable header links that toggle to ascending by default', () => {
    const html = indexView({
      ...baseProps,
      records: [{ id: 1, title: 'Test' }],
    })

    expect(html).toContain('href="/cards?sort=id&amp;order=asc"')
    expect(html).toContain('href="/cards?sort=title&amp;order=asc"')
  })

  it('marks the active sort column with a descending toggle and arrow', () => {
    const html = indexView({
      ...baseProps,
      sort: { column: 'title', direction: 'asc' },
      records: [{ id: 1, title: 'Test' }],
    })

    expect(html).toContain('href="/cards?sort=title&amp;order=desc"')
    expect(html).toContain('aria-sort="ascending"')
    expect(html).toContain('▲')
  })

  it('shows the descending arrow and toggles back to ascending', () => {
    const html = indexView({
      ...baseProps,
      sort: { column: 'title', direction: 'desc' },
      records: [{ id: 1, title: 'Test' }],
    })

    expect(html).toContain('href="/cards?sort=title&amp;order=asc"')
    expect(html).toContain('aria-sort="descending"')
    expect(html).toContain('▼')
  })

  it('preserves active filters in sort links', () => {
    const html = indexView({
      ...baseProps,
      filters: [makeFilter()],
      activeFilterQuery: { filter_title: 'Hello' },
      records: [{ id: 1, title: 'Test' }],
    })

    expect(html).toContain('href="/cards?filter_title=Hello&amp;sort=title&amp;order=asc"')
  })

  it('does not render sort links for json columns', () => {
    const html = indexView({
      ...baseProps,
      columns: [
        makeColumn({ name: 'id', isPrimaryKey: true }),
        makeColumn({ name: 'metadata', dataType: 'json' }),
      ],
      records: [{ id: 1, metadata: { a: 1 } }],
    })

    expect(html).not.toContain('sort=metadata')
  })

  it('preserves the active sort as hidden fields in the filter form', () => {
    const html = indexView({
      ...baseProps,
      filters: [makeFilter()],
      sort: { column: 'title', direction: 'desc' },
      records: [{ id: 1, title: 'Test' }],
    })

    expect(html).toContain('<input type="hidden" name="sort" value="title">')
    expect(html).toContain('<input type="hidden" name="order" value="desc">')
  })

  it('renders a clear link back to the bare index url', () => {
    const html = indexView({
      ...baseProps,
      filters: [makeFilter()],
      activeFilterQuery: { filter_title: 'Hello' },
      records: [],
    })

    expect(html).toContain('href="/cards"')
    expect(html).toContain('Clear')
  })
})
