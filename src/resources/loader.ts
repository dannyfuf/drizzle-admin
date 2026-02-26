import { readdir } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { getTableName } from 'drizzle-orm'
import { isResourceExport } from './define.js'
import type { ResourceDefinition } from './types.js'
import { tableNameToRoutePath, tableNameToDisplayName } from '../utils/table.js'

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
  } catch {
    return {
      resources: [],
      errors: [`Failed to read resources directory: ${absoluteDir}`],
    }
  }

  const resourceFiles = files.filter((f) => {
    const ext = extname(f)
    return ext === '.ts' || ext === '.js'
  })

  for (const file of resourceFiles) {
    const filePath = join(absoluteDir, file)

    try {
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

export function validateResources(resources: ResourceDefinition[]): string[] {
  const errors: string[] = []
  const routePaths = new Map<string, string>()

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
