import type { AdminBackend, BackendRecord, ListRecordsOptions, ResourceResolveInput } from '@/backends/types.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ParsedFilter } from '@/resources/filters.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import type {
  AnyPersistenceRecord,
  PersistenceActionContext,
  PersistenceColumnMetadata,
  PersistenceModelInstance,
  PersistenceModelMetadata,
  PersistenceQueryBuilder,
  PersistenceRepository,
  PersistenceResourceRef,
} from '@/types.ts'
import { tableNameToDisplayName, tableNameToRoutePath } from '@/utils/table.ts'

export class PersistenceBackend implements AdminBackend<PersistenceActionContext, PersistenceResourceRef> {
  readonly name = 'persistence'
  readonly actionDatabase: PersistenceActionContext

  constructor() {
    this.actionDatabase = this.createActionContext()
  }

  getActionContext(resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>): PersistenceActionContext {
    return this.createActionContext(resource.table)
  }

  getTableName(table: PersistenceResourceRef): string {
    return this.getRepositoryMetadata(table).tableName
  }

  extractColumns(table: PersistenceResourceRef): ColumnMeta[] {
    const metadata = this.getRepositoryMetadata(table)
    return metadata.columnMetadata.map((column) => this.toColumnMeta(metadata, column))
  }

  resolveResource(
    input: ResourceResolveInput<PersistenceResourceRef, PersistenceActionContext>,
  ): ResourceDefinition<PersistenceResourceRef, PersistenceActionContext> {
    const metadata = this.getRepositoryMetadata(input.table)
    const columns = this.extractColumns(input.table)

    return {
      table: input.table,
      tableName: metadata.tableName,
      routePath: tableNameToRoutePath(metadata.tableName),
      displayName: tableNameToDisplayName(metadata.tableName),
      primaryKey: columns.find((column) => column.isPrimaryKey)?.name ?? metadata.primaryKey,
      columns,
      options: input.options,
      folder: input.options.folder,
    }
  }

  async count(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    filters: ParsedFilter[],
  ): Promise<number> {
    const builder = this.getRepository(resource.table).createBuilder()
    this.applyFilters(builder, resource, filters)
    const [row] = await builder.count({ count: '*' })

    return normalizeCount(row)
  }

  async list(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    options: ListRecordsOptions,
  ): Promise<BackendRecord[]> {
    const builder = this.getRepository(resource.table)
      .createBuilder()
      .select('*')
      .limit(options.limit)
      .offset(options.offset)
    this.applyFilters(builder, resource, options.filters)
    if (options.sort && typeof builder.orderBy === 'function') {
      const column = this.getColumn(resource, options.sort.column)
      builder.orderBy(column.sqlName, options.sort.direction)
    }
    const rows = await builder

    return rows.map((row) => this.normalizeRecord(row))
  }

  async findById(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    id: string,
  ): Promise<BackendRecord | undefined> {
    const record = await this.getRepository(resource.table).find(id)
    return record ? this.normalizeRecord(record) : undefined
  }

  async insert(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    values: BackendRecord,
  ): Promise<BackendRecord> {
    const created = await this.getRepository(resource.table).create(values)
    return this.normalizeRecord(created)
  }

  async update(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    id: string,
    values: BackendRecord,
  ): Promise<void> {
    const repository = this.getRepository(resource.table)
    const record = await repository.find(id)

    if (!record) {
      throw new Error(`Persistence record "${resource.tableName}" with ${resource.primaryKey} "${id}" was not found.`)
    }

    if (typeof record.assignAndSave === 'function') {
      await record.assignAndSave(values)
      return
    }

    await repository.where({ [resource.primaryKey]: id }).update(values)
  }

  async delete(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    id: string,
  ): Promise<void> {
    await this.getRepository(resource.table).where({ [resource.primaryKey]: id }).delete()
  }

  async exportAll(table: PersistenceResourceRef): Promise<BackendRecord[]> {
    const rows = await this.getRepository(table).createBuilder().select('*')
    return rows.map((row) => this.normalizeRecord(row))
  }

  validateAdminUsersTable(table: PersistenceResourceRef): void {
    const metadata = this.getRepositoryMetadata(table)
    const columnNames = metadata.columnMetadata.map((column) => column.name)
    const requiredColumns = ['id', 'email', 'password_hash', 'created_at', 'updated_at']

    for (const required of requiredColumns) {
      if (!columnNames.includes(required)) {
        throw new Error(
          `Persistence adminUsers model must have a "${required}" column. Found columns: ${columnNames.join(', ')}`,
        )
      }
    }
  }

  async findAdminByEmail(table: PersistenceResourceRef, email: string): Promise<BackendRecord | undefined> {
    const row = await this.getRepository(table)
      .createBuilder()
      .select('*')
      .where('email', email)
      .first()

    return row ? this.normalizeAdminRecord(row) : undefined
  }

  async insertAdminUser(table: PersistenceResourceRef, values: BackendRecord): Promise<void> {
    await this.getRepository(table).create(this.toAdminPersistenceValues(values))
  }

  getRepository(table: PersistenceResourceRef): PersistenceRepository {
    if (isPersistenceRepository(table)) {
      return table
    }

    try {
      const repository = table()
      if (isPersistenceRepository(repository)) {
        return repository
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      throw new Error(
        `Failed to resolve Persistence repository. Ensure Model.configure({ connection, schema }) has run before DrizzleAdmin starts. ${message}`,
      )
    }

    throw new Error('Persistence resources must be repository factories returned by defineModel(...).')
  }

  private getRepositoryMetadata(table: PersistenceResourceRef): PersistenceModelMetadata {
    const metadata = this.getRepository(table).metadata

    if (!isPersistenceModelMetadata(metadata)) {
      throw new Error('Persistence repository metadata is unavailable. Ensure Model.configure({ schema }) has run before DrizzleAdmin starts.')
    }

    if (!Array.isArray(metadata.columnMetadata) || metadata.columnMetadata.length === 0) {
      throw new Error(
        `Persistence generated schema metadata for table "${metadata.tableName}" must include columnMetadata. Regenerate the schema with a Persistence version that emits admin metadata.`,
      )
    }

    return metadata
  }

  private toColumnMeta(metadata: PersistenceModelMetadata, column: PersistenceColumnMetadata): ColumnMeta {
    return {
      name: column.name,
      sqlName: column.name,
      dataType: normalizeDataType(column.dataType),
      isNullable: column.isNullable,
      isPrimaryKey: column.isPrimaryKey || column.name === metadata.primaryKey,
      hasDefault: column.hasDefault,
      ...(column.enumValues !== undefined ? { enumValues: [...column.enumValues] } : {}),
    }
  }

  private applyFilters(
    builder: PersistenceQueryBuilder,
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    filters: ParsedFilter[],
  ): void {
    for (const parsedFilter of filters) {
      const column = this.getColumn(resource, parsedFilter.filter.name)

      if (parsedFilter.filter.matchMode === 'contains') {
        builder.where(column.sqlName, 'ilike', `%${String(parsedFilter.value)}%`)
      } else {
        builder.where(column.sqlName, parsedFilter.value)
      }
    }
  }

  private getColumn(
    resource: ResourceDefinition<PersistenceResourceRef, PersistenceActionContext>,
    columnName: string,
  ): ColumnMeta {
    const column = resource.columns.find((candidate) => candidate.name === columnName)

    if (!column) {
      throw new Error(`Persistence table "${resource.tableName}" is missing column "${columnName}".`)
    }

    return column
  }

  private normalizeRecord(record: PersistenceModelInstance | AnyPersistenceRecord): BackendRecord {
    if (typeof record.attributes === 'function') {
      return record.attributes()
    }

    return Object.fromEntries(
      Object.entries(record).filter(([, value]) => typeof value !== 'function'),
    )
  }

  private normalizeAdminRecord(row: AnyPersistenceRecord): BackendRecord {
    const normalized = this.normalizeRecord(row)

    return {
      ...normalized,
      passwordHash: normalized.passwordHash ?? normalized.password_hash,
      createdAt: normalized.createdAt ?? normalized.created_at,
      updatedAt: normalized.updatedAt ?? normalized.updated_at,
    }
  }

  private toAdminPersistenceValues(values: BackendRecord): BackendRecord {
    const mapped: BackendRecord = { ...values }

    if (Object.hasOwn(mapped, 'passwordHash')) {
      mapped.password_hash = mapped.passwordHash
      delete mapped.passwordHash
    }

    if (Object.hasOwn(mapped, 'createdAt')) {
      mapped.created_at = mapped.createdAt
      delete mapped.createdAt
    }

    if (Object.hasOwn(mapped, 'updatedAt')) {
      mapped.updated_at = mapped.updatedAt
      delete mapped.updatedAt
    }

    return mapped
  }

  private createActionContext(table?: PersistenceResourceRef): PersistenceActionContext {
    const backend = this

    return {
      get repository() {
        if (!table) {
          throw new Error('Persistence action context is not bound to a resource.')
        }

        return backend.getRepository(table)
      },
      get metadata() {
        if (!table) {
          throw new Error('Persistence action context is not bound to a resource.')
        }

        return backend.getRepositoryMetadata(table)
      },
      getRepository(ref = table) {
        if (!ref) {
          throw new Error('Persistence action context requires a resource reference.')
        }

        return backend.getRepository(ref)
      },
    }
  }
}

export function createPersistenceBackend(): PersistenceBackend {
  return new PersistenceBackend()
}

function isPersistenceRepository(value: unknown): value is PersistenceRepository {
  return (
    typeof value === 'object' &&
    value !== null &&
    'metadata' in value &&
    'create' in value &&
    'find' in value &&
    'where' in value &&
    'createBuilder' in value
  )
}

function isPersistenceModelMetadata(value: unknown): value is PersistenceModelMetadata {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tableName' in value &&
    'columns' in value &&
    'columnMetadata' in value &&
    'primaryKey' in value &&
    typeof (value as PersistenceModelMetadata).tableName === 'string' &&
    Array.isArray((value as PersistenceModelMetadata).columns) &&
    Array.isArray((value as PersistenceModelMetadata).columnMetadata) &&
    typeof (value as PersistenceModelMetadata).primaryKey === 'string'
  )
}

function normalizeDataType(dataType: string): string {
  const normalized = dataType.toLowerCase()

  if (normalized === 'boolean' || normalized === 'bool') {
    return 'boolean'
  }

  if (['integer', 'int', 'int2', 'int4', 'serial'].includes(normalized)) {
    return 'integer'
  }

  if (normalized === 'enum') {
    return 'enum'
  }

  if (['json', 'jsonb'].includes(normalized)) {
    return 'json'
  }

  if (['timestamp', 'timestamptz', 'timestamp with time zone', 'timestamp without time zone', 'date'].includes(normalized)) {
    return 'timestamp'
  }

  return 'text'
}

function normalizeCount(row: AnyPersistenceRecord | undefined): number {
  if (!row) {
    return 0
  }

  if (row.count !== undefined) {
    return Number(row.count)
  }

  const [firstValue] = Object.values(row)
  return Number(firstValue ?? 0)
}
