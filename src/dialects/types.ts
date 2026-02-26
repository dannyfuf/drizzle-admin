export interface ColumnMeta {
  name: string
  sqlName: string
  dataType: string
  isNullable: boolean
  isPrimaryKey: boolean
  hasDefault: boolean
  enumValues?: string[]
}

export interface DialectAdapter {
  name: 'postgresql' | 'mysql' | 'sqlite'
  extractColumns(table: unknown): ColumnMeta[]
}
