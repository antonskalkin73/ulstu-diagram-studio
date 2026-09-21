import type { DiagramArrow, EditorDiagram, DiagramNode } from '@/types/diagram'

export const BOUNDARY_ANCHOR_SIZE = 8
export function getDiagramFrame(diagram: EditorDiagram) {
  const functions = diagram.nodes.filter(n => n.kind === 'function')
  const x = Math.min(0, ...functions.map(n => n.position.x - 180))
  const y = Math.min(0, ...functions.map(n => n.position.y - 160))
  const right = Math.max(900, ...functions.map(n => n.position.x + n.width + 180))
  const bottom = Math.max(600, ...functions.map(n => n.position.y + n.height + 160))
  return { x, y, width: right - x, height: bottom - y }
}

// Boundary coordinates are diagram coordinates, independent of screen pan/zoom.
export function getBoundaryPoint(node: DiagramNode, frame: ReturnType<typeof getDiagramFrame>) {
  const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v))
  const horizontal = clamp(node.position.x + BOUNDARY_ANCHOR_SIZE / 2, frame.x + 30, frame.x + frame.width - 30)
  const vertical = clamp(node.position.y + BOUNDARY_ANCHOR_SIZE / 2, frame.y + 30, frame.y + frame.height - 30)
  switch (node.boundaryRole) {
    case 'control': return { x: horizontal, y: frame.y }
    case 'mechanism': return { x: horizontal, y: frame.y + frame.height }
    case 'output': return { x: frame.x + frame.width, y: vertical }
    default: return { x: frame.x, y: vertical }
  }
}

export function getBoundaryPosition(node: DiagramNode, frame: ReturnType<typeof getDiagramFrame>) {
  const point = getBoundaryPoint(node, frame)
  return { x: point.x - BOUNDARY_ANCHOR_SIZE / 2, y: point.y - BOUNDARY_ANCHOR_SIZE / 2 }
}

// Old files used names on oval interface nodes. Preserve meaningful names as
// arrow labels, but do not turn generated prompts into actual diagram text.
export function getArrowLabel(arrow: DiagramArrow, diagram: EditorDiagram) {
  if (arrow.arrowType === 'sequence') return arrow.label
  if (arrow.label && arrow.label !== `${arrow.arrowType.toUpperCase()} flow`) return arrow.label
  const boundary = diagram.nodes.find(n => n.kind === 'boundaryPort' && (n.id === arrow.source || n.id === arrow.target))
  return boundary?.name && !/^Внешний (Input|Control|Output|Mechanism)$/.test(boundary.name) ? boundary.name : ''
}

export function getExternalArrowFunction(diagram: EditorDiagram, selection: { nodeIds: string[]; arrowIds: string[] }) {
  const selected = diagram.nodes.filter(n => n.kind === 'function' && selection.nodeIds.includes(n.id))
  if (selected.length === 1) return selected[0]
  const edge = diagram.arrows.find(a => selection.arrowIds.includes(a.id))
  if (edge) {
    const functions = diagram.nodes.filter(n => n.kind === 'function' && (n.id === edge.source || n.id === edge.target))
    if (functions.length === 1) return functions[0]
  }
  const functions = diagram.nodes.filter(n => n.kind === 'function')
  return functions.length === 1 ? functions[0] : undefined
}
