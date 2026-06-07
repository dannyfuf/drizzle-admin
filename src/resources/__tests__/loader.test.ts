import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import type { AdminBackend } from '@/backends/types.ts'
import { loadResources, validateResources } from '@/resources/loader.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import type { PgTable } from 'drizzle-orm/pg-core'

function makeResource(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    table: {} as PgTable,
    tableName: 'cards',
    routePath: 'cards',
    displayName: 'Card',
    primaryKey: 'id',
    columns: [],
    options: {},
    ...overrides,
  }
}

describe('loadResources', () => {
  it('resolves resource exports through the backend seam', async () => {
    const resourcesDir = await mkdtemp(join(tmpdir(), 'drizzle-admin-resources-'))
    const backend = {
      name: 'drizzle',
      resolveResource: vi.fn(({ table, options }) => ({
        table,
        tableName: 'posts',
        routePath: 'posts',
        displayName: 'Post',
        primaryKey: 'id',
        columns: [],
        options,
        folder: options.folder,
      })),
    } as unknown as AdminBackend

    try {
      await writeFile(
        join(resourcesDir, 'posts.js'),
        `module.exports = { __drizzleAdminResource: true, table: { name: 'posts' }, options: { folder: 'CMS' } }`,
      )

      const { resources, errors } = await loadResources(resourcesDir, backend)

      expect(errors).toEqual([])
      expect(backend.resolveResource).toHaveBeenCalledWith({
        table: { name: 'posts' },
        options: { folder: 'CMS' },
      })
      expect(resources[0]).toMatchObject({
        tableName: 'posts',
        routePath: 'posts',
        displayName: 'Post',
        primaryKey: 'id',
        folder: 'CMS',
      })
    } finally {
      await rm(resourcesDir, { recursive: true, force: true })
    }
  })

  it('rejects resources declared for a different backend', async () => {
    const resourcesDir = await mkdtemp(join(tmpdir(), 'drizzle-admin-resources-'))
    const backend = {
      name: 'drizzle',
      resolveResource: vi.fn(),
    } as unknown as AdminBackend

    try {
      await writeFile(
        join(resourcesDir, 'posts.js'),
        `module.exports = { __drizzleAdminResource: true, backend: 'knex', table: { tableName: 'posts', columns: [] }, options: {} }`,
      )

      const { resources, errors } = await loadResources(resourcesDir, backend)

      expect(resources).toEqual([])
      expect(errors[0]).toContain('declared for the "knex" backend')
      expect(backend.resolveResource).not.toHaveBeenCalled()
    } finally {
      await rm(resourcesDir, { recursive: true, force: true })
    }
  })

  it('loads resources declared for the Persistence backend', async () => {
    const resourcesDir = await mkdtemp(join(tmpdir(), 'drizzle-admin-resources-'))
    const backend = {
      name: 'persistence',
      resolveResource: vi.fn(({ table, options }) => ({
        table,
        tableName: 'posts',
        routePath: 'posts',
        displayName: 'Post',
        primaryKey: 'id',
        columns: [],
        options,
      })),
    } as unknown as AdminBackend

    try {
      await writeFile(
        join(resourcesDir, 'posts.js'),
        `module.exports = { __drizzleAdminResource: true, backend: 'persistence', table: () => ({}), options: {} }`,
      )

      const { resources, errors } = await loadResources(resourcesDir, backend)

      expect(errors).toEqual([])
      expect(resources[0]?.tableName).toBe('posts')
    } finally {
      await rm(resourcesDir, { recursive: true, force: true })
    }
  })
})

describe('validateResources', () => {
  it('returns empty array for empty resources', () => {
    expect(validateResources([])).toEqual([])
  })

  it('returns empty array for resources with unique route paths', () => {
    const resources = [
      makeResource({ tableName: 'cards', routePath: 'cards' }),
      makeResource({ tableName: 'posts', routePath: 'posts' }),
    ]
    expect(validateResources(resources)).toEqual([])
  })

  it('returns error for duplicate route paths', () => {
    const resources = [
      makeResource({ tableName: 'cards', routePath: 'items' }),
      makeResource({ tableName: 'posts', routePath: 'items' }),
    ]
    const errors = validateResources(resources)
    expect(errors).toHaveLength(1)
  })

  it('error message includes both table names and the duplicate path', () => {
    const resources = [
      makeResource({ tableName: 'cards', routePath: 'items' }),
      makeResource({ tableName: 'posts', routePath: 'items' }),
    ]
    const errors = validateResources(resources)
    expect(errors[0]).toContain('items')
    expect(errors[0]).toContain('cards')
    expect(errors[0]).toContain('posts')
  })

  it('returns empty array for resources in same folder with different route paths', () => {
    const resources = [
      makeResource({ tableName: 'contacts', routePath: 'contacts', folder: 'CRM' }),
      makeResource({ tableName: 'deals', routePath: 'deals', folder: 'CRM' }),
    ]
    expect(validateResources(resources)).toEqual([])
  })

  it('rejects duplicate route paths across Drizzle and Knex resources', () => {
    const resources = [
      makeResource({ tableName: 'posts', routePath: 'posts' }),
      makeResource({ table: { tableName: 'posts', columns: [] }, tableName: 'posts', routePath: 'posts' } as never),
    ]

    expect(validateResources(resources)).toHaveLength(1)
  })
})
