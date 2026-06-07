import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyKnexDatabase, AnyPgDatabase, PersistenceResourceRef } from '@/types.ts'
import type { KnexTableDefinition } from '@/resources/types.ts'

export interface BaseAdminConfig {
  /** The SQL dialect to use. Currently only `"postgresql"` is supported. */
  dialect: 'postgresql' | 'mysql' | 'sqlite'
  /** Secret used for signing JWT session tokens. */
  sessionSecret: string
  /** Path to the directory containing resource definition files. */
  resourcesDir: string
  /** Port to listen on. Defaults to `3001`. */
  port?: number
  /** Base URL path where the admin panel is mounted. Defaults to `''` (root). */
  basePath?: string
}

/** Configuration options for existing Drizzle ORM users. */
export interface DrizzleBackendConfig<TAdminUsers extends PgTable = PgTable> extends BaseAdminConfig {
  /** Backend mode. Omit for existing Drizzle configurations. */
  backend?: 'drizzle'
  /** The Drizzle ORM database instance. */
  db: AnyPgDatabase
  /** The Drizzle table definition for admin users. */
  adminUsers: TAdminUsers
}

/** Configuration options for Knex-backed PostgreSQL applications. */
export interface KnexBackendConfig extends BaseAdminConfig {
  /** Selects Knex mode. */
  backend: 'knex'
  /** The Knex database instance. */
  db: AnyKnexDatabase
  /** Explicit metadata for the admin users table. */
  adminUsers: KnexTableDefinition
}

/** Configuration options for Persistence ORM-backed PostgreSQL applications. */
export interface PersistenceBackendConfig extends BaseAdminConfig {
  /** Selects Persistence mode. */
  backend: 'persistence'
  /** Persistence is PostgreSQL-only. */
  dialect: 'postgresql'
  /** Persistence admin user repository factory, usually from `defineModel(AdminUserRecord)`. */
  adminUsers: PersistenceResourceRef
}

/** Configuration options for a DrizzleAdmin instance. */
export type DrizzleAdminConfig<TAdminUsers extends PgTable = PgTable> =
  | DrizzleBackendConfig<TAdminUsers>
  | KnexBackendConfig
  | PersistenceBackendConfig

/**
 * Type-safe helper for creating a DrizzleAdmin configuration object.
 *
 * @param config - The admin panel configuration.
 * @returns The same configuration object, typed correctly.
 */
export function defineConfig<T extends PgTable>(config: DrizzleBackendConfig<T>): DrizzleBackendConfig<T>
export function defineConfig(config: KnexBackendConfig): KnexBackendConfig
export function defineConfig(config: PersistenceBackendConfig): PersistenceBackendConfig
export function defineConfig(config: DrizzleAdminConfig): DrizzleAdminConfig {
  return config
}
