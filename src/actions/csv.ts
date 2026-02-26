import type { Context } from 'hono'
import { getTableName } from 'drizzle-orm'
import type { CollectionAction } from '../resources/types.js'

export function createCsvExportAction(table: unknown): CollectionAction {
  return {
    name: 'Export CSV',
    handler: async (c: Context, db: any) => {
      const tableName = getTableName(table as any)
      const records = await db.select().from(table as any)

      if (records.length === 0) {
        return new Response('No records to export', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        })
      }

      const headers = Object.keys(records[0])
      const rows = records.map((r: any) =>
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
