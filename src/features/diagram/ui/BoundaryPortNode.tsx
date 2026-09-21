import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import { BOUNDARY_HANDLES, ARROW_TYPE_LABELS } from '@/entities/idef0/constants'
import type { BoundaryNodeData } from '@/features/diagram/lib/flowMappers'

type BoundaryFlowNode = Node<BoundaryNodeData, 'boundaryPort'>
export const BoundaryPortNode = ({ data, selected }: NodeProps<BoundaryFlowNode>) => {
  const role = data.node.boundaryRole ?? 'input'
  return <div className={`boundary-anchor ${selected ? 'is-selected' : ''}`} title={`${ARROW_TYPE_LABELS[role]}: точка на границе листа`}>
    <Handle id={role === 'output' ? BOUNDARY_HANDLES.outputTarget : BOUNDARY_HANDLES.sourceOutput}
      type={role === 'output' ? 'target' : 'source'}
      position={role === 'output' ? Position.Left : role === 'control' ? Position.Bottom : role === 'mechanism' ? Position.Top : Position.Right}
      style={{ top: '50%', left: '50%', right: 'auto', bottom: 'auto', transform: 'translate(-50%, -50%)', width: 8, height: 8 }} />
  </div>
}
