import { describe, it, expect } from 'vitest'
import { defineResource, isResourceExport } from './define.js'

describe('defineResource', () => {
  it('works without options', () => {
    const table = { name: 'cards' }
    const result = defineResource(table)
    expect(result.__drizzleAdminResource).toBe(true)
    expect(result.table).toBe(table)
    expect(result.options).toEqual({})
  })

  it('accepts options', () => {
    const table = { name: 'cards' }
    const options = { index: { perPage: 10 } }
    const result = defineResource(table, options)
    expect(result.options).toEqual(options)
  })
})

describe('isResourceExport', () => {
  it('returns true for valid resource exports', () => {
    const resource = defineResource({ name: 'cards' })
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
