import { describe, it, expect } from 'vitest'
import { formView, isAutoManaged } from '@/views/form.ts'
import { styles } from '@/views/styles.ts'
import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import type { Table } from 'drizzle-orm'

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
    table: {} as Table,
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
    makeColumn({ name: 'createdAt', dataType: 'timestamp', hasDefault: true }),
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

  describe('create form', () => {
    it('hides auto-managed columns entirely', () => {
      const html = formView({
        resource: makeResource(),
        columns,
        csrfToken: 'token',
      })
      expect(html).not.toContain('name="id"')
      expect(html).not.toContain('name="createdAt"')
      expect(html).toContain('name="title"')
    })
  })

  describe('edit form', () => {
    it('renders id field as disabled input', () => {
      const html = formView({
        resource: makeResource(),
        columns,
        record: { id: 42, title: 'Test', createdAt: '2024-01-15T10:30' },
        csrfToken: 'token',
      })
      expect(html).toContain('name="id"')
      expect(html).toContain('disabled')
      expect(html).toContain(styles.inputDisabled)
    })

    it('renders createdAt (with default) as disabled input', () => {
      const html = formView({
        resource: makeResource(),
        columns,
        record: { id: 1, title: 'Test', createdAt: '2024-01-15T10:30' },
        csrfToken: 'token',
      })
      expect(html).toContain('name="createdAt"')
      // The createdAt field should be rendered as disabled
      // Count occurrences of 'disabled' — there should be at least 2 (id + createdAt)
      const disabledMatches = html.match(/disabled/g)
      expect(disabledMatches).toBeTruthy()
      expect(disabledMatches!.length).toBeGreaterThanOrEqual(2)
    })

    it('renders editable fields without disabled attribute', () => {
      const html = formView({
        resource: makeResource(),
        columns,
        record: { id: 1, title: 'Test', createdAt: '2024-01-15T10:30' },
        csrfToken: 'token',
      })
      // Find the title input specifically and verify it's not disabled
      // The title input should use the normal input style, not inputDisabled
      expect(html).toContain('name="title"')
      // Extract the title input segment
      const titleInputMatch = html.match(/<input[^>]*name="title"[^>]*>/)
      expect(titleInputMatch).toBeTruthy()
      expect(titleInputMatch![0]).not.toContain('disabled')
    })
  })

  it('permitParams does not hide auto-managed disabled fields on edit', () => {
    const html = formView({
      resource: makeResource({ options: { permitParams: ['title'] } }),
      columns: [
        makeColumn({ name: 'id', isPrimaryKey: true }),
        makeColumn({ name: 'title' }),
        makeColumn({ name: 'body' }),
        makeColumn({ name: 'createdAt', dataType: 'timestamp', hasDefault: true }),
      ],
      record: { id: 1, title: 'Test', body: 'Content', createdAt: '2024-01-15T10:30' },
      csrfToken: 'token',
    })
    // id and createdAt should still appear as disabled even with permitParams
    expect(html).toContain('name="id"')
    expect(html).toContain('name="createdAt"')
    // title is permitted
    expect(html).toContain('name="title"')
    // body is NOT permitted
    expect(html).not.toContain('name="body"')
  })

  it('respects permitParams option on create', () => {
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
