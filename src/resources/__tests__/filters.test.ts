import { describe, expect, it } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { ColumnMeta } from '@/dialects/types.ts'
import {
  buildFilterQuery,
  getDeclaredFilters,
  parseDeclaredFilterValues,
  validateDeclaredFilters,
} from '@/resources/filters.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

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
    tableName: 'posts',
    routePath: 'posts',
    displayName: 'Post',
    options: {},
    ...overrides,
  }
}

describe('validateDeclaredFilters', () => {
  it('returns no errors when filters are omitted', () => {
    const resource = makeResource()
    expect(validateDeclaredFilters(resource, [makeColumn()])).toEqual([])
  })

  it('returns normalized filters in declaration order', () => {
    const resource = makeResource({
      options: {
        index: {
          filters: ['status', 'title'],
        },
      },
    })

    const filters = getDeclaredFilters(resource, [
      makeColumn({ name: 'title' }),
      makeColumn({ name: 'status', dataType: 'enum', enumValues: ['draft', 'published'] }),
    ])

    expect(filters.map((filter) => filter.name)).toEqual(['status', 'title'])
    expect(filters.map((filter) => filter.queryKey)).toEqual(['filter_status', 'filter_title'])
  })

  it('rejects unknown columns', () => {
    const resource = makeResource({
      options: {
        index: {
          filters: ['missing'],
        },
      },
    })

    const errors = validateDeclaredFilters(resource, [makeColumn({ name: 'title' })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unknown column "missing"')
  })

  it('rejects duplicate declarations', () => {
    const resource = makeResource({
      options: {
        index: {
          filters: ['title', 'title'],
        },
      },
    })

    const errors = validateDeclaredFilters(resource, [makeColumn({ name: 'title' })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('duplicate column "title"')
  })

  it('rejects password columns', () => {
    const resource = makeResource({
      options: {
        index: {
          filters: ['passwordHash'],
        },
      },
    })

    const errors = validateDeclaredFilters(resource, [makeColumn({ name: 'passwordHash' })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('password column')
  })

  it('rejects unsupported types', () => {
    const resource = makeResource({
      options: {
        index: {
          filters: ['metadata'],
        },
      },
    })

    const errors = validateDeclaredFilters(resource, [makeColumn({ name: 'metadata', dataType: 'json' })])
    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unsupported type "json"')
  })
})

describe('parseDeclaredFilterValues', () => {
  const declaredFilters = [
    { name: 'title', queryKey: 'filter_title', column: makeColumn({ name: 'title', dataType: 'text' }) },
    { name: 'views', queryKey: 'filter_views', column: makeColumn({ name: 'views', dataType: 'integer' }) },
    { name: 'featured', queryKey: 'filter_featured', column: makeColumn({ name: 'featured', dataType: 'boolean' }) },
    {
      name: 'status',
      queryKey: 'filter_status',
      column: makeColumn({ name: 'status', dataType: 'enum', enumValues: ['draft', 'published'] }),
    },
    { name: 'publishedAt', queryKey: 'filter_publishedAt', column: makeColumn({ name: 'publishedAt', dataType: 'timestamp' }) },
  ]

  it('parses supported filter values and drops invalid ones', () => {
    const query = new URLSearchParams({
      filter_title: 'Hello',
      filter_views: '42',
      filter_featured: 'false',
      filter_status: 'draft',
      filter_publishedAt: '2024-01-15T10:30',
    })

    const parsed = parseDeclaredFilterValues(declaredFilters, (key) => query.get(key) ?? undefined)

    expect(parsed).toHaveLength(5)
    expect(parsed[0].value).toBe('Hello')
    expect(parsed[1].value).toBe(42)
    expect(parsed[2].value).toBe(false)
    expect(parsed[3].value).toBe('draft')
    expect(parsed[4].value).toBeInstanceOf(Date)
  })

  it('builds a query object from active filters', () => {
    const query = new URLSearchParams({
      filter_title: 'Hello',
      filter_featured: 'false',
    })

    const parsed = parseDeclaredFilterValues(declaredFilters, (key) => query.get(key) ?? undefined)
    expect(buildFilterQuery(parsed)).toEqual({
      filter_title: 'Hello',
      filter_featured: 'false',
    })
  })

  it('ignores blank or invalid values', () => {
    const query = new URLSearchParams({
      filter_title: '   ',
      filter_views: '1.5',
      filter_featured: 'maybe',
      filter_status: 'archived',
      filter_publishedAt: 'not-a-date',
    })

    const parsed = parseDeclaredFilterValues(declaredFilters, (key) => query.get(key) ?? undefined)
    expect(parsed).toEqual([])
  })
})
