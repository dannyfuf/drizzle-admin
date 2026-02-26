# Stage 3: Resource System

**Part of:** [DrizzleAdmin Implementation Plan](./plan-drizzle-admin-2026-02-26.md)
**Depends on:** [Stage 1: Foundation](./plan-stage-1-foundation.md)

## Summary

Implement the file-system based resource registration system. Resources are defined in files within a `resourcesDir` directory, each exporting a resource definition via `defineResource()`. DrizzleAdmin scans this directory at startup and generates routes for each resource.

## Prerequisites

- Stage 1 completed
- Understanding of Node.js `fs` module and dynamic imports

## Scope

**IN scope:**
- `defineResource()` helper with type safety
- Resource type definitions (options, column customization)
- File-system scanner for resource directory
- Route path derivation from table names
- Duplicate route detection

**OUT of scope:**
- Actual CRUD routes (Stage 5)
- Views rendering (Stage 4)
- Custom actions execution (Stage 6)

---

## Task Breakdown

### 3.1 Resource Type Definitions
**Complexity:** Medium
**Files:** `src/resources/types.ts`

Define the shape of resource definitions and customization options.

```ts
import type { Context } from 'hono'

// Column visibility configuration
export interface ColumnConfig {
  // Show only these columns (whitelist)
  columns?: string[]
  // Hide these columns (blacklist)
  exclude?: string[]
}

// Index view configuration
export interface IndexConfig extends ColumnConfig {
  perPage?: number  // default: 20
}

// Show view configuration
export interface ShowConfig extends ColumnConfig {}

// Form (create/edit) configuration
export interface FormConfig extends ColumnConfig {}

// Member action (operates on single record)
export interface MemberAction {
  name: string
  handler: (id: string | number, db: unknown) => Promise<void>
  destructive?: boolean  // default: true (shows confirmation)
}

// Collection action (operates on collection)
export interface CollectionAction {
  name: string
  handler: (c: Context, db: unknown) => Promise<void | Response>
}

// Full resource options
export interface ResourceOptions {
  index?: IndexConfig
  show?: ShowConfig
  form?: FormConfig
  memberActions?: MemberAction[]
  collectionActions?: CollectionAction[]
}

// Internal resource definition (after processing)
export interface ResourceDefinition {
  table: unknown
  tableName: string      // SQL name (e.g., 'sale_orders')
  routePath: string      // URL path (e.g., 'sale-orders')
  displayName: string    // Human readable (e.g., 'Sale Order')
  options: ResourceOptions
}
```

**Acceptance criteria:**
- [ ] Types compile without errors
- [ ] All customization options are represented
- [ ] Member and collection action signatures are correct

---

### 3.2 defineResource Helper
**Complexity:** Low
**Files:** `src/resources/define.ts`

The helper function consumers use to define resources.

```ts
import type { ResourceOptions } from './types'

// Simple overloads for ergonomic API
export function defineResource(table: unknown): ResourceExport
export function defineResource(table: unknown, options: ResourceOptions): ResourceExport
export function defineResource(table: unknown, options?: ResourceOptions): ResourceExport {
  return {
    __drizzleAdminResource: true,  // marker for type checking
    table,
    options: options ?? {},
  }
}

export interface ResourceExport {
  __drizzleAdminResource: true
  table: unknown
  options: ResourceOptions
}

// Type guard
export function isResourceExport(value: unknown): value is ResourceExport {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__drizzleAdminResource' in value &&
    (value as any).__drizzleAdminResource === true
  )
}
```

**Acceptance criteria:**
- [ ] `defineResource(table)` works without options
- [ ] `defineResource(table, options)` accepts options
- [ ] Type guard correctly identifies resource exports

---

### 3.3 File System Scanner
**Complexity:** High
**Files:** `src/resources/loader.ts`

Scan the resources directory and dynamically import each file.

```ts
import { readdir } from 'node:fs/promises'
import { join, resolve, extname, basename } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getTableName } from 'drizzle-orm'
import { isResourceExport, ResourceExport } from './define'
import { ResourceDefinition } from './types'
import { tableNameToRoutePath, tableNameToDisplayName } from '../utils/table'

export interface LoadResourcesResult {
  resources: ResourceDefinition[]
  errors: string[]
}

export async function loadResources(
  resourcesDir: string
): Promise<LoadResourcesResult> {
  const absoluteDir = resolve(resourcesDir)
  const resources: ResourceDefinition[] = []
  const errors: string[] = []

  let files: string[]
  try {
    files = await readdir(absoluteDir)
  } catch (err) {
    return {
      resources: [],
      errors: [`Failed to read resources directory: ${absoluteDir}`],
    }
  }

  // Filter to .ts and .js files
  const resourceFiles = files.filter((f) => {
    const ext = extname(f)
    return ext === '.ts' || ext === '.js'
  })

  for (const file of resourceFiles) {
    const filePath = join(absoluteDir, file)

    try {
      // Dynamic import (works with both .ts and .js in ESM)
      const fileUrl = pathToFileURL(filePath).href
      const module = await import(fileUrl)
      const exported = module.default

      if (!isResourceExport(exported)) {
        errors.push(
          `${file}: default export is not a valid resource. ` +
          `Use defineResource() to create the export.`
        )
        continue
      }

      const tableName = getTableName(exported.table as any)
      const routePath = tableNameToRoutePath(tableName)
      const displayName = tableNameToDisplayName(tableName)

      resources.push({
        table: exported.table,
        tableName,
        routePath,
        displayName,
        options: exported.options,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${file}: Failed to load - ${message}`)
    }
  }

  return { resources, errors }
}
```

**Acceptance criteria:**
- [ ] Finds all `.ts` and `.js` files in directory
- [ ] Dynamically imports each file
- [ ] Validates default export is a resource
- [ ] Extracts table name and derives route path
- [ ] Reports errors without crashing

---

### 3.4 Duplicate Route Detection
**Complexity:** Low
**Files:** `src/resources/loader.ts` (update)

Check for duplicate route paths after loading all resources.

```ts
export function validateResources(
  resources: ResourceDefinition[]
): string[] {
  const errors: string[] = []
  const routePaths = new Map<string, string>()  // routePath -> tableName

  for (const resource of resources) {
    const existing = routePaths.get(resource.routePath)
    if (existing) {
      errors.push(
        `Route path "${resource.routePath}" is used by both ` +
        `"${existing}" and "${resource.tableName}" tables. ` +
        `Each table must have a unique route path.`
      )
    } else {
      routePaths.set(resource.routePath, resource.tableName)
    }
  }

  return errors
}
```

**Acceptance criteria:**
- [ ] Detects when two resources have same route path
- [ ] Error message identifies both conflicting tables
- [ ] No false positives for unique routes

---

### 3.5 Integration with DrizzleAdmin
**Complexity:** Medium
**Files:** `src/DrizzleAdmin.ts` (update)

Wire the resource loader into the main class.

```ts
import { loadResources, validateResources } from './resources/loader'
import type { ResourceDefinition } from './resources/types'

export class DrizzleAdmin<T extends MinimalAdminUsersTable> {
  private resources: ResourceDefinition[] = []

  constructor(config: DrizzleAdminConfig<T>) {
    // ... existing validation
  }

  // Called before start() to load resources
  async initialize(): Promise<void> {
    const { resources, errors } = await loadResources(this.config.resourcesDir)

    if (errors.length > 0) {
      for (const error of errors) {
        console.error(`[DrizzleAdmin] ${error}`)
      }
      throw new Error(
        `Failed to load resources. ${errors.length} error(s) found.`
      )
    }

    const validationErrors = validateResources(resources)
    if (validationErrors.length > 0) {
      for (const error of validationErrors) {
        console.error(`[DrizzleAdmin] ${error}`)
      }
      throw new Error(
        `Invalid resource configuration. ${validationErrors.length} error(s) found.`
      )
    }

    this.resources = resources
    console.log(`[DrizzleAdmin] Loaded ${resources.length} resource(s)`)
  }

  // Getter for views/routes to access resources
  getResources(): ResourceDefinition[] {
    return this.resources
  }

  async start(): Promise<void> {
    await this.initialize()
    // ... start server
  }
}
```

**Acceptance criteria:**
- [ ] `initialize()` loads all resources
- [ ] Throws with descriptive error on failures
- [ ] `getResources()` returns loaded resources
- [ ] `start()` calls `initialize()` automatically

---

### 3.6 Export Public API
**Complexity:** Low
**Files:** `src/index.ts` (update)

Export the `defineResource` helper for consumers.

```ts
export { DrizzleAdmin } from './DrizzleAdmin'
export { defineConfig } from './config'
export { defineResource } from './resources/define'

export type { DrizzleAdminConfig } from './config'
export type { ResourceOptions, MemberAction, CollectionAction } from './resources/types'
```

**Acceptance criteria:**
- [ ] `defineResource` is importable from package root
- [ ] Types are exported for TypeScript consumers

---

## Testing Strategy

### Unit Tests to Write

| Test File | Coverage |
|-----------|----------|
| `src/resources/define.test.ts` | `defineResource`, type guard |
| `src/resources/loader.test.ts` | File scanning, import, validation |

### Integration Tests

Create a test fixtures directory:
```
test/
  fixtures/
    resources/
      cards.ts           # valid resource
      sale-orders.ts     # valid resource
      invalid.ts         # missing defineResource
      duplicate.ts       # same table name as another
```

Test scenarios:
- Successfully loads valid resources
- Reports error for invalid exports
- Detects duplicate routes
- Handles empty directory
- Handles missing directory

### Manual Verification

1. Create `src/admin/cards.ts` with valid resource definition
2. Create `src/admin/users.ts` with valid resource definition
3. Start DrizzleAdmin
4. Verify console shows "Loaded 2 resource(s)"
5. Test with invalid file - verify error message

---

## Definition of Done

- [ ] All 6 subtasks completed
- [ ] `pnpm test` passes all unit/integration tests
- [ ] `pnpm tsc --noEmit` succeeds
- [ ] Resources load correctly from file system
- [ ] Duplicate detection works
- [ ] `defineResource` provides good TypeScript inference
