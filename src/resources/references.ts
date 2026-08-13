import type { ResourceDefinition } from '@/resources/types.ts'

/** Validates explicitly configured references for a resource. */
export function validateReferences<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  allResources: ResourceDefinition<TableRef, ActionDatabase>[],
): string[] {
  const references = resource.options.references
  if (!references) return []

  const errors: string[] = []

  for (const [columnName, reference] of Object.entries(references)) {
    if (!resource.columns.some((column) => column.name === columnName)) {
      errors.push(
        `Resource "${resource.tableName}" declares a reference for unknown column "${columnName}".`,
      )
      continue
    }

    if (!allResources.some((candidate) => candidate.tableName === reference.table)) {
      errors.push(
        `Resource "${resource.tableName}" column "${columnName}" references unregistered table "${reference.table}".`,
      )
    }
  }

  return errors
}
