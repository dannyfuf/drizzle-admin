import type { ColumnMeta } from '@/dialects/types.ts'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  column: string
  direction: SortDirection
}

interface ParseSortStateOptions {
  rawColumn: string | undefined
  rawDirection: string | undefined
  sortableColumns: ColumnMeta[]
}

export function parseSortState(options: ParseSortStateOptions): SortState | undefined {
  const { rawColumn, rawDirection, sortableColumns } = options

  if (!rawColumn) {
    return undefined
  }

  const column = sortableColumns.find((candidate) => candidate.name === rawColumn)
  if (!column) {
    return undefined
  }

  return {
    column: column.name,
    direction: rawDirection === 'desc' ? 'desc' : 'asc',
  }
}

export function buildSortQuery(sort: SortState | undefined): Record<string, string> {
  if (!sort) {
    return {}
  }

  return { sort: sort.column, order: sort.direction }
}

// json columns have no ordering operator in PostgreSQL.
export function isSortableColumn(column: ColumnMeta): boolean {
  return column.dataType !== 'json'
}
