import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, vi } from 'vitest'
import type { AdminBackend } from '@/backends/types.ts'
import { applyReferencedBy, loadResources, validateResources } from '@/resources/loader.ts'
import { validateReferences } from '@/resources/references.ts'
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

  it('merges configured references over introspected references and defaults the target column to id', async () => {
    const resourcesDir = await mkdtemp(join(tmpdir(), 'drizzle-admin-resources-'))
    const backend = {
      name: 'drizzle',
      resolveResource: vi.fn(({ table, options }) => makeResource({
        table,
        columns: [
          {
            name: 'authorId',
            sqlName: 'author_id',
            dataType: 'integer',
            isNullable: false,
            isPrimaryKey: false,
            hasDefault: false,
            references: { table: 'legacy_users', column: 'legacy_id' },
          },
        ],
        options,
      })),
    } as unknown as AdminBackend

    try {
      await writeFile(
        join(resourcesDir, 'posts.js'),
        `module.exports = { __drizzleAdminResource: true, table: {}, options: { references: { authorId: { table: 'users' } } } }`,
      )

      const { resources, errors } = await loadResources(resourcesDir, backend)

      expect(errors).toEqual([])
      expect(resources[0].columns[0].references).toEqual({ table: 'users', column: 'id' })
    } finally {
      await rm(resourcesDir, { recursive: true, force: true })
    }
  })
})

describe('applyReferencedBy', () => {
  const foreignKeyColumn = {
    name: 'postId',
    sqlName: 'post_id',
    dataType: 'integer' as const,
    isNullable: false,
    isPrimaryKey: false,
    hasDefault: false,
  }

  it('adds the child foreign key to its declared filters', () => {
    const posts = makeResource({
      tableName: 'posts',
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'postId' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      columns: [foreignKeyColumn],
    })

    const resolved = applyReferencedBy([posts, comments])

    expect(resolved[1].options.index?.filters).toEqual(['postId'])
    expect(resolved[1]).not.toBe(comments)
    expect(comments.options.index).toBeUndefined()
  })

  it('does not duplicate an already declared child filter', () => {
    const posts = makeResource({
      tableName: 'posts',
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'postId' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      columns: [foreignKeyColumn],
      options: { index: { filters: ['postId'] } },
    })

    const resolved = applyReferencedBy([posts, comments])

    expect(resolved[1].options.index?.filters).toEqual(['postId'])
  })

  it('stamps missing child reference metadata with the parent table and id column', () => {
    const posts = makeResource({
      tableName: 'posts',
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'postId' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      columns: [foreignKeyColumn],
    })

    const resolved = applyReferencedBy([posts, comments])

    expect(resolved[1].columns[0].references).toEqual({ table: 'posts', column: 'id' })
    expect(comments.columns[0].references).toBeUndefined()
  })

  it('preserves existing child reference metadata', () => {
    const posts = makeResource({
      tableName: 'posts',
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'postId' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      columns: [{
        ...foreignKeyColumn,
        references: { table: 'articles', column: 'slug' },
      }],
    })

    const resolved = applyReferencedBy([posts, comments])

    expect(resolved[1].columns[0].references).toEqual({ table: 'articles', column: 'slug' })
  })

  it('skips an unknown child table without throwing', () => {
    const posts = makeResource({
      tableName: 'posts',
      options: { referencedBy: { comments: { table: 'missing_comments', foreignKey: 'postId' } } },
    })

    expect(() => applyReferencedBy([posts])).not.toThrow()
    expect(applyReferencedBy([posts])[0]).toEqual(posts)
  })
})

describe('validateReferences', () => {
  const users = makeResource({ tableName: 'users', routePath: 'users' })

  it('accepts configured references to registered resources', () => {
    const posts = makeResource({
      tableName: 'posts',
      columns: [{
        name: 'authorId',
        sqlName: 'author_id',
        dataType: 'integer',
        isNullable: false,
        isPrimaryKey: false,
        hasDefault: false,
      }],
      options: { references: { authorId: { table: 'users' } } },
    })

    expect(validateReferences(posts, [posts, users])).toEqual([])
  })

  it('rejects configured references for unknown columns', () => {
    const posts = makeResource({
      tableName: 'posts',
      options: { references: { missing: { table: 'users' } } },
    })

    expect(validateReferences(posts, [posts, users])[0]).toContain('unknown column "missing"')
  })

  it('rejects configured references to unregistered tables', () => {
    const posts = makeResource({
      tableName: 'posts',
      columns: [{
        name: 'authorId',
        sqlName: 'author_id',
        dataType: 'integer',
        isNullable: false,
        isPrimaryKey: false,
        hasDefault: false,
      }],
      options: { references: { authorId: { table: 'missing_users' } } },
    })

    expect(validateReferences(posts, [posts])[0]).toContain('unregistered table "missing_users"')
  })

  it('does not validate introspected references to unregistered tables', () => {
    const posts = makeResource({
      columns: [{
        name: 'authorId',
        sqlName: 'author_id',
        dataType: 'integer',
        isNullable: false,
        isPrimaryKey: false,
        hasDefault: false,
        references: { table: 'missing_users', column: 'id' },
      }],
    })

    expect(validateReferences(posts, [posts])).toEqual([])
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
