import { describe, it, expect } from 'vitest'
import { tableNameToRoutePath, tableNameToDisplayName } from './table.js'

describe('tableNameToRoutePath', () => {
  it('converts underscores to hyphens', () => {
    expect(tableNameToRoutePath('sale_orders')).toBe('sale-orders')
  })

  it('handles single word', () => {
    expect(tableNameToRoutePath('cards')).toBe('cards')
  })

  it('handles multiple underscores', () => {
    expect(tableNameToRoutePath('user_order_items')).toBe('user-order-items')
  })
})

describe('tableNameToDisplayName', () => {
  it('converts snake_case to Title Case and singularizes', () => {
    expect(tableNameToDisplayName('sale_orders')).toBe('Sale Order')
  })

  it('singularizes simple plural', () => {
    expect(tableNameToDisplayName('cards')).toBe('Card')
  })

  it('handles multi-word names', () => {
    expect(tableNameToDisplayName('user_profiles')).toBe('User Profile')
  })
})
