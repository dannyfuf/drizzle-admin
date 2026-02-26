import type { ResourceOptions } from './types.js'

/** The object returned by {@link defineResource}, used internally by the resource loader. */
export interface ResourceExport {
  __drizzleAdminResource: true
  table: unknown
  options: ResourceOptions
}

/**
 * Creates a resource definition that registers a Drizzle table with DrizzleAdmin.
 *
 * Export the result as the default export of a file in your `resourcesDir`.
 *
 * @param table - A Drizzle ORM table object.
 * @param options - Optional configuration for index, show, form views, and actions.
 * @returns A {@link ResourceExport} recognized by the resource loader.
 */
export function defineResource(table: unknown): ResourceExport
export function defineResource(table: unknown, options: ResourceOptions): ResourceExport
export function defineResource(table: unknown, options?: ResourceOptions): ResourceExport {
  return {
    __drizzleAdminResource: true,
    table,
    options: options ?? {},
  }
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
    (value as any).__drizzleAdminResource === true
  )
}
