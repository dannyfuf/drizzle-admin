import { describe, expect, it } from 'vitest'
import { buildSortQuery, isSortableColumn, parseSortState } from '@/resources/sort.ts'
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

describe('parseSortState', () => {
  const sortableColumns = [makeColumn({ name: 'id' }), makeColumn({ name: 'title' })]

  it('returns undefined when no sort column is given', () => {
    expect(parseSortState({ rawColumn: undefined, rawDirection: 'asc', sortableColumns })).toBeUndefined()
    expect(parseSortState({ rawColumn: '', rawDirection: 'asc', sortableColumns })).toBeUndefined()
  })

  it('rejects columns that are not sortable', () => {
    const result = parseSortState({ rawColumn: 'passwordHash', rawDirection: 'asc', sortableColumns })
    expect(result).toBeUndefined()
  })

  it('parses a valid column with explicit direction', () => {
    const result = parseSortState({ rawColumn: 'title', rawDirection: 'desc', sortableColumns })
    expect(result).toEqual({ column: 'title', direction: 'desc' })
  })

  it('defaults to ascending for missing or invalid directions', () => {
    expect(parseSortState({ rawColumn: 'title', rawDirection: undefined, sortableColumns }))
      .toEqual({ column: 'title', direction: 'asc' })
    expect(parseSortState({ rawColumn: 'title', rawDirection: 'sideways', sortableColumns }))
      .toEqual({ column: 'title', direction: 'asc' })
  })
})

describe('buildSortQuery', () => {
  it('returns an empty object without sort state', () => {
    expect(buildSortQuery(undefined)).toEqual({})
  })

  it('serializes sort state into query params', () => {
    expect(buildSortQuery({ column: 'title', direction: 'desc' })).toEqual({ sort: 'title', order: 'desc' })
  })
})

describe('isSortableColumn', () => {
  it('rejects json columns', () => {
    expect(isSortableColumn(makeColumn({ dataType: 'json' }))).toBe(false)
  })

  it('accepts other data types', () => {
    for (const dataType of ['text', 'integer', 'boolean', 'enum', 'timestamp']) {
      expect(isSortableColumn(makeColumn({ dataType }))).toBe(true)
    }
  })
})
