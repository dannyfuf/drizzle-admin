import type { ColumnMeta } from '@/dialects/types.ts'
import type { ResourceDefinition } from '@/resources/types.ts'

const SUPPORTED_FILTER_DATA_TYPES = new Set(['text', 'integer', 'boolean', 'enum', 'timestamp'])

export interface DeclaredFilter {
  name: string
  queryKey: string
  column: ColumnMeta
}

export type ParsedFilterValue = string | number | boolean | Date

export interface ParsedFilter {
  filter: DeclaredFilter
  rawValue: string
  value: ParsedFilterValue
}

interface DeclaredFilterResolution {
  filters: DeclaredFilter[]
  errors: string[]
}

export function validateDeclaredFilters<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  columns: ColumnMeta[],
): string[] {
  return resolveDeclaredFilters(resource, columns).errors
}

export function getDeclaredFilters<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  columns: ColumnMeta[],
): DeclaredFilter[] {
  const { filters, errors } = resolveDeclaredFilters(resource, columns)

  if (errors.length > 0) {
    throw new Error(errors.join(' '))
  }

  return filters
}

export function parseDeclaredFilterValues(
  declaredFilters: DeclaredFilter[],
  getQueryValue: (queryKey: string) => string | undefined,
): ParsedFilter[] {
  const parsedFilters: ParsedFilter[] = []

  for (const filter of declaredFilters) {
    const rawQueryValue = getQueryValue(filter.queryKey)
    if (typeof rawQueryValue !== 'string') {
      continue
    }

    const normalizedQueryValue = rawQueryValue.trim()
    if (normalizedQueryValue === '') {
      continue
    }

    const parsedValue = parseFilterValue(filter.column, normalizedQueryValue)
    if (parsedValue === null) {
      continue
    }

    parsedFilters.push({
      filter,
      rawValue: normalizedQueryValue,
      value: parsedValue,
    })
  }

  return parsedFilters
}

export function buildFilterQuery(parsedFilters: ParsedFilter[]): Record<string, string> {
  return Object.fromEntries(
    parsedFilters.map(({ filter, rawValue }) => [filter.queryKey, rawValue]),
  )
}

function resolveDeclaredFilters<TableRef, ActionDatabase>(
  resource: ResourceDefinition<TableRef, ActionDatabase>,
  columns: ColumnMeta[],
): DeclaredFilterResolution {
  const declaredNames = resource.options.index?.filters ?? []
  if (declaredNames.length === 0) {
    return { filters: [], errors: [] }
  }

  const columnByName = new Map(columns.map((column) => [column.name, column]))
  const seenNames = new Set<string>()
  const filters: DeclaredFilter[] = []
  const errors: string[] = []

  for (const name of declaredNames) {
    if (seenNames.has(name)) {
      errors.push(
        `Resource "${resource.tableName}": index.filters contains duplicate column "${name}".`,
      )
      continue
    }
    seenNames.add(name)

    const column = columnByName.get(name)
    if (!column) {
      errors.push(
        `Resource "${resource.tableName}": index.filters references unknown column "${name}".`,
      )
      continue
    }

    if (isPasswordColumn(column.name)) {
      errors.push(
        `Resource "${resource.tableName}": index.filters cannot include password column "${name}".`,
      )
      continue
    }

    if (!SUPPORTED_FILTER_DATA_TYPES.has(column.dataType)) {
      errors.push(
        `Resource "${resource.tableName}": index.filters column "${name}" has unsupported type "${column.dataType}". Supported types: text, integer, boolean, enum, timestamp.`,
      )
      continue
    }

    filters.push({
      name,
      queryKey: `filter_${name}`,
      column,
    })
  }

  return { filters, errors }
}

function parseFilterValue(column: ColumnMeta, rawValue: string): ParsedFilterValue | null {
  if (column.dataType === 'text') {
    return rawValue
  }

  if (column.dataType === 'integer') {
    if (!/^-?\d+$/.test(rawValue)) {
      return null
    }

    return Number.parseInt(rawValue, 10)
  }

  if (column.dataType === 'boolean') {
    if (rawValue === 'true') {
      return true
    }

    if (rawValue === 'false') {
      return false
    }

    return null
  }

  if (column.dataType === 'enum') {
    if (!column.enumValues?.includes(rawValue)) {
      return null
    }

    return rawValue
  }

  if (column.dataType === 'timestamp') {
    const parsedDate = new Date(rawValue)
    return Number.isNaN(parsedDate.getTime()) ? null : parsedDate
  }

  return null
}

function isPasswordColumn(name: string): boolean {
  return name.toLowerCase().includes('password')
}
