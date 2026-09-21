import { erTableSchema, erForeignKeySchema } from '@/features/er/schema'
import { erHandle, tableHeight, ER_WIDTH } from '@/features/er/model'
import { flowchartShapes, flowchartSides } from '@/types/flowchart'
import { z } from 'zod'
import type { EditorProject } from '@/types/diagram'
import { downloadTextFile } from '@/utils/idef0'

const id = z.string().min(1)
const role = z.enum(['input', 'control', 'output', 'mechanism'])
const nodeFields = z.object({
  id, diagramId: id, name: z.string(),
  nodeNumber: z.string().optional(), position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().positive(), height: z.number().positive(),
  childDiagramId: id.nullable().optional(), boundaryRole: role.optional(), notes: z.string().optional(),
})
const nodeSchema = z.discriminatedUnion('kind', [
  nodeFields.extend({ kind: z.literal('function'), shape: z.never().optional(), table: z.never().optional() }),
  nodeFields.extend({ kind: z.literal('boundaryPort'), shape: z.never().optional(), table: z.never().optional() }),
  nodeFields.extend({ kind: z.literal('flowchart'), shape: z.enum(Object.keys(flowchartShapes) as Array<keyof typeof flowchartShapes>), table: z.never().optional() }),
  nodeFields.extend({ kind: z.literal('erTable'), shape: z.never().optional(), table: erTableSchema }),
]).superRefine((node, ctx) => {
  if (node.kind === 'boundaryPort' && !node.boundaryRole) ctx.addIssue({ code: 'custom', message: 'Не указан тип интерфейса' })
})
const diagramSchema = z.object({
  id, type: z.enum(['idef0', 'flowchart', 'er']).default('idef0'), title: z.string(), nodeNumber: z.string(),
  parentDiagramId: id.nullable(), parentNodeId: id.nullable(), isContext: z.boolean(),
  nodes: z.array(nodeSchema), arrows: z.array(z.object({
    id, source: id, target: id, sourceHandle: id, targetHandle: id,
    arrowType: z.enum(['input', 'control', 'output', 'mechanism', 'sequence', 'relation']), foreignKey: erForeignKeySchema.optional(), label: z.string(), routeOffset: z.number().min(-1000).max(1000).optional(),
  })),
})
const projectSchema = z.object({
  id, name: z.string(), version: z.enum(['1.0.0', '2.0.0', '3.0.0', '4.0.0']), rootDiagramId: id,
  diagrams: z.array(diagramSchema).min(1),
  settings: z.object({ strictMode: z.boolean(), snapToGrid: z.boolean(), showMiniMap: z.boolean(), autoSave: z.boolean() }),
  meta: z.object({ createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }),
})

export const parseProjectJson = (content: string): EditorProject => {
  const result = projectSchema.safeParse(JSON.parse(content))
  if (!result.success) throw new Error('Некорректный формат проекта: ' + result.error.issues[0]?.message)
  const project = result.data
  const diagrams = new Map(project.diagrams.map(d => [d.id, d]))
  if (diagrams.size !== project.diagrams.length || !diagrams.has(project.rootDiagramId)) throw new Error('Повторяющиеся диаграммы или отсутствует корневая диаграмма')
  if (diagrams.get(project.rootDiagramId)?.parentDiagramId !== null) throw new Error('Корневая диаграмма не может иметь родителя')
  const ids = new Set<string>()
  for (const d of project.diagrams) {
    for (const element of [...d.nodes, ...d.arrows]) {
      if (ids.has(element.id)) throw new Error('Повторяющийся идентификатор элемента')
      ids.add(element.id)
    }
    if (d.type === 'er') {
      if (d.parentDiagramId || d.parentNodeId || d.isContext || d.nodes.some(n => n.kind !== 'erTable' || n.childDiagramId || n.boundaryRole)) throw new Error('Некорректная структура ER-диаграммы')
      for (const n of d.nodes) if (n.kind === 'erTable') {
        for (const item of [...n.table.columns, ...n.table.indexes, ...n.table.checks]) {
          if (ids.has(item.id)) throw new Error('Повторяющийся идентификатор элемента ERD')
          ids.add(item.id)
        }
        if (n.table.indexes.some(i => [...i.columns, ...i.include].some(id => !n.table.columns.some(c => c.id === id)))) throw new Error('Индекс ссылается на отсутствующую колонку')
        n.width = ER_WIDTH; n.height = tableHeight(n)
      }
      for (const a of d.arrows) {
        const from = d.nodes.find(n => n.id === a.source), to = d.nodes.find(n => n.id === a.target), fk = a.foreignKey
        if (a.arrowType !== 'relation' || from?.kind !== 'erTable' || to?.kind !== 'erTable' || !fk || fk.columns.length !== fk.referencedColumns.length || new Set(fk.columns).size !== fk.columns.length || new Set(fk.referencedColumns).size !== fk.referencedColumns.length || fk.columns.some(id => !from.table.columns.some(c => c.id === id)) || fk.referencedColumns.some(id => !to.table.columns.some(c => c.id === id))) throw new Error('Некорректные колонки внешнего ключа')
        if (!['left', 'right'].some(side => a.sourceHandle === erHandle(fk.columns[0]!, side)) || !['left', 'right'].some(side => a.targetHandle === erHandle(fk.referencedColumns[0]!, side))) throw new Error('Некорректное подключение внешнего ключа')
      }
    } else if (d.nodes.some(n => n.kind === 'erTable') || d.arrows.some(a => a.arrowType === 'relation' || a.foreignKey)) throw new Error('ER-элементы в другой нотации')
    if (d.type === 'flowchart') {
      if (d.parentDiagramId || d.parentNodeId || d.isContext) throw new Error('У блок-схемы не может быть декомпозиции IDEF0')
      if (d.nodes.some(n => n.kind !== 'flowchart' || !n.shape || n.childDiagramId || n.boundaryRole)) throw new Error('Некорректный блок блок-схемы')
      if (d.arrows.some(a => a.arrowType !== 'sequence' || !flowchartSides.some(side => side === a.sourceHandle) || !flowchartSides.some(side => side === a.targetHandle))) throw new Error('Некорректный переход блок-схемы')
    } else if (d.type === 'idef0' && (d.nodes.some(n => n.kind === 'flowchart' || n.shape) || d.arrows.some(a => a.arrowType === 'sequence'))) throw new Error('Элементы не соответствуют типу IDEF0')
    const nodes = new Map(d.nodes.map(n => [n.id, n]))
    for (const n of d.nodes) {
      if (n.kind === 'function' && n.name === 'Новая функция') n.name = ''
      if (n.diagramId !== d.id) throw new Error('Неверная принадлежность блока диаграмме')
      if (n.childDiagramId) {
        const child = diagrams.get(n.childDiagramId)
        if (n.kind !== 'function' || !child || child.type !== 'idef0' || child.parentDiagramId !== d.id || child.parentNodeId !== n.id) throw new Error('Неверная ссылка на декомпозицию')
      }
    }
    for (const a of d.arrows) if (!nodes.has(a.source) || !nodes.has(a.target)) throw new Error('Стрелка ссылается на отсутствующий блок')
    if (d.parentDiagramId) {
      const parent = diagrams.get(d.parentDiagramId)
      if (!parent || parent.nodes.find(n => n.id === d.parentNodeId)?.childDiagramId !== d.id) throw new Error('Неверная ссылка на родительский блок')
    } else if (d.parentNodeId !== null) throw new Error('У корневой диаграммы указан родительский блок')
    const visited = new Set<string>()
    let cursor: typeof d | undefined = d
    while (cursor) {
      if (visited.has(cursor.id)) throw new Error('Цикл в дереве декомпозиции')
      visited.add(cursor.id)
      cursor = cursor.parentDiagramId ? diagrams.get(cursor.parentDiagramId) : undefined
    }
  }
  return { ...project, version: '4.0.0' }
}

export const serializeProject = (project: EditorProject): string => JSON.stringify(project, null, 2)
export const downloadProjectJson = (project: EditorProject): void => {
  downloadTextFile(serializeProject(project), `${project.name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'project'}.json`, 'application/json')
}
