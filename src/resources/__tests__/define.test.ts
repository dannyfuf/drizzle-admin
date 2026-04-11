import { describe, it, expect } from 'vitest'
import { defineResource, isResourceExport } from '@/resources/define.ts'
import type { Table } from 'drizzle-orm'

describe('defineResource', () => {
  it('works without options', () => {
    const table = { name: 'cards' } as unknown as Table
    const result = defineResource(table)
    expect(result.__drizzleAdminResource).toBe(true)
    expect(result.table).toBe(table)
    expect(result.options).toEqual({})
  })

  it('accepts options', () => {
    const table = { name: 'cards' } as unknown as Table
    const options = { index: { perPage: 10 } }
    const result = defineResource(table, options)
    expect(result.options).toEqual(options)
  })

  it('passes folder option through', () => {
    const table = { name: 'contacts' } as unknown as Table
    const result = defineResource(table, { folder: 'CRM' })
    expect(result.options.folder).toBe('CRM')
  })
})

describe('isResourceExport', () => {
  it('returns true for valid resource exports', () => {
    const resource = defineResource({ name: 'cards' } as unknown as Table)
    expect(isResourceExport(resource)).toBe(true)
  })

  it('returns false for plain objects', () => {
    expect(isResourceExport({ table: 'cards' })).toBe(false)
  })

  it('returns false for null', () => {
    expect(isResourceExport(null)).toBe(false)
  })

  it('returns false for primitives', () => {
    expect(isResourceExport('string')).toBe(false)
    expect(isResourceExport(42)).toBe(false)
  })
})
