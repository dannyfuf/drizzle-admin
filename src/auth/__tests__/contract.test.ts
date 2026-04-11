import { describe, it, expect, vi } from 'vitest'
import type { PgTable } from 'drizzle-orm/pg-core'

// Mock drizzle-orm's getTableColumns
vi.mock('drizzle-orm', () => ({
  getTableColumns: (table: Record<string, unknown>) => (table as Record<string, unknown>)._columns,
}))

import { validateAdminUsersTable } from '@/auth/contract.ts'

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

    expect(() => validateAdminUsersTable(table as unknown as PgTable)).not.toThrow()
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

    expect(() => validateAdminUsersTable(table as unknown as PgTable)).toThrow('passwordHash')
  })

  it('error message includes found columns', () => {
    const table = {
      _columns: {
        id: {},
        email: {},
      },
    }

    expect(() => validateAdminUsersTable(table as unknown as PgTable)).toThrow('id, email')
  })
})
