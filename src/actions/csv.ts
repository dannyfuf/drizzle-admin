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
import type { PgTable } from 'drizzle-orm/pg-core'
import { createDrizzleBackend } from '@/backends/drizzle.ts'
import { createKnexBackend } from '@/backends/knex.ts'
import type { AnyKnexDatabase, AnyPgDatabase } from '@/types.ts'
import { isKnexTableDefinition } from '@/resources/define.ts'
import type { CollectionAction, KnexTableDefinition } from '@/resources/types.ts'

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
export function createCsvExportAction(table: PgTable): CollectionAction<AnyPgDatabase>
export function createCsvExportAction(table: KnexTableDefinition): CollectionAction<AnyKnexDatabase>
export function createCsvExportAction(
  table: PgTable | KnexTableDefinition,
): CollectionAction<AnyPgDatabase> | CollectionAction<AnyKnexDatabase> {
  return {
    name: 'Export CSV',
    handler: async (_c: Context, db: AnyPgDatabase | AnyKnexDatabase) => {
      if (isKnexTableDefinition(table)) {
        const backend = createKnexBackend(db as AnyKnexDatabase)
        return buildCsvResponse(backend.getTableName(table), await backend.exportAll(table))
      }

      const backend = createDrizzleBackend(db as AnyPgDatabase)
      return buildCsvResponse(backend.getTableName(table), await backend.exportAll(table))
    },
  }
}

function buildCsvResponse(tableName: string, records: Record<string, unknown>[]): Response {
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
}

function escapeCSV(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}
