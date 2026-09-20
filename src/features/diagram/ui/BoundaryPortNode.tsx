import { CommitInput } from '@/components/CommitInput'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { BOUNDARY_HANDLES, ARROW_TYPE_LABELS } from '@/entities/idef0/constants'
import type { BoundaryNodeData } from '@/features/diagram/lib/flowMappers'
import type { Node } from '@xyflow/react'

const handleClassName = 'h-3 w-3 rounded-full border-2 border-slate-700 bg-white'

type BoundaryFlowNode = Node<BoundaryNodeData, 'boundaryPort'>

export const BoundaryPortNode = ({ data, selected }: NodeProps<BoundaryFlowNode>) => {
  const { node } = data
  const role = node.boundaryRole ?? 'input'

  return (
    <div
      className={`relative flex h-[56px] w-[140px] flex-col justify-center rounded-full border bg-white px-4 text-center shadow-sm ${
        selected ? 'border-blue-500 ring-2 ring-blue-200' : 'border-slate-300'
      }`}
    >
      {role === 'output' ? (
        <Handle id={BOUNDARY_HANDLES.outputTarget} type="target" position={Position.Left} className={handleClassName} />
      ) : (
        <Handle
          id={BOUNDARY_HANDLES.sourceOutput}
          type="source"
          position={role === 'control' ? Position.Bottom : role === 'mechanism' ? Position.Top : Position.Right}
          className={handleClassName}
        />
      )}
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{ARROW_TYPE_LABELS[role]}</div>
      <CommitInput className="nodrag nopan node-name text-xs font-medium text-slate-800" aria-label="Имя интерфейса" value={node.name} onCommit={name => useIdef0Store.getState().updateNode(node.id, { name })} />
    </div>
  )
}
