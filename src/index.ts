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
  defineResource,
} from '@/resources/define.ts'
export { hashPassword } from '@/auth/password.ts'

export type { DrizzleAdminHandler } from '@/DrizzleAdmin.ts'
export type {
  BaseAdminConfig,
  DrizzleAdminConfig,
  DrizzleBackendConfig,
  KnexBackendConfig,
} from '@/config.ts'
export type { AnyKnexDatabase, AnyPgDatabase, AnyPgTable } from '@/types.ts'
export type {
  CollectionAction,
  DrizzleResourceOptions,
  KnexResourceOptions,
  KnexTableDefinition,
  MemberAction,
  ResourceOptions,
} from '@/resources/types.ts'
export type { ColumnMeta, DialectAdapter } from '@/dialects/types.ts'
