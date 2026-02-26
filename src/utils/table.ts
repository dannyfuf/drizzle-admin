import { getTableName } from 'drizzle-orm'

export function tableNameToRoutePath(tableName: string): string {
  return tableName.replace(/_/g, '-')
}

export function getTableSqlName(table: unknown): string {
  return getTableName(table as any)
}

export function tableNameToDisplayName(tableName: string): string {
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/s$/, '')
}
