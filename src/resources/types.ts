import type { Context } from 'hono'

export interface ColumnConfig {
  columns?: string[]
  exclude?: string[]
}

export interface IndexConfig extends ColumnConfig {
  perPage?: number
}

export interface ShowConfig extends ColumnConfig {}

export interface FormConfig extends ColumnConfig {}

export interface MemberAction {
  name: string
  handler: (id: string | number, db: unknown) => Promise<void>
  destructive?: boolean
}

export interface CollectionAction {
  name: string
  handler: (c: Context, db: unknown) => Promise<void | Response>
}

export interface ResourceOptions {
  permitParams?: string[]
  index?: IndexConfig
  show?: ShowConfig
  form?: FormConfig
  memberActions?: MemberAction[]
  collectionActions?: CollectionAction[]
}

export interface ResourceDefinition {
  table: unknown
  tableName: string
  routePath: string
  displayName: string
  options: ResourceOptions
}
