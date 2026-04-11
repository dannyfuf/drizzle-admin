import { getTableColumns, type Column, type Table } from 'drizzle-orm'
import type { ColumnMeta, DialectAdapter } from '@/dialects/types.ts'

export const postgresqlAdapter: DialectAdapter = {
  name: 'postgresql',

  extractColumns(table: Table): ColumnMeta[] {
    const columns = getTableColumns(table)

    return Object.entries(columns).map(([name, column]) => ({
      name,
      sqlName: column.name,
      dataType: mapPgType(column),
      isNullable: !column.notNull,
      isPrimaryKey: column.primary,
      hasDefault: column.hasDefault,
      enumValues: extractEnumValues(column),
    }))
  },
}

function mapPgType(column: Column): string {
  const type = column.dataType
  if (type === 'string') return 'text'
  if (type === 'number' || type === 'bigint') return 'integer'
  if (type === 'boolean') return 'boolean'
  if (type === 'date') return 'timestamp'
  if (type === 'json') return 'json'
  if (column.enumValues) return 'enum'
  return 'text'
}

function extractEnumValues(column: Column): string[] | undefined {
  return column.enumValues ?? undefined
}
