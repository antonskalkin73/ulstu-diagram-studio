import { BOUNDARY_ANCHOR_SIZE, getArrowLabel, getBoundaryPosition, getDiagramFrame } from './diagramGeometry'
import type { Edge, Node } from '@xyflow/react'
import { MarkerType } from '@xyflow/react'
import { ARROW_TYPE_COLORS } from '@/entities/idef0/constants'
import type { DiagramArrow, EditorDiagram, DiagramNode } from '@/types/diagram'

export interface FunctionNodeData extends Record<string, unknown> {
  node: DiagramNode
}

export interface BoundaryNodeData extends Record<string, unknown> {
  node: DiagramNode
}

export interface ArrowEdgeData extends Record<string, unknown> {
  arrow: DiagramArrow
}

export type FlowNodeData = FunctionNodeData | BoundaryNodeData
export type FlowNode = Node<FlowNodeData>
export type FlowEdge = Edge<ArrowEdgeData>

export const toFlowNodes = (diagram: EditorDiagram, frame = getDiagramFrame(diagram)): FlowNode[] => {
  return diagram.nodes.map(node => ({
    id: node.id,
    type: node.kind === 'function' ? 'idef0Function' : 'boundaryPort',
    position: node.kind === 'function' ? node.position : getBoundaryPosition(node, frame),
    data: { node },
    width: node.kind === 'function' ? node.width : BOUNDARY_ANCHOR_SIZE,
    height: node.kind === 'function' ? node.height : BOUNDARY_ANCHOR_SIZE,
    draggable: true, selectable: true,
  }))
}

export const toFlowEdges = (diagram: EditorDiagram): FlowEdge[] =>
  diagram.arrows.map((arrow) => ({
    id: arrow.id,
    source: arrow.source,
    target: arrow.target,
    sourceHandle: arrow.sourceHandle,
    targetHandle: arrow.targetHandle,
    type: 'idef0Arrow',
    label: getArrowLabel(arrow, diagram),
    data: { arrow: { ...arrow, label: getArrowLabel(arrow, diagram) } },
    animated: false,
    markerEnd: {
      type: MarkerType.ArrowClosed,
      width: 18,
      height: 18,
      color: ((arrow.arrowType === 'sequence' || arrow.arrowType === 'relation') ? '#475569' : ARROW_TYPE_COLORS[arrow.arrowType]),
    },
    style: {
      stroke: ((arrow.arrowType === 'sequence' || arrow.arrowType === 'relation') ? '#475569' : ARROW_TYPE_COLORS[arrow.arrowType]),
      strokeWidth: 2.5,
    },
  }))
