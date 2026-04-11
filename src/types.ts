import type { Column, Table } from 'drizzle-orm'
import type { PgDatabase, PgQueryResultHKT } from 'drizzle-orm/pg-core'
import type { PgTable } from 'drizzle-orm/pg-core'

/** Any Drizzle table — used when the specific column types don't matter. */
export type AnyTable = Table

/** Any PostgreSQL table — needed for db operations like `.from()`, `.insert()`. */
export type AnyPgTable = PgTable

/**
 * Any PostgreSQL database instance.
 * Uses the widest possible type so consumers don't need to know driver details.
 */
export type AnyPgDatabase = PgDatabase<PgQueryResultHKT, Record<string, unknown>>

/** Any Drizzle column — used in dialect adapters when iterating columns. */
export type AnyDrizzleColumn = Column
