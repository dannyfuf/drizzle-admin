import type { PgTable } from 'drizzle-orm/pg-core'
import { getTableSqlName, tableNameToRoutePath } from '@/utils/table.ts'
import { adminUrl, normalizeBasePath } from '@/utils/url.ts'

/** Configuration for a resource URL builder. */
export interface ResourceUrlsConfig {
  /** Base URL path where the admin panel is mounted. Defaults to `''`. */
  basePath?: string
  /** Optional absolute origin to include in generated URLs. */
  origin?: string
}

/** The path and optional absolute URL for an admin resource route. */
export interface ResourceUrl {
  /** The path relative to the origin. */
  path: string
  /** The absolute URL when an origin is configured, otherwise the path. */
  url: string
}

interface ResourceUrls {
  index(
    table: PgTable | string,
    opts?: { filters?: Record<string, string | number> },
  ): ResourceUrl
  show(table: PgTable | string, id: string | number): ResourceUrl
  edit(table: PgTable | string, id: string | number): ResourceUrl
  'new'(table: PgTable | string): ResourceUrl
}

/**
 * Creates helpers for building URLs to registered admin resource routes.
 *
 * @param config - Base path and optional absolute origin shared by all URLs.
 */
export function createResourceUrls(config: ResourceUrlsConfig = {}): ResourceUrls {
  const basePath = normalizeBasePath(config.basePath ?? '')
  const origin = config.origin?.replace(/\/+$/, '') ?? ''

  const build = (table: PgTable | string, suffix = ''): ResourceUrl => {
    const tableName = typeof table === 'string' ? table : getTableSqlName(table)
    const routePath = tableNameToRoutePath(tableName)
    const path = adminUrl(basePath, `/${routePath}${suffix}`)

    return {
      path,
      url: origin ? `${origin}${path}` : path,
    }
  }

  return {
    index: (table, opts) => {
      const params = new URLSearchParams()
      for (const [key, value] of Object.entries(opts?.filters ?? {})) {
        params.set(`filter_${key}`, String(value))
      }

      const query = params.toString()
      return build(table, query ? `?${query}` : '')
    },
    show: (table, id) => build(table, `/${encodeURIComponent(String(id))}`),
    edit: (table, id) => build(table, `/${encodeURIComponent(String(id))}/edit`),
    new: (table: PgTable | string) => build(table, '/new'),
  }
}
