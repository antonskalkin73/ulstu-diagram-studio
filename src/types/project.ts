import type { EditorSettings, EditorDiagram } from './diagram'

export type DiagramType = 'idef0' | 'flowchart' | 'er'

export interface DiagramIdentity {
  id: string
  title: string
  type: DiagramType
}

export interface Project<TDiagram extends DiagramIdentity = EditorDiagram> {
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
  { type: 'flowchart', title: 'Блок-схема', description: 'Алгоритмы и последовательности действий', available: true },
  { type: 'er', title: 'ERD', description: 'Сущности, атрибуты и связи данных', available: false },
] as const
