import type { Knex } from 'knex'
import type { AdminBackend, BackendRecord, ListRecordsOptions, ResourceResolveInput } from '@/backends/types.ts'
import { validateAdminUsersColumns } from '@/auth/contract.ts'
import type { ParsedFilter } from '@/resources/filters.ts'
import { validateKnexTableDefinition } from '@/resources/define.ts'
import type { KnexTableDefinition, ResourceDefinition } from '@/resources/types.ts'
import { tableNameToDisplayName, tableNameToRoutePath } from '@/utils/table.ts'

export class KnexBackend implements AdminBackend<Knex, KnexTableDefinition> {
  readonly name = 'knex'

  constructor(readonly actionDatabase: Knex) {}

  getTableName(table: KnexTableDefinition): string {
    return table.tableName
  }

  extractColumns(table: KnexTableDefinition) {
    return validateKnexTableDefinition(table).columns
  }

  resolveResource(input: ResourceResolveInput<KnexTableDefinition, Knex>): ResourceDefinition<KnexTableDefinition, Knex> {
    const table = validateKnexTableDefinition(input.table)
    const columns = this.extractColumns(table)

    return {
      table,
      tableName: table.tableName,
      routePath: tableNameToRoutePath(table.tableName),
      displayName: tableNameToDisplayName(table.tableName),
      primaryKey: columns.find((column) => column.isPrimaryKey)?.name ?? 'id',
      columns,
      options: input.options,
      folder: input.options.folder,
    }
  }

  async count(resource: ResourceDefinition<KnexTableDefinition, Knex>, filters: ParsedFilter[]): Promise<number> {
    const query = this.actionDatabase(resource.table.tableName).count<{ count: string | number }[]>({ count: '*' })
    this.applyFilters(query, resource, filters)
    const [row] = await query

    return normalizeCount(row)
  }

  async list(resource: ResourceDefinition<KnexTableDefinition, Knex>, options: ListRecordsOptions): Promise<BackendRecord[]> {
    const query = this.actionDatabase(resource.table.tableName)
      .select('*')
      .limit(options.limit)
      .offset(options.offset)
    this.applyFilters(query, resource, options.filters)
    if (options.sort) {
      const column = this.getColumn(resource.table, options.sort.column)
      query.orderBy(column.sqlName, options.sort.direction)
    }
    const rows = await query

    return rows.map((row) => this.normalizeRecord(resource.table, row))
  }

  async findById(resource: ResourceDefinition<KnexTableDefinition, Knex>, id: string): Promise<BackendRecord | undefined> {
    const primaryKey = this.getColumn(resource.table, resource.primaryKey)
    const row = await this.actionDatabase(resource.table.tableName)
      .select('*')
      .where(primaryKey.sqlName, id)
      .first()

    return row ? this.normalizeRecord(resource.table, row) : undefined
  }

  async insert(resource: ResourceDefinition<KnexTableDefinition, Knex>, values: BackendRecord): Promise<BackendRecord> {
    const [created] = await this.actionDatabase(resource.table.tableName)
      .insert(this.toSqlValues(resource.table, values))
      .returning('*')

    return this.normalizeRecord(resource.table, created)
  }

  async update(resource: ResourceDefinition<KnexTableDefinition, Knex>, id: string, values: BackendRecord): Promise<void> {
    const primaryKey = this.getColumn(resource.table, resource.primaryKey)
    await this.actionDatabase(resource.table.tableName)
      .where(primaryKey.sqlName, id)
      .update(this.toSqlValues(resource.table, values))
  }

  async delete(resource: ResourceDefinition<KnexTableDefinition, Knex>, id: string): Promise<void> {
    const primaryKey = this.getColumn(resource.table, resource.primaryKey)
    await this.actionDatabase(resource.table.tableName)
      .where(primaryKey.sqlName, id)
      .delete()
  }

  async exportAll(table: KnexTableDefinition): Promise<BackendRecord[]> {
    const rows = await this.actionDatabase(table.tableName).select('*')
    return rows.map((row) => this.normalizeRecord(table, row))
  }

  validateAdminUsersTable(table: KnexTableDefinition): void {
    const columns = this.extractColumns(table)
    validateAdminUsersColumns(columns.map((column) => column.name))
  }

  async findAdminByEmail(table: KnexTableDefinition, email: string): Promise<BackendRecord | undefined> {
    const emailColumn = this.getColumn(table, 'email')
    const row = await this.actionDatabase(table.tableName)
      .select('*')
      .where(emailColumn.sqlName, email)
      .first()

    return row ? this.normalizeRecord(table, row) : undefined
  }

  async insertAdminUser(table: KnexTableDefinition, values: BackendRecord): Promise<void> {
    await this.actionDatabase(table.tableName).insert(this.toSqlValues(table, values))
  }

  private applyFilters(
    query: Knex.QueryBuilder,
    resource: ResourceDefinition<KnexTableDefinition, Knex>,
    filters: ParsedFilter[],
  ): void {
    for (const parsedFilter of filters) {
      const column = this.getColumn(resource.table, parsedFilter.filter.name)

      if (parsedFilter.filter.column.dataType === 'text') {
        query.where(column.sqlName, 'ilike', `%${String(parsedFilter.value)}%`)
      } else {
        query.where(column.sqlName, parsedFilter.value)
      }
    }
  }

  private getColumn(table: KnexTableDefinition, columnName: string) {
    const column = table.columns.find((candidate) => candidate.name === columnName)

    if (!column) {
      throw new Error(`Knex table "${table.tableName}" is missing column "${columnName}".`)
    }

    return column
  }

  private toSqlValues(table: KnexTableDefinition, values: BackendRecord): BackendRecord {
    const columnByName = new Map(table.columns.map((column) => [column.name, column]))
    const sqlValues: BackendRecord = {}

    for (const [key, value] of Object.entries(values)) {
      const column = columnByName.get(key)
      sqlValues[column?.sqlName ?? key] = value
    }

    return sqlValues
  }

  private normalizeRecord(table: KnexTableDefinition, row: BackendRecord): BackendRecord {
    const normalized: BackendRecord = {}
    const declaredNames = new Set(table.columns.map((column) => column.name))
    const declaredSqlNames = new Set(table.columns.map((column) => column.sqlName))

    for (const column of table.columns) {
      if (Object.hasOwn(row, column.sqlName)) {
        normalized[column.name] = row[column.sqlName]
      } else if (Object.hasOwn(row, column.name)) {
        normalized[column.name] = row[column.name]
      }
    }

    for (const [key, value] of Object.entries(row)) {
      if (!declaredNames.has(key) && !declaredSqlNames.has(key)) {
        normalized[key] = value
      }
    }

    return normalized
  }
}

export function createKnexBackend(db: Knex): KnexBackend {
  return new KnexBackend(db)
}

function normalizeCount(row: { count?: string | number } | undefined): number {
  if (!row) {
    return 0
  }

  if (row.count !== undefined) {
    return Number(row.count)
  }

  const [firstValue] = Object.values(row)
  return Number(firstValue ?? 0)
}
