/**
 * @module
 * CSV export action for DrizzleAdmin resources.
 *
 * Provides a factory function to create a collection action that exports
 * all records from a table as a downloadable CSV file.
 *
 * @example
 * ```ts
 * import { createCsvExportAction } from "@dafu/drizzle-admin/actions/csv";
 * import { defineResource } from "@dafu/drizzle-admin";
 * import { posts } from "./schema.ts";
 *
 * export default defineResource(posts, {
 *   collectionActions: [createCsvExportAction(posts)],
 * });
 * ```
 */

import type { Context } from 'hono'
import type { Table } from 'drizzle-orm'
import { getTableName } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'
import type { CollectionAction } from '@/resources/types.ts'

/**
 * Creates a collection action that exports all records from a Drizzle table as CSV.
 *
 * The generated CSV includes a header row derived from column names and properly
 * escapes values containing commas, quotes, or newlines. Returns an empty text
 * response if the table has no records.
 *
 * @param table - A Drizzle ORM table object to export records from.
 * @returns A {@link CollectionAction} that triggers a CSV file download.
 */
export function createCsvExportAction(table: Table): CollectionAction {
  return {
    name: 'Export CSV',
    handler: async (_c: Context, db: AnyPgDatabase) => {
      const tableName = getTableName(table)
      const pgTable = table as PgTable
      const records: Record<string, unknown>[] = await db.select().from(pgTable)

      if (records.length === 0) {
        return new Response('No records to export', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      const headers = Object.keys(records[0]!)
      const rows = records.map((r) =>
        headers.map(h => escapeCSV(r[h])).join(',')
      )
      const csv = [headers.join(','), ...rows].join('\n')

      return new Response(csv, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="${tableName}.csv"`,
        },
      })
    },
  }
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
