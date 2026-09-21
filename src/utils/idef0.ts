import {
  BOUNDARY_HANDLES,
  FUNCTION_HANDLES,
} from '@/entities/idef0/constants'
import type { ArrowType } from '@/types/idef0'
import type { DiagramArrow, EditorDiagram, DiagramNode } from '@/types/diagram'

export const cloneProject = <T>(value: T): T => structuredClone(value)

export const getDiagramById = (diagrams: EditorDiagram[], diagramId: string): EditorDiagram | undefined =>
  diagrams.find((diagram) => diagram.id === diagramId)

export const getNodeById = (diagram: EditorDiagram, nodeId: string): DiagramNode | undefined =>
  diagram.nodes.find((node) => node.id === nodeId)

export const getFunctionNodes = (diagram: EditorDiagram): DiagramNode[] =>
  diagram.nodes.filter((node) => node.kind === 'function')

export const getDiagramPath = (diagrams: EditorDiagram[], diagramId: string): EditorDiagram[] => {
  const path: EditorDiagram[] = []
  let cursor = getDiagramById(diagrams, diagramId)

  while (cursor) {
    path.unshift(cursor)
    cursor = cursor.parentDiagramId ? getDiagramById(diagrams, cursor.parentDiagramId) : undefined
  }

  return path
}

export const getNextFunctionNumber = (diagram: EditorDiagram, parentNode?: DiagramNode): string => {
  const functionNodes = getFunctionNodes(diagram)
  const usedNumbers = functionNodes
    .map((node) => node.nodeNumber)
    .filter((value): value is string => Boolean(value))

  if (diagram.isContext) {
    if (!usedNumbers.includes('A0')) {
      return 'A0'
    }

    let index = 1
    while (usedNumbers.includes(`A${index}`)) {
      index += 1
    }

    return `A${index}`
  }

  const prefix = parentNode?.nodeNumber ?? diagram.nodeNumber
  let index = 1

  while (usedNumbers.includes(`${prefix}${index}`)) {
    index += 1
  }

  return `${prefix}${index}`
}

export const getArrowTypeFromHandles = (
  source: DiagramNode,
  target: DiagramNode,
  sourceHandle?: string | null,
  targetHandle?: string | null,
): ArrowType | null => {
  if (source.kind === 'boundaryPort' && source.boundaryRole && source.boundaryRole !== 'output') {
    return source.boundaryRole
  }

  if (target.kind === 'boundaryPort' && target.boundaryRole === 'output') {
    return 'output'
  }

  switch (targetHandle) {
    case FUNCTION_HANDLES.inputTarget:
      return 'input'
    case FUNCTION_HANDLES.controlTarget:
      return 'control'
    case FUNCTION_HANDLES.mechanismTarget:
      return 'mechanism'
    case BOUNDARY_HANDLES.outputTarget:
      return 'output'
    default:
      return sourceHandle === FUNCTION_HANDLES.outputSource ? 'output' : null
  }
}

export const isArrowSemanticallyValid = (
  source: DiagramNode,
  target: DiagramNode,
  arrowType: ArrowType | 'sequence' | 'relation',
  sourceHandle: string,
  targetHandle: string,
): boolean => {
  if (source.kind === 'function') {
    if (sourceHandle !== FUNCTION_HANDLES.outputSource) {
      return false
    }

    if (target.kind === 'function') {
      const expectedHandle =
        arrowType === 'input'
          ? FUNCTION_HANDLES.inputTarget
          : arrowType === 'control'
            ? FUNCTION_HANDLES.controlTarget
            : arrowType === 'mechanism'
              ? FUNCTION_HANDLES.mechanismTarget
              : ''

      return expectedHandle !== '' && targetHandle === expectedHandle
    }

    return arrowType === 'output' && target.boundaryRole === 'output' && targetHandle === BOUNDARY_HANDLES.outputTarget
  }

  if (!source.boundaryRole || source.boundaryRole === 'output') {
    return false
  }

  if (target.kind !== 'function') {
    return false
  }

  const expectedTarget =
    arrowType === 'input'
      ? FUNCTION_HANDLES.inputTarget
      : arrowType === 'control'
        ? FUNCTION_HANDLES.controlTarget
        : FUNCTION_HANDLES.mechanismTarget

  return source.boundaryRole === arrowType && sourceHandle === BOUNDARY_HANDLES.sourceOutput && targetHandle === expectedTarget
}

export const getIncomingArrows = (diagram: EditorDiagram, nodeId: string, arrowType?: ArrowType): DiagramArrow[] =>
  diagram.arrows.filter(
    (arrow) => arrow.target === nodeId && (!arrowType || arrow.arrowType === arrowType),
  )

export const getOutgoingArrows = (diagram: EditorDiagram, nodeId: string): DiagramArrow[] =>
  diagram.arrows.filter((arrow) => arrow.source === nodeId)

export const collectChildDiagramIds = (
  diagrams: EditorDiagram[],
  startDiagramId: string,
): string[] => {
  const children = diagrams.filter((diagram) => diagram.parentDiagramId === startDiagramId)
  const nested = children.flatMap((diagram) => collectChildDiagramIds(diagrams, diagram.id))
  return [startDiagramId, ...nested]
}

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const downloadTextFile = (content: string, fileName: string, mimeType: string): void => {
  downloadBlob(new Blob([content], { type: mimeType }), fileName)
}
