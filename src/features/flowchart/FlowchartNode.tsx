import { Handle, Position, type Node, type NodeProps } from '@xyflow/react'
import { CommitInput } from '@/components/CommitInput'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import type { DiagramNode } from '@/types/diagram'
import { flowchartShapes, flowchartSides } from '@/types/flowchart'
import { flowchartHandleInset, flowchartOutline } from './geometry'

export type FlowchartFlowNode = Node<{ node: DiagramNode }, 'flowchart'>

export function FlowchartNode({ data, selected }: NodeProps<FlowchartFlowNode>) {
  const node = data.node
  const shape = node.shape ?? 'process'
  return <div className={`flowchart-node shape-${shape} ${selected ? 'is-selected' : ''}`} style={{ width: node.width, height: node.height }}>
    <svg className="flowchart-outline" width={node.width} height={node.height} aria-hidden="true">
      <path d={flowchartOutline(shape, node.width, node.height)} />
      {shape === 'subprocess' && <path d={`M 14 0 V ${node.height} M ${node.width - 14} 0 V ${node.height}`} fill="none" />}
    </svg>
    <div className="flowchart-text nodrag nopan">
      <CommitInput multiline aria-label="Текст блока на холсте" placeholder={flowchartShapes[shape].title} value={node.name}
        onCommit={name => useIdef0Store.getState().updateNode(node.id, { name })} />
    </div>
    {flowchartSides.map(side => <Handle key={side} id={side} type="source" position={side as Position}
      style={{ [side]: flowchartHandleInset(shape, side) }} />)}
  </div>
}
