import { describe, it, expect, vi } from 'vitest'
import { foreignKey, integer, pgTable, type PgTable } from 'drizzle-orm/pg-core'

vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>()
  return {
    ...actual,
    getTableColumns: (table: Record<string, unknown>) =>
      '_columns' in table ? table._columns : actual.getTableColumns(table as unknown as PgTable),
  }
})

vi.mock('drizzle-orm/pg-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm/pg-core')>()
  return {
    ...actual,
    getTableConfig: (table: Record<string, unknown>) =>
      '_columns' in table ? { foreignKeys: [] } : actual.getTableConfig(table as unknown as PgTable),
  }
})

import { postgresqlAdapter } from '@/dialects/postgresql.ts'

function makeTable(columns: Record<string, unknown>): PgTable {
  return { _columns: columns } as unknown as PgTable
}

function makeColumn(overrides: Record<string, unknown> = {}) {
  return {
    name: 'col',
    dataType: 'string',
    notNull: true,
    primary: false,
    hasDefault: false,
    ...overrides,
  }
}

describe('postgresqlAdapter', () => {
  it('has name "postgresql"', () => {
    expect(postgresqlAdapter.name).toBe('postgresql')
  })

  describe('extractColumns', () => {
    it('extracts column name from object key', () => {
      const table = makeTable({ title: makeColumn({ name: 'title' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].name).toBe('title')
    })

    it('extracts sqlName from column.name', () => {
      const table = makeTable({ createdAt: makeColumn({ name: 'created_at' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].sqlName).toBe('created_at')
    })

    it('maps dataType "string" to "text"', () => {
      const table = makeTable({ col: makeColumn({ dataType: 'string' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('text')
    })

    it('maps dataType "number" to "integer"', () => {
      const table = makeTable({ col: makeColumn({ dataType: 'number' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('integer')
    })

    it('maps dataType "boolean" to "boolean"', () => {
      const table = makeTable({ col: makeColumn({ dataType: 'boolean' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('boolean')
    })

    it('maps dataType "date" to "timestamp"', () => {
      const table = makeTable({ col: makeColumn({ dataType: 'date' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('timestamp')
    })

    it('maps dataType "json" to "json"', () => {
      const table = makeTable({ col: makeColumn({ dataType: 'json' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('json')
    })

    it('maps column with enumValues to "enum"', () => {
      const table = makeTable({
        col: makeColumn({ dataType: 'custom', enumValues: ['a', 'b'] }),
      })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('enum')
    })

    it('maps string-backed enum columns to "enum"', () => {
      const table = makeTable({
        col: makeColumn({ dataType: 'string', enumValues: ['draft', 'published'] }),
      })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('enum')
    })

    it('falls back to "text" for unknown types', () => {
      const table = makeTable({ col: makeColumn({ dataType: 'unknown_thing' }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].dataType).toBe('text')
    })

    it('sets isNullable based on inverted notNull flag', () => {
      const table = makeTable({
        a: makeColumn({ name: 'a', notNull: true }),
        b: makeColumn({ name: 'b', notNull: false }),
      })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].isNullable).toBe(false)
      expect(columns[1].isNullable).toBe(true)
    })

    it('sets isPrimaryKey from column', () => {
      const table = makeTable({ id: makeColumn({ name: 'id', primary: true }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].isPrimaryKey).toBe(true)
    })

    it('sets hasDefault from column', () => {
      const table = makeTable({ col: makeColumn({ hasDefault: true }) })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].hasDefault).toBe(true)
    })

    it('returns enumValues when present', () => {
      const table = makeTable({
        col: makeColumn({ dataType: 'custom', enumValues: ['x', 'y'] }),
      })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].enumValues).toEqual(['x', 'y'])
    })

    it('returns undefined for enumValues when not present', () => {
      const table = makeTable({ col: makeColumn() })
      const columns = postgresqlAdapter.extractColumns(table)
      expect(columns[0].enumValues).toBeUndefined()
    })

    it('extracts single-column foreign key references using SQL names', () => {
      const users = pgTable('users', {
        id: integer('user_id').primaryKey(),
      })
      const posts = pgTable('blog_posts', {
        authorId: integer('author_id').references(() => users.id),
      })

      expect(postgresqlAdapter.extractColumns(posts)[0].references).toEqual({
        table: 'users',
        column: 'user_id',
      })
    })

    it('skips composite foreign key references', () => {
      const parents = pgTable('parents', {
        tenantId: integer('tenant_id').notNull(),
        id: integer('id').notNull(),
      })
      const children = pgTable('children', {
        parentTenantId: integer('parent_tenant_id'),
        parentId: integer('parent_id'),
      }, (table) => ({
        parentReference: foreignKey({
          columns: [table.parentTenantId, table.parentId],
          foreignColumns: [parents.tenantId, parents.id],
        }),
      }))

      const columns = postgresqlAdapter.extractColumns(children)
      expect(columns.every((column) => column.references === undefined)).toBe(true)
    })
  })
})
