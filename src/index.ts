/**
 * @module
 * DrizzleAdmin - A server-rendered admin panel builder for Drizzle ORM.
 *
 * Provides automatic CRUD interfaces, JWT authentication, and custom actions
 * for your database tables with minimal configuration.
 *
 * @example
 * ```ts
 * import { DrizzleAdmin, defineConfig } from "@dafu/drizzle-admin";
 *
 * const admin = new DrizzleAdmin(defineConfig({
 *   db,
 *   dialect: "postgresql",
 *   adminUsers,
 *   sessionSecret: "secret",
 *   resourcesDir: "./resources",
 * }));
 * await admin.start();
 * ```
 */

export { DrizzleAdmin } from '@/DrizzleAdmin.ts'
export { defineConfig } from '@/config.ts'
export {
  defineKnexAdminUsers,
  defineKnexResource,
  defineKnexTable,
  definePersistenceAdminUsers,
  definePersistenceResource,
  defineResource,
} from '@/resources/define.ts'
export { hashPassword } from '@/auth/password.ts'
export { createInMemoryLoginRateLimiter } from '@/auth/rate-limit.ts'
export type { LoginRateLimiter, LoginRateLimitOptions } from '@/auth/rate-limit.ts'
export { createResourceUrls } from '@/urls.ts'

export type { DrizzleAdminHandler } from '@/DrizzleAdmin.ts'
export type {
  BaseAdminConfig,
  DrizzleAdminConfig,
  DrizzleBackendConfig,
  KnexBackendConfig,
  PersistenceBackendConfig,
} from '@/config.ts'
export type {
  AnyKnexDatabase,
  AnyPersistenceRecord,
  AnyPgDatabase,
  AnyPgTable,
  PersistenceActionContext,
  PersistenceAdvancedQuery,
  PersistenceColumnDataType,
  PersistenceColumnMetadata,
  PersistenceModelInstance,
  PersistenceModelMetadata,
  PersistenceQueryBuilder,
  PersistenceQueryChain,
  PersistenceRepository,
  PersistenceRepositoryFactory,
  PersistenceResourceRef,
} from '@/types.ts'
export type {
  CollectionAction,
  DrizzleResourceOptions,
  KnexResourceOptions,
  KnexTableDefinition,
  MemberAction,
  PersistenceResourceOptions,
  ResourceOptions,
} from '@/resources/types.ts'
export type { ColumnMeta, DialectAdapter } from '@/dialects/types.ts'
export type { ResourceUrl, ResourceUrlsConfig } from '@/urls.ts'
