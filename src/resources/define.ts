import type { ResourceOptions } from './types.js'

export interface ResourceExport {
  __drizzleAdminResource: true
  table: unknown
  options: ResourceOptions
}

export function defineResource(table: unknown): ResourceExport
export function defineResource(table: unknown, options: ResourceOptions): ResourceExport
export function defineResource(table: unknown, options?: ResourceOptions): ResourceExport {
  return {
    __drizzleAdminResource: true,
    table,
    options: options ?? {},
  }
}

export function isResourceExport(value: unknown): value is ResourceExport {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__drizzleAdminResource' in value &&
    (value as any).__drizzleAdminResource === true
  )
}
