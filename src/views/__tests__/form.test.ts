import { describe, it, expect } from 'vitest'
import { formView, isAutoManaged } from '@/views/form.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

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
    table: {},
    tableName: 'cards',
    routePath: 'cards',
    displayName: 'Card',
    options: {},
    ...overrides,
  }
}

describe('isAutoManaged', () => {
  it('returns true for primary key columns', () => {
    expect(isAutoManaged(makeColumn({ isPrimaryKey: true }))).toBe(true)
  })

  it('returns true for createdAt with default', () => {
    expect(isAutoManaged(makeColumn({ name: 'createdAt', hasDefault: true }))).toBe(true)
  })

  it('returns true for updated_at with default', () => {
    expect(isAutoManaged(makeColumn({ name: 'updated_at', hasDefault: true }))).toBe(true)
  })

  it('returns false for createdAt without default', () => {
    expect(isAutoManaged(makeColumn({ name: 'createdAt', hasDefault: false }))).toBe(false)
  })

  it('returns false for normal columns', () => {
    expect(isAutoManaged(makeColumn({ name: 'title' }))).toBe(false)
  })
})

describe('formView', () => {
  const columns = [
    makeColumn({ name: 'id', isPrimaryKey: true }),
    makeColumn({ name: 'title' }),
    makeColumn({ name: 'createdAt', hasDefault: true }),
  ]

  it('renders create form with POST action to resource path', () => {
    const html = formView({
      resource: makeResource(),
      columns,
      csrfToken: 'token',
    })
    expect(html).toContain('method="POST"')
    expect(html).toContain('action="/cards"')
  })

  it('renders edit form with PUT method override', () => {
    const html = formView({
      resource: makeResource(),
      columns,
      record: { id: 1, title: 'Test' },
      csrfToken: 'token',
    })
    expect(html).toContain('_method=PUT')
  })

  it('includes CSRF hidden input', () => {
    const html = formView({
      resource: makeResource(),
      columns,
      csrfToken: 'my-token',
    })
    expect(html).toContain('name="_csrf"')
    expect(html).toContain('value="my-token"')
  })

  it('includes Back to list link', () => {
    const html = formView({
      resource: makeResource(),
      columns,
      csrfToken: 'token',
    })
    expect(html).toContain('Back to list')
    expect(html).toContain('/cards')
  })

  it('edit form includes View link', () => {
    const html = formView({
      resource: makeResource(),
      columns,
      record: { id: 5, title: 'Test' },
      csrfToken: 'token',
    })
    expect(html).toContain('View')
    expect(html).toContain('/cards/5')
  })

  it('filters out auto-managed columns', () => {
    const html = formView({
      resource: makeResource(),
      columns,
      csrfToken: 'token',
    })
    // id (primary key) and createdAt (has default) should be filtered out
    expect(html).not.toContain('name="id"')
    expect(html).toContain('name="title"')
  })

  it('respects permitParams option', () => {
    const html = formView({
      resource: makeResource({ options: { permitParams: ['title'] } }),
      columns: [
        makeColumn({ name: 'title' }),
        makeColumn({ name: 'body' }),
      ],
      csrfToken: 'token',
    })
    expect(html).toContain('name="title"')
    expect(html).not.toContain('name="body"')
  })
})
