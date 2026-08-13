import { describe, it, expect } from 'vitest'
import {
  defineKnexAdminUsers,
  defineKnexResource,
  defineKnexTable,
  definePersistenceAdminUsers,
  definePersistenceResource,
  defineResource,
  isKnexTableDefinition,
  isResourceExport,
} from '@/resources/define.ts'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { PersistenceRepository } from '@/types.ts'

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: 'id',
    sqlName: 'id',
    dataType: 'integer',
    isNullable: false,
    isPrimaryKey: true,
    hasDefault: true,
    ...overrides,
  }
}

describe('defineResource', () => {
  it('works without options', () => {
    const table = { name: 'cards' } as unknown as PgTable
    const result = defineResource(table)
    expect(result.__drizzleAdminResource).toBe(true)
    expect(result.backend).toBe('drizzle')
    expect(result.table).toBe(table)
    expect(result.options).toEqual({})
  })

  it('accepts options', () => {
    const table = { name: 'cards' } as unknown as PgTable
    const options = { index: { perPage: 10 } }
    const result = defineResource(table, options)
    expect(result.options).toEqual(options)
  })

  it('passes folder option through', () => {
    const table = { name: 'contacts' } as unknown as PgTable
    const result = defineResource(table, { folder: 'CRM' })
    expect(result.options.folder).toBe('CRM')
  })

  it('passes index.filters through', () => {
    const table = { name: 'posts' } as unknown as PgTable
    const result = defineResource(table, {
      index: {
        filters: ['title', 'status', 'featured'],
      },
    })

    expect(result.options.index?.filters).toEqual(['title', 'status', 'featured'])
  })
})

describe('defineKnexResource', () => {
  it('accepts explicit table metadata and options', () => {
    const table = defineKnexTable('posts', [
      makeColumn(),
      makeColumn({ name: 'title', sqlName: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
    ])

    const result = defineKnexResource(table, { folder: 'Content' })

    expect(result.__drizzleAdminResource).toBe(true)
    expect(result.backend).toBe('knex')
    expect(result.table).toBe(table)
    expect(result.options.folder).toBe('Content')
  })

  it('accepts table name plus column metadata', () => {
    const result = defineKnexResource('posts', [makeColumn()])
    expect(result.table.tableName).toBe('posts')
    expect(result.table.columns[0].name).toBe('id')
  })

  it('rejects missing primary key metadata', () => {
    expect(() => defineKnexResource('posts', [
      makeColumn({ name: 'title', sqlName: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
    ])).toThrow('primary key')
  })

  it('rejects incomplete column metadata', () => {
    expect(() => defineKnexResource('posts', [
      { name: 'id', sqlName: 'id', dataType: 'integer', isPrimaryKey: true, hasDefault: true } as ColumnMeta,
    ])).toThrow('isNullable')
  })

  it('accepts reference metadata', () => {
    const table = defineKnexTable('posts', [
      makeColumn(),
      makeColumn({
        name: 'authorId',
        sqlName: 'author_id',
        isPrimaryKey: false,
        hasDefault: false,
        references: { table: 'users', column: 'id' },
      }),
    ])

    expect(table.columns[1].references).toEqual({ table: 'users', column: 'id' })
  })

  it.each([
    [null, 'references must be an object'],
    [{ table: '', column: 'id' }, 'references.table'],
    [{ table: 'users', column: '' }, 'references.column'],
  ])('rejects invalid reference metadata %j', (references, message) => {
    expect(() => defineKnexTable('posts', [
      makeColumn(),
      makeColumn({
        name: 'authorId',
        sqlName: 'author_id',
        isPrimaryKey: false,
        hasDefault: false,
        references: references as ColumnMeta['references'],
      }),
    ])).toThrow(message)
  })

  it('creates admin users metadata with the same table shape', () => {
    const table = defineKnexAdminUsers('admin_users', [makeColumn()])
    expect(isKnexTableDefinition(table)).toBe(true)
    expect(table.tableName).toBe('admin_users')
  })
})

describe('definePersistenceResource', () => {
  it('accepts a Persistence repository factory without column metadata', () => {
    const factory = (() => ({})) as unknown as PersistenceRepository
    const result = definePersistenceResource(() => factory, { folder: 'Content' })

    expect(result.__drizzleAdminResource).toBe(true)
    expect(result.backend).toBe('persistence')
    expect(result.options.folder).toBe('Content')
  })

  it('passes admin users repository references through unchanged', () => {
    const factory = (() => ({})) as unknown as PersistenceRepository
    const ref = () => factory
    expect(definePersistenceAdminUsers(ref)).toBe(ref)
  })
})

describe('isResourceExport', () => {
  it('returns true for valid resource exports', () => {
    const resource = defineResource({ name: 'cards' } as unknown as PgTable)
    expect(isResourceExport(resource)).toBe(true)
  })

  it('returns true for valid Knex resource exports', () => {
    const resource = defineKnexResource('cards', [makeColumn()])
    expect(isResourceExport(resource)).toBe(true)
  })

  it('returns true for valid Persistence resource exports', () => {
    const factory = (() => ({})) as unknown as PersistenceRepository
    const resource = definePersistenceResource(() => factory)
    expect(isResourceExport(resource)).toBe(true)
  })

  it('returns false for plain objects', () => {
    expect(isResourceExport({ table: 'cards' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isResourceExport(null)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isResourceExport('string')).toBe(false)
    expect(isResourceExport(42)).toBe(false)
  })
})
