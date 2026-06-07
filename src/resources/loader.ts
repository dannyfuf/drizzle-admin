import { readdir } from 'node:fs/promises'
import { join, resolve, extname } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { AdminBackend } from '@/backends/types.ts'
import { isResourceExport } from '@/resources/define.ts'
import type { ResourceDefinition } from '@/resources/types.ts'
import type { PgTable } from 'drizzle-orm/pg-core'
import type { AnyPgDatabase } from '@/types.ts'

export interface LoadResourcesResult<TableRef = PgTable, ActionDatabase = AnyPgDatabase> {
  resources: ResourceDefinition<TableRef, ActionDatabase>[]
  errors: string[]
}

export async function loadResources<TableRef = PgTable, ActionDatabase = AnyPgDatabase>(
  resourcesDir: string,
  backend: AdminBackend<ActionDatabase, TableRef>,
): Promise<LoadResourcesResult<TableRef, ActionDatabase>> {
  const absoluteDir = resolve(resourcesDir)
  const resources: ResourceDefinition<TableRef, ActionDatabase>[] = []
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
          `Use defineResource(), defineKnexResource(), or definePersistenceResource() to create the export.`
        )
        continue
      }

      const resourceBackend = exported.backend ?? 'drizzle'
      if (resourceBackend !== backend.name) {
        errors.push(
          `${file}: resource is declared for the "${resourceBackend}" backend, ` +
          `but the current configuration uses "${backend.name}".`
        )
        continue
      }

      resources.push(backend.resolveResource({
        table: exported.table as TableRef,
        options: exported.options as never,
      }))
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      errors.push(`${file}: Failed to load - ${message}`)
    }
  }

  return { resources, errors }
}

export function validateResources<TableRef, ActionDatabase>(resources: ResourceDefinition<TableRef, ActionDatabase>[]): string[] {
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
