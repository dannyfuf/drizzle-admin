import { describe, it, expect } from 'vitest'
import { validateResources } from '@/resources/loader.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
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
})
