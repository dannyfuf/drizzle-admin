export interface MinimalAdminUsersTable {
  id: unknown
  email: unknown
  passwordHash: unknown
  createdAt: unknown
  updatedAt: unknown
}

export interface DrizzleAdminConfig<TAdminUsers extends MinimalAdminUsersTable> {
  db: unknown
  dialect: 'postgresql' | 'mysql' | 'sqlite'
  adminUsers: TAdminUsers
  sessionSecret: string
  resourcesDir: string
  port?: number
}

export function defineConfig<T extends MinimalAdminUsersTable>(
  config: DrizzleAdminConfig<T>
): DrizzleAdminConfig<T> {
  return config
}
