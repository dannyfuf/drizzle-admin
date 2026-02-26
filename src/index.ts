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

export { DrizzleAdmin } from './DrizzleAdmin.js'
export { defineConfig } from './config.js'
export { defineResource } from './resources/define.js'
export { hashPassword } from './auth/password.js'

export type { DrizzleAdminConfig, MinimalAdminUsersTable } from './config.js'
export type { ResourceOptions, MemberAction, CollectionAction } from './resources/types.js'
export type { ColumnMeta, DialectAdapter } from './dialects/types.js'
