import type { Context } from 'hono'

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
}

/** Configuration for the resource show (detail) view. */
export interface ShowConfig extends ColumnConfig {}

/** Configuration for the resource create/edit form. */
export interface FormConfig extends ColumnConfig {}

/** An action that operates on a single record. */
export interface MemberAction {
  /** Display name shown in the UI. */
  name: string
  /** Handler called with the record ID and database instance. */
  handler: (id: string | number, db: unknown) => Promise<void>
  /** When `true`, the UI shows a destructive confirmation style. */
  destructive?: boolean
}

/** An action that operates on the entire collection. */
export interface CollectionAction {
  /** Display name shown in the UI. */
  name: string
  /** Handler called with the Hono context and database instance. */
  handler: (c: Context, db: unknown) => Promise<void | Response>
}

/** Options for customizing how a resource is displayed and managed. */
export interface ResourceOptions {
  /** Whitelist of column names allowed in create/update forms. */
  permitParams?: string[]
  /** Index view configuration. */
  index?: IndexConfig
  /** Show view configuration. */
  show?: ShowConfig
  /** Form view configuration. */
  form?: FormConfig
  /** Actions available on individual records. */
  memberActions?: MemberAction[]
  /** Actions available on the collection as a whole. */
  collectionActions?: CollectionAction[]
}

/** A fully resolved resource definition used internally by DrizzleAdmin. */
export interface ResourceDefinition {
  /** The Drizzle ORM table object. */
  table: unknown
  /** The SQL table name. */
  tableName: string
  /** The URL path segment for this resource. */
  routePath: string
  /** Human-readable name shown in the UI. */
  displayName: string
  /** The resource options provided via {@link defineResource}. */
  options: ResourceOptions
}
