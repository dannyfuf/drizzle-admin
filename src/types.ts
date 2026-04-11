import type { Column } from 'drizzle-orm'
import type { PgDatabase } from 'drizzle-orm/pg-core'
import type { PgTable } from 'drizzle-orm/pg-core'

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

/** Any Drizzle column — used in dialect adapters when iterating columns. */
export type AnyDrizzleColumn = Column
