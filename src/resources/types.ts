import type { Context } from 'hono'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyKnexDatabase, AnyPgDatabase, PersistenceActionContext } from '@/types.ts'
import type { ColumnMeta } from '@/dialects/types.ts'

/** Configuration for selecting which columns to display. */
export interface ColumnConfig {
  /** Explicit list of column names to include. */
  columns?: string[]
  /** Column names to exclude from display. */
  exclude?: string[]
}

/** Configuration for the resource index (list) view. */
export interface IndexConfig extends ColumnConfig {
  /** Number of records per page. Defaults to 20. */
  perPage?: number
  /** Optional, order-sensitive list of column names to render as index filters. */
  filters?: string[]
}

/** Configuration for the resource show (detail) view. */
export interface ShowConfig extends ColumnConfig {}

/** Configuration for the resource create/edit form. */
export interface FormConfig extends ColumnConfig {}

/** An action that operates on a single record. */
export interface MemberAction<Database = AnyPgDatabase> {
  /** Display name shown in the UI. */
  name: string
  /** Handler called with the record ID and database instance. */
  handler: (id: string | number, db: Database) => Promise<void>
  /** When `true`, the UI shows a destructive confirmation style. */
  destructive?: boolean
}

/** An action that operates on the entire collection. */
export interface CollectionAction<Database = AnyPgDatabase> {
  /** Display name shown in the UI. */
  name: string
  /** Handler called with the Hono context and database instance. */
  handler: (c: Context, db: Database) => Promise<void | Response>
}

/** Options for customizing how a resource is displayed and managed. */
export interface ResourceOptions<Database = AnyPgDatabase> {
  /** Optional folder name for grouping this resource in the sidebar. */
  folder?: string
  /** Whitelist of column names allowed in create/update forms. */
  permitParams?: string[]
  /** Index view configuration. */
  index?: IndexConfig
  /** Show view configuration. */
  show?: ShowConfig
  /** Form view configuration. */
  form?: FormConfig
  /** Actions available on individual records. */
  memberActions?: MemberAction<Database>[]
  /** Actions available on the collection as a whole. */
  collectionActions?: CollectionAction<Database>[]
}

export type DrizzleResourceOptions = ResourceOptions<AnyPgDatabase>
export type KnexResourceOptions = ResourceOptions<AnyKnexDatabase>
export type PersistenceResourceOptions = ResourceOptions<PersistenceActionContext>

/** Explicit metadata for a Knex-managed table. */
export interface KnexTableDefinition {
  /** The SQL table name. */
  tableName: string
  /** Column metadata supplied by the application. */
  columns: ColumnMeta[]
}

/** A fully resolved resource definition used internally by DrizzleAdmin. */
export interface ResourceDefinition<TableRef = PgTable, Database = AnyPgDatabase> {
  /** Backend-specific table reference. Drizzle resources use a PgTable. */
  table: TableRef
  /** The SQL table name. */
  tableName: string
  /** The URL path segment for this resource. */
  routePath: string
  /** Human-readable name shown in the UI. */
  displayName: string
  /** The JavaScript property name of the primary key column. */
  primaryKey: string
  /** Column metadata used by views, forms, filters, and validation. */
  columns: ColumnMeta[]
  /** The resource options provided via {@link defineResource}. */
  options: ResourceOptions<Database>
  /** Sidebar folder name. `undefined` means top-level (ungrouped). */
  folder?: string
}
