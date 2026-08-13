import { describe, it, expect } from 'vitest'
import { showView, formatShowValue } from '@/views/show.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

import type { PgTable } from 'drizzle-orm/pg-core'

function makeColumn(overrides: Partial<ColumnMeta> = {}): ColumnMeta {
  return {
    name: 'title',
    sqlName: 'title',
    dataType: 'text',
    isNullable: false,
    isPrimaryKey: false,
    hasDefault: false,
    ...overrides,
  }
}

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

describe('formatShowValue', () => {
  it('returns em-dash for null', () => {
    const result = formatShowValue(null, makeColumn())
    expect(result).toContain('—')
  })

  it('returns em-dash for undefined', () => {
    const result = formatShowValue(undefined, makeColumn())
    expect(result).toContain('—')
  })

  it('formats Date as locale string', () => {
    const date = new Date('2024-01-15T10:30:00Z')
    const result = formatShowValue(date, makeColumn({ dataType: 'timestamp' }))
    expect(result).toContain('2024')
  })

  it('returns "Yes" span for true boolean', () => {
    const result = formatShowValue(true, makeColumn({ dataType: 'boolean' }))
    expect(result).toContain('Yes')
    expect(result).toContain('emerald')
  })

  it('returns "No" span for false boolean', () => {
    const result = formatShowValue(false, makeColumn({ dataType: 'boolean' }))
    expect(result).toContain('No')
  })

  it('renders JSON in pre tag with formatting', () => {
    const result = formatShowValue({ key: 'value' }, makeColumn({ dataType: 'json' }))
    expect(result).toContain('<pre')
    expect(result).toContain('key')
  })

  it('escapes HTML in string values', () => {
    const result = formatShowValue('<b>bold</b>', makeColumn())
    expect(result).toContain('&lt;b&gt;')
    expect(result).not.toContain('<b>')
  })

  it('renders registered reference values as escaped, URL-encoded links', () => {
    const result = formatShowValue(
      '<user/42>',
      makeColumn({ name: 'authorId' }),
      { authorId: 'users' },
      '/admin',
    )

    expect(result).toContain('href="/admin/users/%3Cuser%2F42%3E"')
    expect(result).toContain('&lt;user/42&gt;')
  })

  it('leaves null reference values unchanged', () => {
    const result = formatShowValue(null, makeColumn({ name: 'authorId' }), { authorId: 'users' }, '/admin')
    expect(result).toContain('—')
    expect(result).not.toContain('<a')
  })
})

describe('showView', () => {
  const baseProps = {
    resource: makeResource(),
    columns: [
      makeColumn({ name: 'id', isPrimaryKey: true }),
      makeColumn({ name: 'title' }),
    ],
    record: { id: 1, title: 'Test Card' } as Record<string, unknown>,
    csrfToken: 'test-token',
    basePath: '',
    referenceRoutes: {},
    referencedByRoutes: [],
  }

  it('returns object with content and modals strings', () => {
    const result = showView(baseProps)
    expect(typeof result.content).toBe('string')
    expect(typeof result.modals).toBe('string')
  })

  it('content includes Edit link', () => {
    const { content } = showView(baseProps)
    expect(content).toContain('Edit')
    expect(content).toContain('/cards/1/edit')
  })

  it('content includes Back to list link', () => {
    const { content } = showView(baseProps)
    expect(content).toContain('Back to list')
    expect(content).toContain('/cards')
  })

  it('content includes Delete modal trigger', () => {
    const { content } = showView(baseProps)
    expect(content).toContain('Delete')
  })

  it('modals include delete confirmation modal', () => {
    const { modals } = showView(baseProps)
    expect(modals).toContain('Delete')
    expect(modals).toContain('delete-1')
  })

  it('filters out password columns', () => {
    const props = {
      ...baseProps,
      columns: [
        makeColumn({ name: 'email' }),
        makeColumn({ name: 'passwordHash' }),
      ],
      record: { id: 1, email: 'test@test.com', passwordHash: 'secret' } as Record<string, unknown>,
    }
    const { content } = showView(props)
    expect(content).toContain('Email')
    expect(content).toContain('test@test.com')
    expect(content).not.toContain('passwordHash')
  })

  it('renders reference links in detail rows', () => {
    const { content } = showView({
      ...baseProps,
      columns: [makeColumn({ name: 'id', isPrimaryKey: true }), makeColumn({ name: 'authorId' })],
      record: { id: 1, authorId: 42 },
      basePath: '/admin',
      referenceRoutes: { authorId: 'users' },
    })

    expect(content).toContain('href="/admin/users/42"')
    expect(content).toContain('>42</a>')
  })

  it('renders a Related section with referencedBy links after the field card', () => {
    const { content } = showView({
      ...baseProps,
      record: { id: 42, title: 'Test Card' },
      basePath: '/admin',
      referencedByRoutes: [{
        label: 'postComments',
        childRoutePath: 'comments',
        foreignKey: 'postId',
        parentKeyName: 'id',
      }],
    })

    expect(content).toContain('Related')
    expect(content).toContain('href="/admin/comments?filter_postId=42"')
    expect(content).toContain('>Post Comments</a>')
    expect(content.indexOf('Test Card')).toBeLessThan(content.indexOf('Related'))
  })

  it('does not render a Related section without referencedBy routes', () => {
    const { content } = showView(baseProps)

    expect(content).not.toContain('Related')
  })
})
