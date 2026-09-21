import { CommitInput } from '@/components/CommitInput'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import { ARROW_TYPE_COLORS } from '@/entities/idef0/constants'
import type { ArrowEdgeData } from '@/features/diagram/lib/flowMappers'

type ArrowFlowEdge = Edge<ArrowEdgeData, 'idef0Arrow'>

export const ArrowEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
}: EdgeProps<ArrowFlowEdge>) => {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 0,
    offset: 30,
    centerX: (sourceX + targetX) / 2 + (data?.arrow.routeOffset ?? 0),
    centerY: (sourceY + targetY) / 2 + (data?.arrow.routeOffset ?? 0),
  })

  const arrow = data?.arrow
  const color = arrow ? (arrow.arrowType === 'sequence' ? '#475569' : ARROW_TYPE_COLORS[arrow.arrowType]) : '#2563eb'

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: selected ? 3 : 2.5 }} />
      {arrow && (arrow.arrowType !== 'sequence' || arrow.label || selected) ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute bg-white px-1 text-xs text-slate-800"
            style={{ width: arrow.arrowType === 'sequence' ? selected ? 150 : Math.max(36, arrow.label.length * 7 + 12) : undefined, pointerEvents: 'all', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <CommitInput className="node-name" aria-label="Подпись стрелки на холсте" placeholder="Подпись стрелки" value={arrow.label} onCommit={label => useIdef0Store.getState().updateArrow(arrow.id, { label })} />
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
