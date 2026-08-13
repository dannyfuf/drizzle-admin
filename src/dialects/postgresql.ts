import { getTableColumns, getTableName, type Column } from 'drizzle-orm'
import { getTableConfig, type PgTable } from 'drizzle-orm/pg-core'
import type { ColumnMeta, DialectAdapter } from '@/dialects/types.ts'

export const postgresqlAdapter: DialectAdapter<PgTable> = {
  name: 'postgresql',

  extractColumns(table: PgTable): ColumnMeta[] {
    const columns = getTableColumns(table)
    const references = extractReferences(table)

    return Object.entries(columns).map(([name, column]) => ({
      name,
      sqlName: column.name,
      dataType: mapPgType(column),
      isNullable: !column.notNull,
      isPrimaryKey: column.primary,
      hasDefault: column.hasDefault,
      enumValues: extractEnumValues(column),
      references: references.get(column.name),
    }))
  },
}

function extractReferences(table: PgTable): Map<string, { table: string; column: string }> {
  const references = new Map<string, { table: string; column: string }>()

  for (const foreignKey of getTableConfig(table).foreignKeys) {
    const { columns, foreignColumns } = foreignKey.reference()
    if (columns.length !== 1 || foreignColumns.length !== 1) continue

    const [column] = columns
    const [foreignColumn] = foreignColumns
    references.set(column.name, {
      table: getTableName(foreignColumn.table),
      column: foreignColumn.name,
    })
  }

  return references
}

function mapPgType(column: Column): string {
  const type = column.dataType
  if (column.enumValues) return 'enum'
  if (type === 'string') return 'text'
  if (type === 'number' || type === 'bigint') return 'integer'
  if (type === 'boolean') return 'boolean'
  if (type === 'date') return 'timestamp'
  if (type === 'json') return 'json'
  return 'text'
}

function extractEnumValues(column: Column): string[] | undefined {
  return column.enumValues ?? undefined
}
