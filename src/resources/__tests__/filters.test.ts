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
    primaryKey: 'id',
    columns: [],
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

  it('uses contains only for plain text columns and exact matching otherwise', () => {
    const resource = makeResource({
      options: {
        index: {
          filters: ['title', 'authorId', 'views', 'featured', 'status', 'publishedAt'],
        },
      },
    })
    const filters = getDeclaredFilters(resource, [
      makeColumn({ name: 'title', dataType: 'text' }),
      makeColumn({
        name: 'authorId',
        dataType: 'text',
        references: { table: 'users', column: 'id' },
      }),
      makeColumn({ name: 'views', dataType: 'integer' }),
      makeColumn({ name: 'featured', dataType: 'boolean' }),
      makeColumn({ name: 'status', dataType: 'enum', enumValues: ['draft', 'published'] }),
      makeColumn({ name: 'publishedAt', dataType: 'timestamp' }),
    ])

    expect(filters.map(({ name, matchMode }) => [name, matchMode])).toEqual([
      ['title', 'contains'],
      ['authorId', 'exact'],
      ['views', 'exact'],
      ['featured', 'exact'],
      ['status', 'exact'],
      ['publishedAt', 'exact'],
    ])
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
    { name: 'title', queryKey: 'filter_title', column: makeColumn({ name: 'title', dataType: 'text' }), matchMode: 'contains' as const },
    { name: 'views', queryKey: 'filter_views', column: makeColumn({ name: 'views', dataType: 'integer' }), matchMode: 'exact' as const },
    { name: 'featured', queryKey: 'filter_featured', column: makeColumn({ name: 'featured', dataType: 'boolean' }), matchMode: 'exact' as const },
    {
      name: 'status',
      queryKey: 'filter_status',
      column: makeColumn({ name: 'status', dataType: 'enum', enumValues: ['draft', 'published'] }),
      matchMode: 'exact' as const,
    },
    { name: 'publishedAt', queryKey: 'filter_publishedAt', column: makeColumn({ name: 'publishedAt', dataType: 'timestamp' }), matchMode: 'exact' as const },
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
