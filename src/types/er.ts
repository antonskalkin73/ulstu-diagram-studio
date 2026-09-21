export interface ERColumn {
  id: string
  name: string
  dataType: string
  typeArgs: string
  arrayDimensions: number
  nullable: boolean
  primaryKey: boolean
  unique: boolean
  defaultValue: string
  identity: '' | 'ALWAYS' | 'BY DEFAULT'
  generated: '' | 'STORED' | 'VIRTUAL'
  expression: string
  collation: string
  comment: string
}
export interface ERIndex {
  id: string
  name: string
  kind: 'unique' | 'index'
  columns: string[]
  method: 'btree' | 'hash' | 'gist' | 'spgist' | 'gin' | 'brin'
  unique: boolean
  nullsNotDistinct: boolean
  predicate: string
  include: string[]
}
export interface ERCheck { id: string; name: string; expression: string }
export interface ERTable {
  schema: string
  columns: ERColumn[]
  indexes: ERIndex[]
  checks: ERCheck[]
  unlogged: boolean
}
export const referentialActions = ['NO ACTION', 'RESTRICT', 'CASCADE', 'SET NULL', 'SET DEFAULT'] as const
export interface ERForeignKey {
  columns: string[]
  referencedColumns: string[]
  onDelete: typeof referentialActions[number]
  onUpdate: typeof referentialActions[number]
  match: 'SIMPLE' | 'FULL'
  deferrable: boolean
  initiallyDeferred: boolean
}
