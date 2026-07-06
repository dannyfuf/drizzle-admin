import { describe, expect, it, vi } from 'vitest'
import { PersistenceBackend } from '@/backends/persistence.ts'
import type { BackendRecord } from '@/backends/types.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ParsedFilter } from '@/resources/filters.ts'
import type {
  AnyPersistenceRecord,
  PersistenceModelInstance,
  PersistenceModelMetadata,
  PersistenceQueryChain,
  PersistenceRepository,
} from '@/types.ts'

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

function makeMetadata(columns: ColumnMeta[] = [makeColumn()]): PersistenceModelMetadata {
  return {
    tableName: 'posts',
    columns: columns.map((column) => column.name),
    primaryKey: columns.find((column) => column.isPrimaryKey)?.name ?? 'id',
    columnMetadata: columns.map((column) => ({
      name: column.name,
      dataType: column.dataType,
      isNullable: column.isNullable,
      isPrimaryKey: column.isPrimaryKey,
      hasDefault: column.hasDefault,
      ...(column.enumValues ? { enumValues: column.enumValues } : {}),
    })),
  }
}

function makeBackend(responses: Partial<FakeResponses> = {}) {
  const repository = new FakeRepository(makeMetadata(), responses)
  const factory = () => repository
  return { backend: new PersistenceBackend(), factory, repository }
}

describe('PersistenceBackend', () => {
  it('resolves resources from generated Persistence metadata', () => {
    const { backend, factory } = makeBackend()

    const resource = backend.resolveResource({ table: factory, options: { folder: 'Content' } })

    expect(resource).toMatchObject({
      tableName: 'posts',
      routePath: 'posts',
      displayName: 'Post',
      primaryKey: 'id',
      folder: 'Content',
    })
    expect(resource.columns).toEqual([makeColumn()])
  })

  it('counts and lists rows with PostgreSQL filter semantics', async () => {
    const title = makeColumn({ name: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false })
    const featured = makeColumn({ name: 'featured', dataType: 'boolean', isPrimaryKey: false, hasDefault: false })
    const repository = new FakeRepository(makeMetadata([makeColumn(), title, featured]), {
      countRows: [{ count: '2' }],
      rows: [{ id: 1, title: 'Hello', featured: false }],
    })
    const backend = new PersistenceBackend()
    const resource = backend.resolveResource({ table: () => repository, options: {} })

    const count = await backend.count(resource, [
      makeParsedFilter(resource.columns[1]!, 'Hello'),
      makeParsedFilter(resource.columns[2]!, false),
    ])
    const rows = await backend.list(resource, { filters: [], limit: 10, offset: 20 })

    expect(count).toBe(2)
    expect(rows).toEqual([{ id: 1, title: 'Hello', featured: false }])
    expect(repository.calls).toContainEqual({ method: 'where', args: ['title', 'ilike', '%Hello%'] })
    expect(repository.calls).toContainEqual({ method: 'where', args: ['featured', false] })
    expect(repository.calls).toContainEqual({ method: 'limit', args: [10] })
    expect(repository.calls).toContainEqual({ method: 'offset', args: [20] })
  })

  it('sorts through the builder when a sort option is given', async () => {
    const title = makeColumn({ name: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false })
    const repository = new FakeRepository(makeMetadata([makeColumn(), title]), { rows: [] })
    const backend = new PersistenceBackend()
    const resource = backend.resolveResource({ table: () => repository, options: {} })

    await backend.list(resource, {
      filters: [],
      limit: 10,
      offset: 0,
      sort: { column: 'title', direction: 'asc' },
    })

    expect(repository.calls).toContainEqual({ method: 'orderBy', args: ['title', 'asc'] })
  })

  it('ignores sort when the builder does not expose orderBy', async () => {
    const title = makeColumn({ name: 'title', dataType: 'text', isPrimaryKey: false, hasDefault: false })
    const repository = new FakeRepository(makeMetadata([makeColumn(), title]), { rows: [{ id: 1, title: 'Hello' }] })
    const originalCreateBuilder = repository.createBuilder.bind(repository)
    repository.createBuilder = () => {
      const builder = originalCreateBuilder()
      ;(builder as { orderBy?: unknown }).orderBy = undefined
      return builder
    }
    const backend = new PersistenceBackend()
    const resource = backend.resolveResource({ table: () => repository, options: {} })

    const rows = await backend.list(resource, {
      filters: [],
      limit: 10,
      offset: 0,
      sort: { column: 'title', direction: 'asc' },
    })

    expect(rows).toEqual([{ id: 1, title: 'Hello' }])
    expect(repository.calls.some((call) => call.method === 'orderBy')).toBe(false)
  })

  it('finds, creates, updates, deletes, and exports records through repositories', async () => {
    const assignAndSave = vi.fn(async () => {})
    const repository = new FakeRepository(makeMetadata(), {
      rows: [{ id: 1, title: 'Hello' }],
      findResult: makeInstance({ id: 1, title: 'Hello' }, assignAndSave),
      created: makeInstance({ id: 2, title: 'Created' }),
    })
    const backend = new PersistenceBackend()
    const factory = () => repository
    const resource = backend.resolveResource({ table: factory, options: {} })

    await expect(backend.findById(resource, '1')).resolves.toEqual({ id: 1, title: 'Hello' })
    await expect(backend.insert(resource, { title: 'Created' })).resolves.toEqual({ id: 2, title: 'Created' })
    await backend.update(resource, '1', { title: 'Updated' })
    await backend.delete(resource, '1')
    await expect(backend.exportAll(factory)).resolves.toEqual([{ id: 1, title: 'Hello' }])

    expect(assignAndSave).toHaveBeenCalledWith({ title: 'Updated' })
    expect(repository.calls).toContainEqual({ method: 'delete', args: [] })
  })

  it('normalizes conventional Persistence admin user columns', async () => {
    const adminMetadata = makeMetadata([
      makeColumn(),
      makeColumn({ name: 'email', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      makeColumn({ name: 'password_hash', dataType: 'text', isPrimaryKey: false, hasDefault: false }),
      makeColumn({ name: 'created_at', dataType: 'timestamp', isPrimaryKey: false, hasDefault: true }),
      makeColumn({ name: 'updated_at', dataType: 'timestamp', isPrimaryKey: false, hasDefault: true }),
    ])
    const repository = new FakeRepository(adminMetadata, {
      firstRow: { id: 1, email: 'admin@test.com', password_hash: 'hash' },
    })
    const backend = new PersistenceBackend()
    const factory = () => repository

    expect(() => backend.validateAdminUsersTable(factory)).not.toThrow()
    await expect(backend.findAdminByEmail(factory, 'admin@test.com')).resolves.toMatchObject({
      passwordHash: 'hash',
    })
    await backend.insertAdminUser(factory, { email: 'admin@test.com', passwordHash: 'hash' })

    expect(repository.calls).toContainEqual({ method: 'where', args: ['email', 'admin@test.com'] })
    expect(repository.calls).toContainEqual({ method: 'create', args: [{ email: 'admin@test.com', password_hash: 'hash' }] })
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

function makeInstance(
  row: BackendRecord,
  assignAndSave: (values: AnyPersistenceRecord) => Promise<unknown> = async () => {},
): PersistenceModelInstance {
  return {
    ...row,
    attributes: () => ({ ...row }),
    assignAndSave,
  }
}

interface FakeResponses {
  countRows: BackendRecord[]
  rows: BackendRecord[]
  firstRow: BackendRecord | undefined
  findResult: PersistenceModelInstance | null
  created: PersistenceModelInstance
}

interface FakeCall {
  method: string
  args: unknown[]
}

class FakeRepository implements PersistenceRepository {
  readonly calls: FakeCall[] = []

  constructor(
    readonly metadata: PersistenceModelMetadata,
    private readonly responses: Partial<FakeResponses> = {},
  ) {}

  async create(values: AnyPersistenceRecord): Promise<PersistenceModelInstance> {
    this.calls.push({ method: 'create', args: [values] })
    return this.responses.created ?? makeInstance(values)
  }

  async find(id: string | number): Promise<PersistenceModelInstance | null> {
    this.calls.push({ method: 'find', args: [id] })
    return this.responses.findResult ?? null
  }

  where(attrs: AnyPersistenceRecord): PersistenceQueryChain {
    this.calls.push({ method: 'chainWhere', args: [attrs] })
    return new FakeQueryChain(this.calls)
  }

  query() {
    return new FakeAdvancedQuery()
  }

  createBuilder() {
    return new FakeQueryBuilder(this.calls, this.responses)
  }
}

class FakeQueryChain implements PersistenceQueryChain {
  constructor(private readonly calls: FakeCall[]) {}

  where(attrs: AnyPersistenceRecord): PersistenceQueryChain {
    this.calls.push({ method: 'chainWhere', args: [attrs] })
    return this
  }

  limit(count: number): PersistenceQueryChain {
    this.calls.push({ method: 'chainLimit', args: [count] })
    return this
  }

  offset(count: number): PersistenceQueryChain {
    this.calls.push({ method: 'chainOffset', args: [count] })
    return this
  }

  async count(): Promise<number> {
    return 0
  }

  async all(): Promise<PersistenceModelInstance[]> {
    return []
  }

  async first(): Promise<PersistenceModelInstance | null> {
    return null
  }

  async update(values: AnyPersistenceRecord): Promise<number> {
    this.calls.push({ method: 'chainUpdate', args: [values] })
    return 1
  }

  async delete(): Promise<number> {
    this.calls.push({ method: 'delete', args: [] })
    return 1
  }

  query() {
    return new FakeAdvancedQuery()
  }
}

class FakeQueryBuilder implements PromiseLike<AnyPersistenceRecord[]> {
  private result: AnyPersistenceRecord[] = []

  constructor(
    private readonly calls: FakeCall[],
    private readonly responses: Partial<FakeResponses>,
  ) {}

  select(...args: unknown[]) {
    this.calls.push({ method: 'select', args })
    this.result = this.responses.rows ?? []
    return this
  }

  where(...args: unknown[]) {
    this.calls.push({ method: 'where', args })
    return this
  }

  count(...args: unknown[]) {
    this.calls.push({ method: 'count', args })
    this.result = this.responses.countRows ?? [{ count: 0 }]
    return this
  }

  first(): Promise<AnyPersistenceRecord | undefined> {
    this.calls.push({ method: 'first', args: [] })
    return Promise.resolve(this.responses.firstRow)
  }

  limit(count: number) {
    this.calls.push({ method: 'limit', args: [count] })
    return this
  }

  offset(count: number) {
    this.calls.push({ method: 'offset', args: [count] })
    return this
  }

  orderBy(column: string, direction: 'asc' | 'desc') {
    this.calls.push({ method: 'orderBy', args: [column, direction] })
    return this
  }

  then<TResult1 = AnyPersistenceRecord[], TResult2 = never>(
    onfulfilled?: ((value: AnyPersistenceRecord[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return Promise.resolve(this.result).then(onfulfilled, onrejected)
  }
}

class FakeAdvancedQuery {
  where(): FakeAdvancedQuery {
    return this
  }

  whereRaw(): FakeAdvancedQuery {
    return this
  }

  limit(): FakeAdvancedQuery {
    return this
  }

  offset(): FakeAdvancedQuery {
    return this
  }

  async rows(): Promise<AnyPersistenceRecord[]> {
    return []
  }

  async row(): Promise<AnyPersistenceRecord | null> {
    return null
  }
}
