/** The minimum required shape for the admin users table used by DrizzleAdmin authentication. */
export interface MinimalAdminUsersTable {
  id: unknown
  email: unknown
  passwordHash: unknown
  createdAt: unknown
  updatedAt: unknown
}

/** Configuration options for a DrizzleAdmin instance. */
export interface DrizzleAdminConfig<TAdminUsers extends MinimalAdminUsersTable> {
  /** The Drizzle ORM database instance. */
  db: unknown
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
}

/**
 * Type-safe helper for creating a DrizzleAdmin configuration object.
 *
 * @param config - The admin panel configuration.
 * @returns The same configuration object, typed correctly.
 */
export function defineConfig<T extends MinimalAdminUsersTable>(
  config: DrizzleAdminConfig<T>
): DrizzleAdminConfig<T> {
  return config
}
