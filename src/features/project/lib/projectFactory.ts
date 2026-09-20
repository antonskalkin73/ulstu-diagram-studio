import {
  BOUNDARY_NODE_SIZE,
  FUNCTION_NODE_SIZE,
} from '@/entities/idef0/constants'
import type { ArrowType, IDEF0Diagram, IDEF0Node, IDEF0Project } from '@/types/idef0'
import { createId } from '@/utils/id'
import { getNextFunctionNumber } from '@/utils/idef0'

const now = (): string => new Date().toISOString()

export const createEmptyProject = (): IDEF0Project => {
  const rootDiagramId = createId('diagram')

  return {
    id: createId('project'),
    name: 'Новый проект',
    version: '2.0.0',
    rootDiagramId,
    diagrams: [
      {
        id: rootDiagramId,
        type: 'idef0',
        title: 'Контекстная диаграмма',
        nodeNumber: 'A-0',
        parentDiagramId: null,
        parentNodeId: null,
        isContext: true,
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
  diagram: IDEF0Diagram,
  parentNode: IDEF0Node | undefined,
  position: { x: number; y: number },
): IDEF0Node => ({
  id: createId('node'),
  kind: 'function',
  diagramId: diagram.id,
  name: 'Новая функция',
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
): IDEF0Node => ({
  id: createId('node'),
  kind: 'boundaryPort',
  diagramId,
  name:
    role === 'input'
      ? 'Внешний Input'
      : role === 'control'
        ? 'Внешний Control'
        : role === 'mechanism'
          ? 'Внешний Mechanism'
          : 'Внешний Output',
  boundaryRole: role,
  position,
  width: BOUNDARY_NODE_SIZE.width,
  height: BOUNDARY_NODE_SIZE.height,
  notes: '',
})

export const createChildDiagram = (
  parentDiagramId: string,
  parentNode: IDEF0Node,
): IDEF0Diagram => ({
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
