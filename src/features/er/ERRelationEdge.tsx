import { erRelationPath } from './geometry'
import { BaseEdge, EdgeLabelRenderer, type Edge, type EdgeProps } from '@xyflow/react'
import type { DiagramArrow } from '@/types/diagram'

export type ERFlowEdge = Edge<{ arrow: DiagramArrow; child: string; parent: string; description: string }, 'erRelation'>
export function ERRelationEdge(props: EdgeProps<ERFlowEdge>) {
  const { id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, source, target, selected, data } = props
  const [path, x, y] = erRelationPath(sourceX, sourceY, targetX, targetY, source === target, data?.arrow.routeOffset ?? 0, sourcePosition, targetPosition)
  const caption = (text: string, x: number, y: number, cls = '') => <span className={`er-relation-label ${cls}`} style={{ maxWidth: cls ? Math.abs(sourceX - targetX) > 40 ? Math.min(200, Math.abs(sourceX - targetX) - 16) : 200 : undefined, transform: `translate(-50%, -50%) translate(${x}px, ${y}px)` }}>{text}</span>
  return <><BaseEdge id={id} path={path} style={{ stroke: selected ? '#2563eb' : '#7c3aed', strokeWidth: selected ? 3 : 1.8 }} />
    <EdgeLabelRenderer><div title={data?.description}>
      {caption(data?.arrow.label || 'FK', x, y, 'er-relation-name')}
      {caption(data?.child ?? '', sourceX + (sourcePosition === 'left' ? -22 : 22), sourceY - 12)}
      {caption(data?.parent ?? '', targetX + (targetPosition === 'left' ? -22 : 22), targetY - 12)}
    </div></EdgeLabelRenderer></>
}
