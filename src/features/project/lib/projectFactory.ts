import {
  BOUNDARY_NODE_SIZE,
  FUNCTION_NODE_SIZE,
} from '@/entities/idef0/constants'
import type { ArrowType } from '@/types/idef0'
import type { EditorDiagram, DiagramNode, EditorProject } from '@/types/diagram'
import { createId } from '@/utils/id'
import { getNextFunctionNumber } from '@/utils/idef0'

const now = (): string => new Date().toISOString()

export const createEmptyProject = (type: 'idef0' | 'flowchart' = 'idef0'): EditorProject => {
  const rootDiagramId = createId('diagram')

  return {
    id: createId('project'),
    name: 'Новый проект',
    version: '3.0.0',
    rootDiagramId,
    diagrams: [
      {
        id: rootDiagramId,
        type,
        title: type === 'idef0' ? 'Контекстная диаграмма' : 'Блок-схема',
        nodeNumber: type === 'idef0' ? 'A-0' : '',
        parentDiagramId: null,
        parentNodeId: null,
        isContext: type === 'idef0',
        nodes: [],
        arrows: [],
      },
    ],
    settings: {
      strictMode: true,
      snapToGrid: true,
      showMiniMap: true,
      autoSave: true,
    },
    meta: {
      createdAt: now(),
      updatedAt: now(),
    },
  }
}

export const createFunctionNode = (
  diagram: EditorDiagram,
  parentNode: DiagramNode | undefined,
  position: { x: number; y: number },
): DiagramNode => ({
  id: createId('node'),
  kind: 'function',
  diagramId: diagram.id,
  name: '',
  nodeNumber: getNextFunctionNumber(diagram, parentNode),
  position,
  width: FUNCTION_NODE_SIZE.width,
  height: FUNCTION_NODE_SIZE.height,
  childDiagramId: null,
  notes: '',
})

export const createBoundaryPortNode = (
  diagramId: string,
  role: ArrowType,
  position: { x: number; y: number },
): DiagramNode => ({
  id: createId('node'),
  kind: 'boundaryPort',
  diagramId,
  name: '',
  boundaryRole: role,
  position,
  width: BOUNDARY_NODE_SIZE.width,
  height: BOUNDARY_NODE_SIZE.height,
  notes: '',
})

export const createChildDiagram = (
  parentDiagramId: string,
  parentNode: DiagramNode,
): EditorDiagram => ({
  id: createId('diagram'),
  type: 'idef0',
  title: `Декомпозиция ${parentNode.nodeNumber ?? parentNode.name}`,
  nodeNumber: parentNode.nodeNumber ?? 'A0',
  parentDiagramId,
  parentNodeId: parentNode.id,
  isContext: false,
  nodes: [],
  arrows: [],
})
