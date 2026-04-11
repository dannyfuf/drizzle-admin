import { getTableColumns } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'

const REQUIRED_COLUMNS = ['id', 'email', 'passwordHash', 'createdAt', 'updatedAt'] as const

export function validateAdminUsersTable(table: PgTable): void {
  const columns = getTableColumns(table)
  const columnNames = Object.keys(columns)

  for (const required of REQUIRED_COLUMNS) {
    if (!columnNames.includes(required)) {
      throw new Error(
        `adminUsers table must have a "${required}" column. ` +
        `Found columns: ${columnNames.join(', ')}`
      )
    }
  }
}
