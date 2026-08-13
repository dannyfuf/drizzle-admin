import { and, asc, desc, eq, getTableColumns, getTableName, ilike, sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AdminBackend, BackendRecord, ListRecordsOptions, ResourceResolveInput } from '@/backends/types.ts'
import { validateAdminUsersColumns } from '@/auth/contract.ts'
import { postgresqlAdapter } from '@/dialects/postgresql.ts'
import type { ParsedFilter } from '@/resources/filters.ts'
import type { SortState } from '@/resources/sort.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import type { AnyDrizzleColumn, AnyPgDatabase } from '@/types.ts'
import { tableNameToDisplayName, tableNameToRoutePath } from '@/utils/table.ts'

export class DrizzleBackend implements AdminBackend<AnyPgDatabase, PgTable> {
  readonly name = 'drizzle'

  constructor(readonly actionDatabase: AnyPgDatabase) {}

  getTableName(table: PgTable): string {
    return getTableName(table)
  }

  extractColumns(table: PgTable) {
    return postgresqlAdapter.extractColumns(table)
  }

  resolveResource(input: ResourceResolveInput<PgTable, AnyPgDatabase>): ResourceDefinition<PgTable, AnyPgDatabase> {
    const tableName = this.getTableName(input.table)
    const columns = this.extractColumns(input.table)

    return {
      table: input.table,
      tableName,
      routePath: tableNameToRoutePath(tableName),
      displayName: tableNameToDisplayName(tableName),
      primaryKey: columns.find((column) => column.isPrimaryKey)?.name ?? 'id',
      columns,
      options: input.options,
      folder: input.options.folder,
    }
  }

  async count(resource: ResourceDefinition<PgTable, AnyPgDatabase>, filters: ParsedFilter[]): Promise<number> {
    const [{ count }] = await this.actionDatabase
      .select({ count: sql`count(*)` })
      .from(resource.table)
      .where(this.buildWhere(resource, filters))

    return Number(count)
  }

  async list(resource: ResourceDefinition<PgTable, AnyPgDatabase>, options: ListRecordsOptions): Promise<BackendRecord[]> {
    const orderBy = options.sort
      ? [this.buildOrderBy(resource, options.sort)]
      : []

    return await this.actionDatabase
      .select()
      .from(resource.table)
      .where(this.buildWhere(resource, options.filters))
      .orderBy(...orderBy)
      .limit(options.limit)
      .offset(options.offset) as BackendRecord[]
  }

  async findById(resource: ResourceDefinition<PgTable, AnyPgDatabase>, id: string): Promise<BackendRecord | undefined> {
    const [record] = await this.actionDatabase
      .select()
      .from(resource.table)
      .where(eq(this.getTableColumn(resource, resource.primaryKey), id))
      .limit(1)

    return record as BackendRecord | undefined
  }

  async insert(resource: ResourceDefinition<PgTable, AnyPgDatabase>, values: BackendRecord): Promise<BackendRecord> {
    const [created] = await this.actionDatabase
      .insert(resource.table)
      .values(values)
      .returning()

    return created as BackendRecord
  }

  async update(resource: ResourceDefinition<PgTable, AnyPgDatabase>, id: string, values: BackendRecord): Promise<void> {
    await this.actionDatabase
      .update(resource.table)
      .set(values)
      .where(eq(this.getTableColumn(resource, resource.primaryKey), id))
  }

  async delete(resource: ResourceDefinition<PgTable, AnyPgDatabase>, id: string): Promise<void> {
    await this.actionDatabase
      .delete(resource.table)
      .where(eq(this.getTableColumn(resource, resource.primaryKey), id))
  }

  async exportAll(table: PgTable): Promise<BackendRecord[]> {
    return await this.actionDatabase.select().from(table) as BackendRecord[]
  }

  validateAdminUsersTable(table: PgTable): void {
    validateAdminUsersColumns(Object.keys(getTableColumns(table)))
  }

  async findAdminByEmail(table: PgTable, email: string): Promise<BackendRecord | undefined> {
    const columns = getTableColumns(table) as Record<string, AnyDrizzleColumn>
    const [row] = await this.actionDatabase
      .select()
      .from(table)
      .where(eq(columns.email!, email))
      .limit(1)

    return row as BackendRecord | undefined
  }

  async insertAdminUser(table: PgTable, values: BackendRecord): Promise<void> {
    await this.actionDatabase.insert(table).values(values)
  }

  private buildOrderBy(resource: ResourceDefinition<PgTable, AnyPgDatabase>, sort: SortState): SQL {
    const column = this.getTableColumn(resource, sort.column)
    return sort.direction === 'desc' ? desc(column) : asc(column)
  }

  private buildWhere(resource: ResourceDefinition<PgTable, AnyPgDatabase>, filters: ParsedFilter[]): SQL | undefined {
    if (filters.length === 0) {
      return undefined
    }

    const conditions = filters.map((filter) => this.buildFilterCondition(resource, filter))
    return conditions.length > 0 ? and(...conditions) : undefined
  }

  private buildFilterCondition(resource: ResourceDefinition<PgTable, AnyPgDatabase>, parsedFilter: ParsedFilter): SQL {
    const column = this.getTableColumn(resource, parsedFilter.filter.name)

    if (parsedFilter.filter.matchMode === 'contains') {
      return ilike(column, `%${String(parsedFilter.value)}%`)
    }

    return eq(column, parsedFilter.value)
  }

  private getTableColumn(resource: ResourceDefinition<PgTable, AnyPgDatabase>, columnName: string): AnyDrizzleColumn {
    const columns = getTableColumns(resource.table) as Record<string, AnyDrizzleColumn>
    const column = columns[columnName]

    if (!column) {
      throw new Error(`Resource "${resource.tableName}" is missing column "${columnName}".`)
    }

    return column
  }
}

export function createDrizzleBackend(db: AnyPgDatabase): DrizzleBackend {
  return new DrizzleBackend(db)
}
