import { describe, expect, it } from 'vitest'
import { KnexBackend } from '@/backends/knex.ts'
import type { BackendRecord } from '@/backends/types.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ParsedFilter } from '@/resources/filters.ts'
import type { KnexTableDefinition } from '@/resources/types.ts'
import type { AnyKnexDatabase } from '@/types.ts'

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: 'id',
    sqlName: 'id',
    dataType: 'integer',
    isNullable: false,
    isPrimaryKey: true,
    hasDefault: true,
    ...overrides,
  }
}

function makeTable(columns: ColumnMeta[] = [makeColumn()]): KnexTableDefinition {
  return { tableName: 'posts', columns }
}

function makeBackend(responses: Partial<FakeResponses> = {}) {
  const calls: FakeCall[] = []
  const db = ((tableName: string) => new FakeQuery(tableName, calls, responses)) as unknown as AnyKnexDatabase
  return { backend: new KnexBackend(db), calls }
}

describe('KnexBackend', () => {
  it('resolves resources from explicit metadata', () => {
    const { backend } = makeBackend()
    const table = makeTable([
      makeColumn(),
      makeColumn({ name: 'title', sqlName: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
    ])

    const resource = backend.resolveResource({ table, options: { folder: 'Content' } })

    expect(resource).toMatchObject({
      tableName: 'posts',
      routePath: 'posts',
      displayName: 'Post',
      primaryKey: 'id',
      folder: 'Content',
    })
    expect(resource.columns).toHaveLength(2)
  })

  it('counts rows and applies PostgreSQL filter semantics', async () => {
    const { backend, calls } = makeBackend({ countRows: [{ count: '2' }] })
    const table = makeTable([
      makeColumn(),
      makeColumn({ name: 'title', sqlName: 'post_title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      makeColumn({ name: 'featured', sqlName: 'is_featured', dataType: 'boolean', isPrimaryKey: false, hasDefault: false }),
    ])
    const resource = backend.resolveResource({ table, options: {} })

    const count = await backend.count(resource, [
      makeParsedFilter(resource.columns[1]!, 'Hello'),
      makeParsedFilter(resource.columns[2]!, false),
    ])

    expect(count).toBe(2)
    expect(calls).toContainEqual({ method: 'where', args: ['post_title', 'ilike', '%Hello%'] })
    expect(calls).toContainEqual({ method: 'where', args: ['is_featured', false] })
  })

  it('lists rows with pagination and normalizes SQL column names', async () => {
    const { backend, calls } = makeBackend({
      selectRows: [{ id: 1, post_title: 'Hello' }],
    })
    const resource = backend.resolveResource({
      table: makeTable([
        makeColumn(),
        makeColumn({ name: 'title', sqlName: 'post_title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      ]),
      options: {},
    })

    const rows = await backend.list(resource, { filters: [], limit: 10, offset: 20 })

    expect(rows).toEqual([{ id: 1, title: 'Hello' }])
    expect(calls).toContainEqual({ method: 'limit', args: [10] })
    expect(calls).toContainEqual({ method: 'offset', args: [20] })
  })

  it('uses primary key SQL names for find, update, and delete', async () => {
    const { backend, calls } = makeBackend({ firstRow: { post_id: 1, title: 'Hello' } })
    const resource = backend.resolveResource({
      table: makeTable([
        makeColumn({ name: 'id', sqlName: 'post_id' }),
        makeColumn({ name: 'title', sqlName: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      ]),
      options: {},
    })

    await expect(backend.findById(resource, '1')).resolves.toMatchObject({ id: 1 })
    await backend.update(resource, '1', { title: 'Updated' })
    await backend.delete(resource, '1')

    expect(calls.filter((call) => call.method === 'where')).toEqual([
      { method: 'where', args: ['post_id', '1'] },
      { method: 'where', args: ['post_id', '1'] },
      { method: 'where', args: ['post_id', '1'] },
    ])
  })

  it('maps logical values to SQL names when inserting records', async () => {
    const { backend, calls } = makeBackend({ insertRows: [{ id: 1, post_title: 'Hello' }] })
    const resource = backend.resolveResource({
      table: makeTable([
        makeColumn(),
        makeColumn({ name: 'title', sqlName: 'post_title', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      ]),
      options: {},
    })

    const created = await backend.insert(resource, { title: 'Hello' })

    expect(created).toMatchObject({ id: 1, title: 'Hello' })
    expect(calls).toContainEqual({ method: 'insert', args: [{ post_title: 'Hello' }] })
  })

  it('validates and queries admin users by logical columns', async () => {
    const { backend, calls } = makeBackend({ firstRow: { id: 1, email: 'admin@test.com', password_hash: 'hash' } })
    const adminUsers = makeTable([
      makeColumn(),
      makeColumn({ name: 'email', sqlName: 'email', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      makeColumn({ name: 'passwordHash', sqlName: 'password_hash', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      makeColumn({ name: 'createdAt', sqlName: 'created_at', dataType: 'timestamp', isPrimaryKey: false, hasDefault: true }),
      makeColumn({ name: 'updatedAt', sqlName: 'updated_at', dataType: 'timestamp', isPrimaryKey: false, hasDefault: true }),
    ])

    expect(() => backend.validateAdminUsersTable(adminUsers)).not.toThrow()
    await expect(backend.findAdminByEmail(adminUsers, 'admin@test.com')).resolves.toMatchObject({
      passwordHash: 'hash',
    })
    await backend.insertAdminUser(adminUsers, { email: 'admin@test.com', passwordHash: 'hash' })

    expect(calls).toContainEqual({ method: 'where', args: ['email', 'admin@test.com'] })
    expect(calls).toContainEqual({ method: 'insert', args: [{ email: 'admin@test.com', password_hash: 'hash' }] })
  })
})

function makeParsedFilter(column: ColumnMeta, value: string | boolean): ParsedFilter {
  return {
    filter: {
      name: column.name,
      queryKey: `filter_${column.name}`,
      column,
    },
    rawValue: String(value),
    value,
  }
}

interface FakeResponses {
  countRows: BackendRecord[]
  selectRows: BackendRecord[]
  firstRow: BackendRecord | undefined
  insertRows: BackendRecord[]
}

interface FakeCall {
  method: string
  args: unknown[]
}

class FakeQuery {
  private result: unknown = []

  constructor(
    private readonly tableName: string,
    private readonly calls: FakeCall[],
    private readonly responses: Partial<FakeResponses>,
  ) {
    this.calls.push({ method: 'table', args: [tableName] })
  }

  count(args: unknown) {
    this.calls.push({ method: 'count', args: [args] })
    this.result = this.responses.countRows ?? [{ count: 0 }]
    return this
  }

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args })
    this.result = this.responses.selectRows ?? []
    return this
  }

  where(...args: unknown[]) {
    this.calls.push({ method: 'where', args })
    return this
  }

  first() {
    this.calls.push({ method: 'first', args: [] })
    return Promise.resolve(this.responses.firstRow)
  }

  insert(values: BackendRecord) {
    this.calls.push({ method: 'insert', args: [values] })
    this.result = this.responses.insertRows ?? []
    return this
  }

  update(values: BackendRecord) {
    this.calls.push({ method: 'update', args: [values] })
    return Promise.resolve(1)
  }

  delete() {
    this.calls.push({ method: 'delete', args: [] })
    return Promise.resolve(1)
  }

  returning(...args: unknown[]) {
    this.calls.push({ method: 'returning', args })
    return Promise.resolve(this.result)
  }

  limit(value: number) {
    this.calls.push({ method: 'limit', args: [value] })
    return this
  }

  offset(value: number) {
    this.calls.push({ method: 'offset', args: [value] })
    return this
  }

  then<TResult1 = unknown, TResult2 = never>(
    onfulfilled?: ((value: unknown) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}
