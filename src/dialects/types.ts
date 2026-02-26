/** Metadata describing a single database column extracted from a Drizzle table. */
export interface ColumnMeta {
  /** The JavaScript property name on the Drizzle table object. */
  name: string
  /** The underlying SQL column name. */
  sqlName: string
  /** The Drizzle data type identifier (e.g. `"string"`, `"number"`, `"boolean"`). */
  dataType: string
  /** Whether the column accepts `NULL` values. */
  isNullable: boolean
  /** Whether the column is the primary key. */
  isPrimaryKey: boolean
  /** Whether the column has a default value or is auto-generated. */
  hasDefault: boolean
  /** For enum columns, the list of allowed values. */
  enumValues?: string[]
}

/** Adapter interface for extracting column metadata from Drizzle tables for a specific SQL dialect. */
export interface DialectAdapter {
  /** The SQL dialect name. */
  name: 'postgresql' | 'mysql' | 'sqlite'
  /** Extracts column metadata from a Drizzle table definition. */
  extractColumns(table: unknown): ColumnMeta[]
}
