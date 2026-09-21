import { CommitInput } from '@/components/CommitInput'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { FUNCTION_HANDLES } from '@/entities/idef0/constants'
import type { FunctionNodeData } from '@/features/diagram/lib/flowMappers'
import type { Node } from '@xyflow/react'

const handleClassName = 'h-3 w-3 rounded-full border-2 border-slate-700 bg-white'

type FunctionFlowNode = Node<FunctionNodeData, 'idef0Function'>

export const FunctionNode = ({ data, selected }: NodeProps<FunctionFlowNode>) => {
  const { node } = data

  return (
    <div
      className={`relative flex h-[120px] w-[220px] flex-col rounded-none border-2 bg-white px-4 py-3 text-slate-900 shadow-sm transition ${
        selected ? 'border-blue-500 shadow-lg' : 'border-slate-400'
      }`}
    >
      <Handle id={FUNCTION_HANDLES.controlTarget} type="target" position={Position.Top} className={handleClassName} />
      <Handle id={FUNCTION_HANDLES.inputTarget} type="target" position={Position.Left} className={handleClassName} />
      <Handle id={FUNCTION_HANDLES.outputSource} type="source" position={Position.Right} className={handleClassName} />
      <Handle id={FUNCTION_HANDLES.mechanismTarget} type="target" position={Position.Bottom} className={handleClassName} />


      <div className="flex flex-1 items-center justify-center text-center text-sm font-semibold leading-5">
        <CommitInput className="nodrag nopan node-name" aria-label="Имя функции" placeholder="Название функции" value={node.name} onCommit={name => useIdef0Store.getState().updateNode(node.id, { name })} />
      </div>

      <div className="absolute bottom-2 right-3 text-xs font-medium text-slate-600">{node.nodeNumber}</div>
    </div>
  )
}
