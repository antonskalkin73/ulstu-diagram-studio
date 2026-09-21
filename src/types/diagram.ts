import type { ERTable, ERForeignKey } from './er'
import type { FlowchartShape } from './flowchart'
import type { Project } from './project'
import type { ArrowType } from './idef0'

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

interface DiagramNodeFields {
  id: string
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

export type DiagramNode = DiagramNodeFields & (
  | { kind: 'function' | 'boundaryPort'; shape?: never; table?: never }
  | { kind: 'flowchart'; shape: FlowchartShape; table?: never }
  | { kind: 'erTable'; table: ERTable; shape?: never }
)

export interface DiagramArrow {
  id: string
  source: string
  target: string
  sourceHandle: string
  targetHandle: string
  arrowType: ArrowType | 'sequence' | 'relation'
  foreignKey?: ERForeignKey
  label: string
  routeOffset?: number
}

export interface EditorDiagram {
  type: 'idef0' | 'flowchart' | 'er'
  id: string
  title: string
  nodeNumber: string
  parentDiagramId: string | null
  parentNodeId: string | null
  isContext: boolean
  nodes: DiagramNode[]
  arrows: DiagramArrow[]
}

export type EditorProject = Project<EditorDiagram>
