import { describe, it, expect, vi } from 'vitest'

// Mock drizzle-orm's getTableColumns
vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: any) => table._columns,
}))

import { validateAdminUsersTable } from './contract.js'

describe('validateAdminUsersTable', () => {
  it('passes for valid table with all required columns', () => {
    const table = {
      _columns: {
        id: {},
        email: {},
        passwordHash: {},
        createdAt: {},
        updatedAt: {},
      },
    }

    expect(() => validateAdminUsersTable(table)).not.toThrow()
  })

  it('throws when missing a required column', () => {
    const table = {
      _columns: {
        id: {},
        email: {},
        createdAt: {},
        updatedAt: {},
      },
    }

    expect(() => validateAdminUsersTable(table)).toThrow('passwordHash')
  })

  it('error message includes found columns', () => {
    const table = {
      _columns: {
        id: {},
        email: {},
      },
    }

    expect(() => validateAdminUsersTable(table)).toThrow('id, email')
  })
})
