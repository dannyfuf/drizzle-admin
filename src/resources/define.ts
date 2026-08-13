import type { PgTable } from 'drizzle-orm/pg-core'
import type { ColumnMeta } from '@/dialects/types.ts'
import type {
  DrizzleResourceOptions,
  KnexResourceOptions,
  KnexTableDefinition,
  PersistenceResourceOptions,
  ResourceOptions,
} from '@/resources/types.ts'
import type { PersistenceResourceRef } from '@/types.ts'

/** The object returned by {@link defineResource}, used internally by the resource loader. */
export interface DrizzleResourceExport {
  __drizzleAdminResource: true
  backend: 'drizzle'
  table: PgTable
  options: DrizzleResourceOptions
}

/** The object returned by {@link defineKnexResource}, used internally by the resource loader. */
export interface KnexResourceExport {
  __drizzleAdminResource: true
  backend: 'knex'
  table: KnexTableDefinition
  options: KnexResourceOptions
}

/** The object returned by {@link definePersistenceResource}, used internally by the resource loader. */
export interface PersistenceResourceExport {
  __drizzleAdminResource: true
  backend: 'persistence'
  table: PersistenceResourceRef
  options: PersistenceResourceOptions
}

export type ResourceExport = DrizzleResourceExport | KnexResourceExport | PersistenceResourceExport

/**
 * Creates a resource definition that registers a Drizzle table with DrizzleAdmin.
 *
 * Export the result as the default export of a file in your `resourcesDir`.
 *
 * @param table - A Drizzle ORM PostgreSQL table object.
 * @param options - Optional configuration for index, show, form views, and actions.
 * @returns A {@link ResourceExport} recognized by the resource loader.
 */
export function defineResource(table: PgTable): DrizzleResourceExport
export function defineResource(table: PgTable, options: DrizzleResourceOptions): DrizzleResourceExport
export function defineResource(table: PgTable, options?: DrizzleResourceOptions): DrizzleResourceExport {
  return {
    __drizzleAdminResource: true,
    backend: 'drizzle',
    table,
    options: options ?? {},
  }
}

export function defineKnexResource(table: KnexTableDefinition): KnexResourceExport
export function defineKnexResource(table: KnexTableDefinition, options: KnexResourceOptions): KnexResourceExport
export function defineKnexResource(tableName: string, columns: ColumnMeta[]): KnexResourceExport
export function defineKnexResource(tableName: string, columns: ColumnMeta[], options: KnexResourceOptions): KnexResourceExport
export function defineKnexResource(
  tableOrName: KnexTableDefinition | string,
  columnsOrOptions?: ColumnMeta[] | KnexResourceOptions,
  maybeOptions?: KnexResourceOptions,
): KnexResourceExport {
  const table = typeof tableOrName === 'string'
    ? defineKnexTable(tableOrName, columnsOrOptions as ColumnMeta[])
    : validateKnexTableDefinition(tableOrName)
  const options = typeof tableOrName === 'string' ? maybeOptions : columnsOrOptions as KnexResourceOptions | undefined

  return {
    __drizzleAdminResource: true,
    backend: 'knex',
    table,
    options: options ?? {},
  }
}

export function defineKnexAdminUsers(tableName: string, columns: ColumnMeta[]): KnexTableDefinition {
  return defineKnexTable(tableName, columns)
}

export function definePersistenceResource(table: PersistenceResourceRef): PersistenceResourceExport
export function definePersistenceResource(
  table: PersistenceResourceRef,
  options: PersistenceResourceOptions,
): PersistenceResourceExport
export function definePersistenceResource(
  table: PersistenceResourceRef,
  options?: PersistenceResourceOptions,
): PersistenceResourceExport {
  return {
    __drizzleAdminResource: true,
    backend: 'persistence',
    table,
    options: options ?? {},
  }
}

export function definePersistenceAdminUsers(table: PersistenceResourceRef): PersistenceResourceRef {
  return table
}

export function defineKnexTable(tableName: string, columns: ColumnMeta[]): KnexTableDefinition {
  return validateKnexTableDefinition({ tableName, columns })
}

/**
 * Type guard that checks whether a value is a valid {@link ResourceExport}.
 *
 * @param value - The value to check.
 * @returns `true` if the value was created by {@link defineResource}.
 */
export function isResourceExport(value: unknown): value is ResourceExport {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__drizzleAdminResource' in value &&
    (value as ResourceExport).__drizzleAdminResource === true
  )
}

export function isKnexTableDefinition(value: unknown): value is KnexTableDefinition {
  return (
    typeof value === 'object' &&
    value !== null &&
    'tableName' in value &&
    'columns' in value &&
    typeof (value as KnexTableDefinition).tableName === 'string' &&
    Array.isArray((value as KnexTableDefinition).columns)
  )
}

export function validateKnexTableDefinition(table: KnexTableDefinition): KnexTableDefinition {
  if (!table || typeof table.tableName !== 'string' || table.tableName.trim() === '') {
    throw new Error('Knex table metadata must include a non-empty tableName.')
  }

  if (!Array.isArray(table.columns) || table.columns.length === 0) {
    throw new Error(`Knex table "${table.tableName}" must declare at least one column.`)
  }

  for (const [index, column] of table.columns.entries()) {
    validateKnexColumn(table.tableName, column, index)
  }

  if (!table.columns.some((column) => column.isPrimaryKey)) {
    throw new Error(`Knex table "${table.tableName}" must declare a primary key column.`)
  }

  return table
}

function validateKnexColumn(tableName: string, column: ColumnMeta, index: number): void {
  const label = column?.name ? `column "${column.name}"` : `column at index ${index}`

  if (!column || typeof column !== 'object') {
    throw new Error(`Knex table "${tableName}" ${label} must be an object.`)
  }

  if (typeof column.name !== 'string' || column.name.trim() === '') {
    throw new Error(`Knex table "${tableName}" ${label} must include a non-empty name.`)
  }

  if (typeof column.sqlName !== 'string' || column.sqlName.trim() === '') {
    throw new Error(`Knex table "${tableName}" column "${column.name}" must include a non-empty sqlName.`)
  }

  if (typeof column.dataType !== 'string' || column.dataType.trim() === '') {
    throw new Error(`Knex table "${tableName}" column "${column.name}" must include a non-empty dataType.`)
  }

  for (const property of ['isNullable', 'isPrimaryKey', 'hasDefault'] as const) {
    if (typeof column[property] !== 'boolean') {
      throw new Error(`Knex table "${tableName}" column "${column.name}" must include boolean ${property}.`)
    }
  }

  if (column.enumValues !== undefined && !Array.isArray(column.enumValues)) {
    throw new Error(`Knex table "${tableName}" column "${column.name}" enumValues must be an array when provided.`)
  }

  if (column.references !== undefined) {
    if (!column.references || typeof column.references !== 'object') {
      throw new Error(`Knex table "${tableName}" column "${column.name}" references must be an object when provided.`)
    }

    if (typeof column.references.table !== 'string' || column.references.table.trim() === '') {
      throw new Error(`Knex table "${tableName}" column "${column.name}" references.table must be a non-empty string.`)
    }

    if (typeof column.references.column !== 'string' || column.references.column.trim() === '') {
      throw new Error(`Knex table "${tableName}" column "${column.name}" references.column must be a non-empty string.`)
    }
  }
}
