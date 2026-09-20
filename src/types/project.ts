import type { EditorSettings, IDEF0Diagram } from './idef0'

export type DiagramType = 'idef0' | 'flowchart' | 'er'

export interface DiagramIdentity {
  id: string
  title: string
  type: DiagramType
}

export interface Project<TDiagram extends DiagramIdentity = IDEF0Diagram> {
  id: string
  name: string
  version: string
  rootDiagramId: string
  diagrams: TDiagram[]
  settings: EditorSettings
  meta: { createdAt: string; updatedAt: string }
}

export const diagramCatalog = [
  { type: 'idef0', title: 'IDEF0', description: 'Функции системы и их декомпозиция', available: true },
  { type: 'flowchart', title: 'Блок-схема', description: 'Алгоритмы и последовательности действий', available: false },
  { type: 'er', title: 'ERD', description: 'Сущности, атрибуты и связи данных', available: false },
] as const
