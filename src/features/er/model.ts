import type { DiagramNode, DiagramArrow, EditorDiagram } from '@/types/diagram'
import type { ERColumn, ERForeignKey, ERTable } from '@/types/er'
import { createId } from '@/utils/id'
import { formatDataType } from './postgresTypes'

export type ERTableNode = Extract<DiagramNode, { kind: 'erTable' }>
export const ER_WIDTH = 390
export const ER_HEADER = 56
export const ER_ROW = 48
export const erHandle = (id: string, side: string) => `${id}:${side}`
export const handleColumn = (handle: string) => handle.replace(/:(left|right)$/, '')
export const newColumn = (name = ''): ERColumn => ({ id: createId('column'), name, dataType: 'text', typeArgs: '', arrayDimensions: 0, nullable: true, primaryKey: false, unique: false, defaultValue: '', identity: '', generated: '', expression: '', collation: '', comment: '' })
export const newTable = (): ERTable => ({ schema: 'public', columns: [{ ...newColumn('id'), dataType: 'bigint', primaryKey: true, nullable: false, identity: 'BY DEFAULT' }], indexes: [], checks: [], unlogged: false })
export const newForeignKey = (source: string, target: string): ERForeignKey => ({ columns: [source], referencedColumns: [target], onDelete: 'NO ACTION', onUpdate: 'NO ACTION', match: 'SIMPLE', deferrable: false, initiallyDeferred: false })
export const erTables = (diagram: EditorDiagram) => diagram.nodes.filter((n): n is ERTableNode => n.kind === 'erTable')
export const columnNames = (node: ERTableNode, ids: string[]) => ids.map(id => node.table.columns.find(c => c.id === id)?.name || '?').join(', ')
const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every(id => b.includes(id))
export function candidateKeys(table: ERTable): string[][] {
  return [table.columns.filter(c => c.primaryKey).map(c => c.id), ...table.columns.filter(c => c.unique).map(c => [c.id]),
    ...table.indexes.filter(i => i.kind === 'unique' || (i.unique && !i.predicate.trim())).map(i => i.columns)].filter(ids => ids.length)
}
export const isCandidateKey = (table: ERTable, ids: string[]) => candidateKeys(table).some(key => sameSet(key, ids))
export function relationshipCardinality(source: ERTableNode, arrow: DiagramArrow) {
  const ids = arrow.foreignKey?.columns ?? []
  const columns = source.table.columns.filter(c => ids.includes(c.id))
  const allowsNull = (c: ERColumn) => c.nullable && !c.primaryKey && !c.identity && !/serial$/.test(c.dataType)
  const nullable = arrow.foreignKey?.match === 'FULL' ? columns.every(allowsNull) : columns.some(allowsNull)
  return { child: candidateKeys(source.table).some(key => key.every(id => ids.includes(id))) ? '0..1' : '0..N', parent: nullable ? '0..1' : '1' }
}
export function columnDetails(column: ERColumn) {
  return [column.primaryKey || !column.nullable || column.identity || /serial$/.test(column.dataType) ? 'NOT NULL' : 'NULL',
    column.identity ? `IDENTITY ${column.identity}` : '', column.generated ? `${column.generated} (${column.expression})` : '',
    column.defaultValue ? `DEFAULT ${column.defaultValue}` : '', column.collation ? `COLLATE ${column.collation}` : '', column.comment].filter(Boolean).join(' · ')
}
export function tableFooter(node: ERTableNode): string[] {
  const t = node.table
  return [
    ...(t.columns.some(c => c.primaryKey) ? [`PK (${columnNames(node, t.columns.filter(c => c.primaryKey).map(c => c.id))})`] : []),
    ...t.indexes.map(i => `${i.kind === 'unique' || i.unique ? 'UNIQUE' : 'INDEX'} ${i.name || '…'} · ${i.method} (${columnNames(node, i.columns)})${i.nullsNotDistinct ? ' NULLS NOT DISTINCT' : ''}${i.include.length ? ` INCLUDE (${columnNames(node, i.include)})` : ''}${i.predicate ? ` WHERE ${i.predicate}` : ''}`),
    ...t.checks.map(c => `CHECK ${c.name || ''} (${c.expression})`),
    ...(node.notes ? [node.notes] : []),
  ]
}
export const tableHeight = (node: ERTableNode) => ER_HEADER + Math.max(1, node.table.columns.length) * ER_ROW + Math.max(1, tableFooter(node).length) * 24 + 12
export function normalizedType(column: ERColumn) {
  const type = column.dataType.replace('bigserial', 'bigint').replace('smallserial', 'smallint').replace('serial', 'integer')
  return formatDataType({ ...column, dataType: type, typeArgs: '' })
}
