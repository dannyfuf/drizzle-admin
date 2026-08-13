import { describe, expect, it } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { ColumnMeta } from '@/dialects/types.ts'
import { validateReferencedBy } from '@/resources/references.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: 'postId',
    sqlName: 'post_id',
    dataType: 'integer',
    isNullable: false,
    isPrimaryKey: false,
    hasDefault: false,
    ...overrides,
  }
}

function makeResource(overrides: Partial<ResourceDefinition> = {}): ResourceDefinition {
  return {
    table: {} as PgTable,
    tableName: 'posts',
    routePath: 'posts',
    displayName: 'Post',
    primaryKey: 'id',
    columns: [],
    options: {},
    ...overrides,
  }
}

describe('validateReferencedBy', () => {
  it('accepts a supported foreign key on a registered child resource', () => {
    const posts = makeResource({
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'postId' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      routePath: 'comments',
      columns: [makeColumn()],
    })

    expect(validateReferencedBy(posts, [posts, comments])).toEqual([])
  })

  it('rejects an unregistered child resource', () => {
    const posts = makeResource({
      options: { referencedBy: { comments: { table: 'missing_comments', foreignKey: 'postId' } } },
    })

    const errors = validateReferencedBy(posts, [posts])

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unregistered table "missing_comments"')
  })

  it('rejects an unknown foreign-key column', () => {
    const posts = makeResource({
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'missingPostId' } } },
    })
    const comments = makeResource({ tableName: 'comments', routePath: 'comments' })

    const errors = validateReferencedBy(posts, [posts, comments])

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unknown column "missingPostId"')
  })

  it('rejects unsupported foreign-key column types', () => {
    const posts = makeResource({
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'postId' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      routePath: 'comments',
      columns: [makeColumn({ dataType: 'json' })],
    })

    const errors = validateReferencedBy(posts, [posts, comments])

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('unsupported type "json"')
  })

  it('rejects password foreign-key columns', () => {
    const posts = makeResource({
      options: { referencedBy: { comments: { table: 'comments', foreignKey: 'passwordHash' } } },
    })
    const comments = makeResource({
      tableName: 'comments',
      routePath: 'comments',
      columns: [makeColumn({ name: 'passwordHash', sqlName: 'password_hash', dataType: 'text' })],
    })

    const errors = validateReferencedBy(posts, [posts, comments])

    expect(errors).toHaveLength(1)
    expect(errors[0]).toContain('password column "passwordHash"')
  })
})
