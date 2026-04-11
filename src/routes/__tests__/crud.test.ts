import { describe, it, expect } from 'vitest'
import { parseFormValues, render404 } from '@/routes/crud.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
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
    options: {},
    ...overrides,
  }
}

describe('parseFormValues', () => {
  it('skips primary key columns', () => {
    const columns = [
      makeColumn({ name: 'id', isPrimaryKey: true }),
      makeColumn({ name: 'title' }),
    ]
    const result = parseFormValues({ id: '1', title: 'Hello' }, columns)
    expect(result).not.toHaveProperty('id')
    expect(result.title).toBe('Hello')
  })

  it('skips createdAt columns', () => {
    const columns = [
      makeColumn({ name: 'createdAt' }),
      makeColumn({ name: 'title' }),
    ]
    const result = parseFormValues({ createdAt: '2024-01-01', title: 'Hello' }, columns)
    expect(result).not.toHaveProperty('createdAt')
  })

  it('skips created_at columns', () => {
    const columns = [
      makeColumn({ name: 'created_at' }),
      makeColumn({ name: 'title' }),
    ]
    const result = parseFormValues({ created_at: '2024-01-01', title: 'Hello' }, columns)
    expect(result).not.toHaveProperty('created_at')
  })

  it('parses boolean "true" correctly', () => {
    const columns = [makeColumn({ name: 'active', dataType: 'boolean' })]
    const result = parseFormValues({ active: 'true' }, columns)
    expect(result.active).toBe(true)
  })

  it('parses boolean true value correctly', () => {
    const columns = [makeColumn({ name: 'active', dataType: 'boolean' })]
    const result = parseFormValues({ active: 'true' }, columns)
    expect(result.active).toBe(true)
  })

  it('parses absent boolean value as false', () => {
    const columns = [makeColumn({ name: 'active', dataType: 'boolean' })]
    const result = parseFormValues({}, columns)
    expect(result.active).toBe(false)
  })

  it('parses integer values from string', () => {
    const columns = [makeColumn({ name: 'count', dataType: 'integer' })]
    const result = parseFormValues({ count: '42' }, columns)
    expect(result.count).toBe(42)
  })

  it('parses integer as null when empty', () => {
    const columns = [makeColumn({ name: 'count', dataType: 'integer' })]
    const result = parseFormValues({ count: '' }, columns)
    expect(result.count).toBeNull()
  })

  it('parses JSON values from string', () => {
    const columns = [makeColumn({ name: 'meta', dataType: 'json' })]
    const result = parseFormValues({ meta: '{"key":"value"}' }, columns)
    expect(result.meta).toEqual({ key: 'value' })
  })

  it('returns null for invalid JSON', () => {
    const columns = [makeColumn({ name: 'meta', dataType: 'json' })]
    const result = parseFormValues({ meta: 'not json' }, columns)
    expect(result.meta).toBeNull()
  })

  it('parses timestamp values to Date objects', () => {
    const columns = [makeColumn({ name: 'publishedAt', dataType: 'timestamp' })]
    const result = parseFormValues({ publishedAt: '2024-01-15T10:30:00' }, columns)
    expect(result.publishedAt).toBeInstanceOf(Date)
  })

  it('returns null for empty timestamp', () => {
    const columns = [makeColumn({ name: 'publishedAt', dataType: 'timestamp' })]
    const result = parseFormValues({ publishedAt: '' }, columns)
    expect(result.publishedAt).toBeNull()
  })

  it('passes through text values as-is', () => {
    const columns = [makeColumn({ name: 'title', dataType: 'text' })]
    const result = parseFormValues({ title: 'Hello World' }, columns)
    expect(result.title).toBe('Hello World')
  })

  it('returns null for missing text values', () => {
    const columns = [makeColumn({ name: 'title', dataType: 'text' })]
    const result = parseFormValues({}, columns)
    expect(result.title).toBeNull()
  })

  it('skips updatedAt columns', () => {
    const columns = [
      makeColumn({ name: 'updatedAt', dataType: 'timestamp', hasDefault: true }),
      makeColumn({ name: 'title' }),
    ]
    const result = parseFormValues({ updatedAt: '2024-01-01T12:00:00', title: 'Hello' }, columns)
    expect(result).not.toHaveProperty('updatedAt')
    expect(result.title).toBe('Hello')
  })

  it('skips updated_at columns', () => {
    const columns = [
      makeColumn({ name: 'updated_at', dataType: 'timestamp', hasDefault: true }),
      makeColumn({ name: 'title' }),
    ]
    const result = parseFormValues({ updated_at: '2024-01-01T12:00:00', title: 'Hello' }, columns)
    expect(result).not.toHaveProperty('updated_at')
    expect(result.title).toBe('Hello')
  })

  it('respects permitParams whitelist', () => {
    const columns = [
      makeColumn({ name: 'title' }),
      makeColumn({ name: 'secret' }),
    ]
    const result = parseFormValues(
      { title: 'Hello', secret: 'hidden' },
      columns,
      ['title']
    )
    expect(result.title).toBe('Hello')
    expect(result).not.toHaveProperty('secret')
  })
})

describe('render404', () => {
  it('returns HTML containing "Not Found"', () => {
    const html = render404(makeResource())
    expect(html).toContain('Not Found')
  })

  it('includes resource display name', () => {
    const html = render404(makeResource({ displayName: 'Post' }))
    expect(html).toContain('Post')
  })

  it('includes link back to resource list', () => {
    const html = render404(makeResource({ routePath: 'posts' }))
    expect(html).toContain('href="/posts"')
    expect(html).toContain('Back to list')
  })
})
