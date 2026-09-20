import { CommitInput } from '@/components/CommitInput'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react'
import { ARROW_TYPE_COLORS, ARROW_TYPE_LABELS } from '@/entities/idef0/constants'
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
  const color = arrow ? ARROW_TYPE_COLORS[arrow.arrowType] : '#2563eb'

  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={{ stroke: color, strokeWidth: selected ? 3 : 2.5 }} />
      {arrow ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2 rounded border border-slate-300 bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700 shadow-sm"
            style={{ pointerEvents: 'all', transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <CommitInput className="node-name" aria-label="Подпись стрелки на холсте" value={arrow.label} onCommit={label => useIdef0Store.getState().updateArrow(arrow.id, { label })} />
            <div className="text-[10px] uppercase text-slate-400">{ARROW_TYPE_LABELS[arrow.arrowType]}</div>
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
