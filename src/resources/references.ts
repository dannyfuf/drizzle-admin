import { isPasswordColumn, SUPPORTED_FILTER_DATA_TYPES } from '@/resources/filters.ts'
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

/** Validates reverse-reference configuration for a resource. */
export function validateReferencedBy<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  allResources: ResourceDefinition<TableRef, ActionDatabase>[],
): string[] {
  const referencedBy = resource.options.referencedBy
  if (!referencedBy) return []

  const errors: string[] = []

  for (const [label, reference] of Object.entries(referencedBy)) {
    const childResource = allResources.find(
      (candidate) => candidate.tableName === reference.table,
    )
    if (!childResource) {
      errors.push(
        `Resource "${resource.tableName}" referencedBy "${label}" targets unregistered table "${reference.table}".`,
      )
      continue
    }

    const foreignKeyColumn = childResource.columns.find(
      (column) => column.name === reference.foreignKey,
    )
    if (!foreignKeyColumn) {
      errors.push(
        `Resource "${resource.tableName}" referencedBy "${label}" targets unknown column "${reference.foreignKey}" on table "${reference.table}".`,
      )
      continue
    }

    if (isPasswordColumn(foreignKeyColumn.name)) {
      errors.push(
        `Resource "${resource.tableName}" referencedBy "${label}" cannot use password column "${reference.foreignKey}" on table "${reference.table}".`,
      )
      continue
    }

    if (!SUPPORTED_FILTER_DATA_TYPES.has(foreignKeyColumn.dataType)) {
      errors.push(
        `Resource "${resource.tableName}" referencedBy "${label}" foreign key "${reference.foreignKey}" on table "${reference.table}" has unsupported type "${foreignKeyColumn.dataType}". Supported types: text, integer, boolean, enum, timestamp.`,
      )
    }
  }

  return errors
}
