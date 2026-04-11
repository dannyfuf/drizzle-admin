import { getTableName } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

export function tableNameToRoutePath(tableName: string): string {
  return tableName.replace(/_/g, '-')
}

export function getTableSqlName(table: PgTable): string {
  return getTableName(table)
}

export function tableNameToDisplayName(tableName: string): string {
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/s$/, '')
}
