import type { ColumnMeta } from '@/dialects/types.ts'
import type { ParsedFilter } from '@/resources/filters.ts'
import type { SortState } from '@/resources/sort.ts'
import type { ResourceDefinition, ResourceOptions } from '@/resources/types.ts'

export type BackendRecord = Record<string, unknown>

export interface ResourceResolveInput<TableRef = unknown, ActionDatabase = unknown> {
  table: TableRef
  options: ResourceOptions<ActionDatabase>
}

export interface ListRecordsOptions {
  filters: ParsedFilter[]
  limit: number
  offset: number
  sort?: SortState
}

export interface AdminBackend<ActionDatabase = unknown, TableRef = unknown> {
  name: string
  actionDatabase: ActionDatabase
  getActionContext?(resource: ResourceDefinition<TableRef, ActionDatabase>): ActionDatabase

  getTableName(table: TableRef): string
  extractColumns(table: TableRef): ColumnMeta[]
  resolveResource(input: ResourceResolveInput<TableRef, ActionDatabase>): ResourceDefinition<TableRef, ActionDatabase>

  count(resource: ResourceDefinition<TableRef, ActionDatabase>, filters: ParsedFilter[]): Promise<number>
  list(resource: ResourceDefinition<TableRef, ActionDatabase>, options: ListRecordsOptions): Promise<BackendRecord[]>
  findById(resource: ResourceDefinition<TableRef, ActionDatabase>, id: string): Promise<BackendRecord | undefined>
  insert(resource: ResourceDefinition<TableRef, ActionDatabase>, values: BackendRecord): Promise<BackendRecord>
  update(resource: ResourceDefinition<TableRef, ActionDatabase>, id: string, values: BackendRecord): Promise<void>
  delete(resource: ResourceDefinition<TableRef, ActionDatabase>, id: string): Promise<void>
  exportAll(table: TableRef): Promise<BackendRecord[]>

  validateAdminUsersTable(table: TableRef): void
  findAdminByEmail(table: TableRef, email: string): Promise<BackendRecord | undefined>
  insertAdminUser(table: TableRef, values: BackendRecord): Promise<void>
}
