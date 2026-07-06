import type { Column } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { Knex } from 'knex'

/** Any PostgreSQL table — used when the specific column types don't matter. */
export type AnyPgTable = PgTable

/**
 * Any PostgreSQL database instance.
 * Uses the widest possible type so consumers don't need to know driver details.
 * The `any` for query result HKT and schema generics is intentional — drizzle-admin
 * performs generic CRUD operations and does not depend on the specific driver or
 * schema type parameters.
 */
// deno-lint-ignore no-explicit-any
export type AnyPgDatabase = PgDatabase<any, any>

/** Any Knex database instance. */
export type AnyKnexDatabase = Knex

/** Admin-facing data type emitted by Persistence generated schema metadata. */
export type PersistenceColumnDataType = 'boolean' | 'enum' | 'integer' | 'json' | 'text' | 'timestamp'

/** Structural column metadata emitted by `@dannyfuf/persistence` generated schemas. */
export interface PersistenceColumnMetadata {
  readonly name: string
  readonly dataType: PersistenceColumnDataType | string
  readonly isNullable: boolean
  readonly isPrimaryKey: boolean
  readonly hasDefault: boolean
  readonly enumValues?: readonly string[]
}

/** Structural model metadata exposed by Persistence repositories/models. */
export interface PersistenceModelMetadata {
  readonly tableName: string
  readonly columns: readonly string[]
  readonly columnMetadata: readonly PersistenceColumnMetadata[]
  readonly primaryKey: string
}

export type AnyPersistenceRecord = Record<string, unknown>

/** Structural Persistence model instance used by DrizzleAdmin without importing the ORM. */
export interface PersistenceModelInstance extends AnyPersistenceRecord {
  attributes?: () => AnyPersistenceRecord
  assignAndSave?: (values: AnyPersistenceRecord) => Promise<unknown>
}

/** Structural Persistence advanced query surface. */
export interface PersistenceAdvancedQuery {
  where(...args: unknown[]): PersistenceAdvancedQuery
  whereRaw(...args: unknown[]): PersistenceAdvancedQuery
  limit(count: number): PersistenceAdvancedQuery
  offset(count: number): PersistenceAdvancedQuery
  rows(): Promise<AnyPersistenceRecord[]>
  row(): Promise<AnyPersistenceRecord | null>
}

/** Structural Knex-like builder returned by Persistence repositories. */
export interface PersistenceQueryBuilder extends PromiseLike<AnyPersistenceRecord[]> {
  select(...args: unknown[]): PersistenceQueryBuilder
  where(...args: unknown[]): PersistenceQueryBuilder
  count(...args: unknown[]): PersistenceQueryBuilder
  first(): Promise<AnyPersistenceRecord | undefined>
  limit(count: number): PersistenceQueryBuilder
  offset(count: number): PersistenceQueryBuilder
  // Optional: older Persistence versions do not expose orderBy on the builder.
  orderBy?(column: string, direction: 'asc' | 'desc'): PersistenceQueryBuilder
}

/** Structural Persistence query chain. */
export interface PersistenceQueryChain {
  where(attrs: AnyPersistenceRecord): PersistenceQueryChain
  limit(count: number): PersistenceQueryChain
  offset(count: number): PersistenceQueryChain
  count(): Promise<number>
  all(): Promise<PersistenceModelInstance[]>
  first(): Promise<PersistenceModelInstance | null>
  update(values: AnyPersistenceRecord): Promise<number>
  delete(): Promise<number>
  query(): PersistenceAdvancedQuery
}

/** Structural Persistence repository returned by `defineModel(...)()`. */
export interface PersistenceRepository {
  readonly metadata: PersistenceModelMetadata
  create(values: AnyPersistenceRecord): Promise<PersistenceModelInstance>
  find(id: string | number): Promise<PersistenceModelInstance | null>
  where(attrs: AnyPersistenceRecord): PersistenceQueryChain
  query(): PersistenceAdvancedQuery
  createBuilder(): PersistenceQueryBuilder
}

/** Callable Persistence repository factory, usually the value returned by `defineModel`. */
export interface PersistenceRepositoryFactory {
  (): PersistenceRepository
}

export type PersistenceResourceRef = PersistenceRepositoryFactory | PersistenceRepository

export interface PersistenceActionContext {
  readonly repository: PersistenceRepository
  readonly metadata: PersistenceModelMetadata
  getRepository(ref?: PersistenceResourceRef): PersistenceRepository
}

/** Any Drizzle column — used in dialect adapters when iterating columns. */
export type AnyDrizzleColumn = Column
