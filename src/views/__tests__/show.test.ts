import { describe, it, expect } from 'vitest'
import { showView, formatShowValue } from '@/views/show.ts'
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
      record: { id: 1, email: 'test@test.com', passwordHash: 'secret' },
    }
    const { content } = showView(props)
    expect(content).toContain('Email')
    expect(content).toContain('test@test.com')
    expect(content).not.toContain('passwordHash')
  })
})
