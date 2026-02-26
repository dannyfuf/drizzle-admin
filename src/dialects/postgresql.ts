import { getTableColumns } from 'drizzle-orm'
import type { ColumnMeta, DialectAdapter } from './types.js'

export const postgresqlAdapter: DialectAdapter = {
  name: 'postgresql',

  extractColumns(table: unknown): ColumnMeta[] {
    const columns = getTableColumns(table as any)

    return Object.entries(columns).map(([name, column]) => ({
      name,
      sqlName: (column as any).name,
      dataType: mapPgType(column),
      isNullable: !(column as any).notNull,
      isPrimaryKey: (column as any).primaryKey ?? false,
      hasDefault: (column as any).hasDefault ?? false,
      enumValues: extractEnumValues(column),
    }))
  },
}

function mapPgType(column: any): string {
  const type = column.dataType
  if (type === 'string' || type === 'text' || type === 'varchar') return 'text'
  if (type === 'number' || type === 'integer' || type === 'serial') return 'integer'
  if (type === 'boolean') return 'boolean'
  if (type === 'date' || type === 'timestamp') return 'timestamp'
  if (type === 'json' || type === 'jsonb') return 'json'
  if (column.enumValues) return 'enum'
  return 'text'
}

function extractEnumValues(column: any): string[] | undefined {
  return column.enumValues ?? undefined
}
