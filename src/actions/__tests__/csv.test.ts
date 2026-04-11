import { describe, it, expect, vi } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'
import type { Context } from 'hono'

vi.mock('drizzle-orm', () => ({
  getTableName: () => 'test_table',
}))

import { createCsvExportAction } from '@/actions/csv.ts'

const fakeTable = { _name: 'test_table' } as unknown as PgTable

function makeMockDb(records: Record<string, unknown>[]): AnyPgDatabase {
  return {
    select: () => ({
      from: () => Promise.resolve(records),
    }),
  } as unknown as AnyPgDatabase
}

describe('createCsvExportAction', () => {
  it('returns action with name "Export CSV"', () => {
    const action = createCsvExportAction(fakeTable)
    expect(action.name).toBe('Export CSV')
  })

  it('returns plain text response when no records exist', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([])
    const response = await action.handler({} as unknown as Context, db) as Response

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toBe('text/plain')
    expect(await response.text()).toBe('No records to export')
  })

  it('generates CSV with header row and data rows', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([
      { id: 1, name: 'Alice', email: 'alice@test.com' },
      { id: 2, name: 'Bob', email: 'bob@test.com' },
    ])
    const response = await action.handler({} as unknown as Context, db) as Response
    const csv = await response.text()

    const lines = csv.split('\n')
    expect(lines[0]).toBe('id,name,email')
    expect(lines[1]).toBe('1,Alice,alice@test.com')
    expect(lines[2]).toBe('2,Bob,bob@test.com')
  })

  it('sets Content-Type to text/csv', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([{ id: 1 }])
    const response = await action.handler({} as unknown as Context, db) as Response

    expect(response.headers.get('Content-Type')).toBe('text/csv')
  })

  it('sets Content-Disposition header with table name', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([{ id: 1 }])
    const response = await action.handler({} as unknown as Context, db) as Response

    expect(response.headers.get('Content-Disposition')).toBe(
      'attachment; filename="test_table.csv"'
    )
  })

  it('escapes values containing commas', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([{ name: 'Smith, John' }])
    const response = await action.handler({} as unknown as Context, db) as Response
    const csv = await response.text()

    expect(csv).toContain('"Smith, John"')
  })

  it('escapes values containing double quotes', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([{ name: 'He said "hello"' }])
    const response = await action.handler({} as unknown as Context, db) as Response
    const csv = await response.text()

    expect(csv).toContain('"He said ""hello"""')
  })

  it('escapes values containing newlines', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([{ bio: 'line1\nline2' }])
    const response = await action.handler({} as unknown as Context, db) as Response
    const csv = await response.text()

    expect(csv).toContain('"line1\nline2"')
  })

  it('handles null and undefined values as empty strings', async () => {
    const action = createCsvExportAction(fakeTable)
    const db = makeMockDb([{ a: null, b: undefined }])
    const response = await action.handler({} as unknown as Context, db) as Response
    const csv = await response.text()

    const lines = csv.split('\n')
    expect(lines[1]).toBe(',')
  })
})
