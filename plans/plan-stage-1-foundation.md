# Stage 1: Foundation

**Part of:** [DrizzleAdmin Implementation Plan](./plan-drizzle-admin-2026-02-26.md)

## Summary

Set up the project structure, TypeScript configuration, core types, configuration system, and the PostgreSQL dialect adapter. This stage creates the foundation that all other stages build upon.

## Prerequisites

- Node.js 20+ installed
- pnpm installed globally
- PostgreSQL available for integration tests

## Scope

**IN scope:**
- Project initialization (package.json, tsconfig, vitest)
- Core type definitions (Config, ColumnMeta, DialectAdapter)
- `defineConfig()` helper function
- PostgreSQL dialect adapter with column introspection
- Admin users table contract types + runtime validation
- DrizzleAdmin class skeleton

**OUT of scope:**
- Authentication logic (Stage 2)
- Resource loading (Stage 3)
- Views and routes (Stages 4-5)

---

## Task Breakdown

### 1.1 Project Initialization
**Complexity:** Low
**Files:** `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`

Initialize the npm package with TypeScript and Vitest.

```bash
pnpm init
pnpm add hono drizzle-orm bcrypt jose
pnpm add -D typescript vitest @types/bcrypt @types/node pg drizzle-kit
```

**tsconfig.json** should use:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Acceptance criteria:**
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] `pnpm vitest run` executes (even with no tests)

---

### 1.2 Define Core Types
**Complexity:** Medium
**Files:** `src/dialects/types.ts`, `src/config.ts`

Create the foundational type definitions.

**`src/dialects/types.ts`:**
```ts
// Common column metadata extracted from any dialect
export interface ColumnMeta {
  name: string           // property name in schema (e.g., 'passwordHash')
  sqlName: string        // SQL column name (e.g., 'password_hash')
  dataType: string       // normalized type: 'text', 'integer', 'boolean', 'timestamp', 'json', 'enum'
  isNullable: boolean
  isPrimaryKey: boolean
  hasDefault: boolean
  enumValues?: string[]  // for enum columns
}

export interface DialectAdapter {
  name: 'postgresql' | 'mysql' | 'sqlite'
  extractColumns(table: unknown): ColumnMeta[]
}
```

**`src/config.ts`:**
```ts
import type { DialectAdapter } from './dialects/types'

export interface DrizzleAdminConfig<TAdminUsers extends MinimalAdminUsersTable> {
  db: unknown  // DrizzleDB instance
  dialect: 'postgresql' | 'mysql' | 'sqlite'
  adminUsers: TAdminUsers
  sessionSecret: string
  resourcesDir: string
  port?: number  // default: 3001
}

// Minimal required shape for admin users table
export interface MinimalAdminUsersTable {
  id: unknown
  email: unknown
  passwordHash: unknown
  createdAt: unknown
  updatedAt: unknown
}

export function defineConfig<T extends MinimalAdminUsersTable>(
  config: DrizzleAdminConfig<T>
): DrizzleAdminConfig<T> {
  return config
}
```

**Acceptance criteria:**
- [ ] Types compile without errors
- [ ] `defineConfig` provides type inference (test with consumer-like usage)

---

### 1.3 PostgreSQL Dialect Adapter
**Complexity:** High
**Files:** `src/dialects/postgresql.ts`

Implement the PostgreSQL adapter that extracts column metadata from Drizzle's `PgTable` type.

```ts
import { getTableColumns, getTableName } from 'drizzle-orm'
import { PgTable } from 'drizzle-orm/pg-core'
import type { ColumnMeta, DialectAdapter } from './types'

export const postgresqlAdapter: DialectAdapter = {
  name: 'postgresql',

  extractColumns(table: PgTable): ColumnMeta[] {
    const columns = getTableColumns(table)

    return Object.entries(columns).map(([name, column]) => ({
      name,
      sqlName: column.name,
      dataType: mapPgType(column),
      isNullable: !column.notNull,
      isPrimaryKey: column.primaryKey ?? false,
      hasDefault: column.hasDefault ?? false,
      enumValues: extractEnumValues(column),
    }))
  }
}

function mapPgType(column: any): string {
  const type = column.dataType
  // Map to normalized types
  if (type === 'string' || type === 'text' || type === 'varchar') return 'text'
  if (type === 'number' || type === 'integer' || type === 'serial') return 'integer'
  if (type === 'boolean') return 'boolean'
  if (type === 'date' || type === 'timestamp') return 'timestamp'
  if (type === 'json' || type === 'jsonb') return 'json'
  if (column.enumValues) return 'enum'
  return 'text'  // fallback
}

function extractEnumValues(column: any): string[] | undefined {
  return column.enumValues ?? undefined
}
```

**Acceptance criteria:**
- [ ] Extracts all columns from a test `PgTable`
- [ ] Correctly identifies primary keys, nullable, defaults
- [ ] Maps Postgres types to normalized types
- [ ] Unit tests pass for various column configurations

---

### 1.4 Admin Users Contract Validation
**Complexity:** Medium
**Files:** `src/auth/contract.ts`

Runtime validation that the provided admin users table has required columns.

```ts
import { getTableColumns } from 'drizzle-orm'

const REQUIRED_COLUMNS = ['id', 'email', 'passwordHash', 'createdAt', 'updatedAt'] as const

export function validateAdminUsersTable(table: unknown): void {
  const columns = getTableColumns(table as any)
  const columnNames = Object.keys(columns)

  for (const required of REQUIRED_COLUMNS) {
    if (!columnNames.includes(required)) {
      throw new Error(
        `adminUsers table must have a "${required}" column. ` +
        `Found columns: ${columnNames.join(', ')}`
      )
    }
  }
}
```

**Acceptance criteria:**
- [ ] Throws descriptive error when a required column is missing
- [ ] Passes validation for a correctly shaped table
- [ ] Error message includes found columns for debugging

---

### 1.5 DrizzleAdmin Class Skeleton
**Complexity:** Medium
**Files:** `src/index.ts`, `src/DrizzleAdmin.ts`

Create the main class with constructor validation.

```ts
import { Hono } from 'hono'
import type { DrizzleAdminConfig, MinimalAdminUsersTable } from './config'
import { validateAdminUsersTable } from './auth/contract'
import { postgresqlAdapter } from './dialects/postgresql'

export class DrizzleAdmin<T extends MinimalAdminUsersTable> {
  private config: DrizzleAdminConfig<T>
  private app: Hono

  constructor(config: DrizzleAdminConfig<T>) {
    this.config = config
    this.app = new Hono()

    // Runtime validation
    validateAdminUsersTable(config.adminUsers)

    // Validate dialect
    if (config.dialect !== 'postgresql') {
      throw new Error(`Dialect "${config.dialect}" is not yet supported`)
    }
  }

  async seed(params: { email: string; password: string }): Promise<void> {
    // Implemented in Stage 2
    throw new Error('Not implemented')
  }

  start(): void {
    const port = this.config.port ?? 3001
    console.log(`DrizzleAdmin starting on port ${port}`)
    // Hono server start - implemented fully in Stage 4
  }
}

// Re-exports
export { defineConfig } from './config'
export type { DrizzleAdminConfig } from './config'
```

**`src/index.ts`:**
```ts
export { DrizzleAdmin } from './DrizzleAdmin'
export { defineConfig } from './config'
export type { DrizzleAdminConfig } from './config'
```

**Acceptance criteria:**
- [ ] Constructor validates admin users table
- [ ] Constructor throws for unsupported dialects
- [ ] Exports are accessible from package root

---

### 1.6 Table Name Utilities
**Complexity:** Low
**Files:** `src/utils/table.ts`

Utilities for deriving route paths from table names.

```ts
import { getTableName } from 'drizzle-orm'

// Convert SQL table name to URL-friendly route path
// sale_orders -> sale-orders
export function tableNameToRoutePath(tableName: string): string {
  return tableName.replace(/_/g, '-')
}

// Get SQL table name from Drizzle table
export function getTableSqlName(table: unknown): string {
  return getTableName(table as any)
}

// Singularize for display (basic implementation)
// cards -> Card, sale_orders -> Sale Order
export function tableNameToDisplayName(tableName: string): string {
  return tableName
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
    .replace(/s$/, '')  // basic singularization
}
```

**Acceptance criteria:**
- [ ] `sale_orders` → `sale-orders`
- [ ] `cards` → `Card`
- [ ] Unit tests cover edge cases

---

## Testing Strategy

### Unit Tests to Write

| Test File | Coverage |
|-----------|----------|
| `src/dialects/postgresql.test.ts` | Column extraction, type mapping |
| `src/auth/contract.test.ts` | Validation success/failure cases |
| `src/config.test.ts` | Type inference verification |
| `src/utils/table.test.ts` | Name conversion utilities |

### Manual Verification

1. Create a test project with a minimal Drizzle schema
2. Import `defineConfig` and verify TypeScript catches missing columns
3. Instantiate `DrizzleAdmin` and verify runtime validation

---

## Definition of Done

- [ ] All 6 subtasks completed
- [ ] `pnpm test` passes all unit tests
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] `pnpm eslint .` has no errors
- [ ] Package can be imported and instantiated with valid config
