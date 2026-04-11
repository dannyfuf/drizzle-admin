import type { Table } from 'drizzle-orm'
import type { AnyPgDatabase } from '@/types.ts'

/** Configuration options for a DrizzleAdmin instance. */
export interface DrizzleAdminConfig<TAdminUsers extends Table = Table> {
  /** The Drizzle ORM database instance. */
  db: AnyPgDatabase
  /** The SQL dialect to use. Currently only `"postgresql"` is supported. */
  dialect: 'postgresql' | 'mysql' | 'sqlite'
  /** The Drizzle table definition for admin users. */
  adminUsers: TAdminUsers
  /** Secret used for signing JWT session tokens. */
  sessionSecret: string
  /** Path to the directory containing resource definition files. */
  resourcesDir: string
  /** Port to listen on. Defaults to `3001`. */
  port?: number
  /** Base URL path where the admin panel is mounted. Defaults to `''` (root). */
  basePath?: string
}

/**
 * Type-safe helper for creating a DrizzleAdmin configuration object.
 *
 * @param config - The admin panel configuration.
 * @returns The same configuration object, typed correctly.
 */
export function defineConfig<T extends Table>(
  config: DrizzleAdminConfig<T>
): DrizzleAdminConfig<T> {
  return config
}
