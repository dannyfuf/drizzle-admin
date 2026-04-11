import { describe, it, expect, vi } from 'vitest'
import type { Table } from 'drizzle-orm'

vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns,
}))

import { postgresqlAdapter } from '@/dialects/postgresql.ts'

function makeTable(columns: Record<string, unknown>): Table {
  return { _columns: columns } as unknown as Table
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
  })
})
