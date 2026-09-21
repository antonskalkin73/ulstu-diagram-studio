import { useEffect } from 'react'
import { useUpdateNodeInternals, Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { columnDetails, erHandle, ER_HEADER, ER_ROW, tableFooter, type ERTableNode as Table } from './model'
import { formatDataType } from './postgresTypes'
import { useERUI } from './useERUI'

export type ERFlowNode = Node<{ node: Table; foreignColumns: string[] }, 'erTable'>
export function ERTableNode({ data, selected }: NodeProps<ERFlowNode>) {
  const { node, foreignColumns } = data
  const updateInternals = useUpdateNodeInternals()
  useEffect(() => { updateInternals(node.id) }, [node.id, node.table.columns, node.height, updateInternals])
  return <div className={`er-table-node ${selected ? 'is-selected' : ''}`} style={{ width: node.width, height: node.height }}>
    <header className="er-table-drag"><div><small>{node.table.schema || 'Схема'} · PostgreSQL 18{node.table.unlogged ? ' · UNLOGGED' : ''}</small><strong>{node.name || 'Имя таблицы'}</strong></div><button className="nodrag nopan" aria-label={`Структура ${node.name || 'таблицы'}`} onClick={() => useERUI.getState().editTable(node.id)}>⋯</button></header>
    {node.table.columns.map((c, index) => <div className="er-table-column" key={c.id} title={`${c.name} ${formatDataType(c)}\n${columnDetails(c)}`}>
      <div className="er-column-main"><span className="er-key-badges">{c.primaryKey && <b className="pk">PK</b>}{foreignColumns.includes(c.id) && <b className="fk">FK</b>}{c.unique && <b>UQ</b>}</span><strong>{c.name || 'Без имени'}</strong><code>{formatDataType(c)}</code></div>
      <div className="er-column-details">{columnDetails(c)}</div>
      {(['left', 'right'] as const).map(side => <Handle key={side} id={erHandle(c.id, side)} type="source" position={side as Position} style={{ top: ER_HEADER + index * ER_ROW + ER_ROW / 2 }} title={`${c.name}: перетащите FK к PK/UNIQUE`} />)}
    </div>)}
    {!node.table.columns.length && <div className="er-table-column er-help">Добавьте колонки в структуре таблицы</div>}
    <div className="er-table-footer">{tableFooter(node).map((line, i) => <div title={line} key={i}>{line}</div>)}{!tableFooter(node).length && <div>Нет ключей и ограничений</div>}</div>
  </div>
}
