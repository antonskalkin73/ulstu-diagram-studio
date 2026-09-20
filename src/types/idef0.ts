import type { Project } from './project'
export type ArrowType = 'input' | 'control' | 'output' | 'mechanism'

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  id: string
  severity: ValidationSeverity
  code: string
  message: string
  diagramId: string
  elementId?: string
  elementType?: 'diagram' | 'node' | 'arrow'
}

export interface EditorSettings {
  strictMode: boolean
  snapToGrid: boolean
  showMiniMap: boolean
  autoSave: boolean
}

export interface IDEF0Node {
  id: string
  kind: 'function' | 'boundaryPort'
  diagramId: string
  name: string
  nodeNumber?: string
  position: {
    x: number
    y: number
  }
  width: number
  height: number
  childDiagramId?: string | null
  boundaryRole?: ArrowType
  notes?: string
}

export interface IDEF0Arrow {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  arrowType: ArrowType
  label: string
  routeOffset?: number
}

export interface IDEF0Diagram {
  type: 'idef0'
  id: string
  title: string
  nodeNumber: string
  parentDiagramId: string | null
  parentNodeId: string | null
  isContext: boolean
  nodes: IDEF0Node[]
  arrows: IDEF0Arrow[]
}

export type IDEF0Project = Project<IDEF0Diagram>
