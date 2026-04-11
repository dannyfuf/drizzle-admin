import { describe, it, expect } from 'vitest'
import { slugify, renderMemberActions, renderCollectionActions } from '@/views/components/actions.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

describe('slugify', () => {
  it('converts to lowercase slug', () => {
    expect(slugify('Export CSV')).toBe('export-csv')
  })

  it('removes special characters', () => {
    expect(slugify('Archive!')).toBe('archive')
  })

  it('handles single word', () => {
    expect(slugify('Delete')).toBe('delete')
  })
})

import type { Table } from 'drizzle-orm'

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

describe('renderMemberActions', () => {
  it('returns empty when no actions', () => {
    const result = renderMemberActions({
      resource: makeResource(),
      recordId: 1,
      csrfToken: 'token',
      basePath: '',
    })
    expect(result.buttons).toBe('')
    expect(result.modals).toBe('')
  })

  it('renders destructive actions with modal', () => {
    const resource = makeResource({
      options: {
        memberActions: [
          { name: 'Archive', handler: async () => {}, destructive: true },
        ],
      },
    })
    const result = renderMemberActions({ resource, recordId: 1, csrfToken: 'token', basePath: '' })
    expect(result.buttons).toContain('openModal')
    expect(result.modals).toContain('Archive')
  })

  it('renders non-destructive actions as direct forms', () => {
    const resource = makeResource({
      options: {
        memberActions: [
          { name: 'Publish', handler: async () => {}, destructive: false },
        ],
      },
    })
    const result = renderMemberActions({ resource, recordId: 1, csrfToken: 'token', basePath: '' })
    expect(result.buttons).toContain('type="submit"')
    expect(result.buttons).toContain('Publish')
  })
})

describe('renderCollectionActions', () => {
  it('returns empty when no actions', () => {
    const result = renderCollectionActions({
      resource: makeResource(),
      csrfToken: 'token',
      basePath: '',
    })
    expect(result).toBe('')
  })

  it('renders collection action buttons', () => {
    const resource = makeResource({
      options: {
        collectionActions: [
          { name: 'Export CSV', handler: async () => {} },
        ],
      },
    })
    const result = renderCollectionActions({ resource, csrfToken: 'token', basePath: '' })
    expect(result).toContain('Export CSV')
    expect(result).toContain('actions/export-csv')
  })
})
