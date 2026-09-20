import { z } from 'zod'
import type { IDEF0Project } from '@/types/idef0'
import { downloadTextFile } from '@/utils/idef0'

const id = z.string().min(1)
const role = z.enum(['input', 'control', 'output', 'mechanism'])
const nodeSchema = z.object({
  id, kind: z.enum(['function', 'boundaryPort']), diagramId: id, name: z.string(),
  nodeNumber: z.string().optional(), position: z.object({ x: z.number(), y: z.number() }),
  width: z.number().positive(), height: z.number().positive(),
  childDiagramId: id.nullable().optional(), boundaryRole: role.optional(), notes: z.string().optional(),
}).superRefine((node, ctx) => {
  if (node.kind === 'boundaryPort' && !node.boundaryRole) ctx.addIssue({ code: 'custom', message: 'Не указан тип интерфейса' })
})
const diagramSchema = z.object({
  id, type: z.literal('idef0').default('idef0'), title: z.string(), nodeNumber: z.string(),
  parentDiagramId: id.nullable(), parentNodeId: id.nullable(), isContext: z.boolean(),
  nodes: z.array(nodeSchema), arrows: z.array(z.object({
    id, source: id, target: id, sourceHandle: id, targetHandle: id,
    arrowType: role, label: z.string(), routeOffset: z.number().min(-1000).max(1000).optional(),
  })),
})
const projectSchema = z.object({
  id, name: z.string(), version: z.enum(['1.0.0', '2.0.0']), rootDiagramId: id,
  diagrams: z.array(diagramSchema).min(1),
  settings: z.object({ strictMode: z.boolean(), snapToGrid: z.boolean(), showMiniMap: z.boolean(), autoSave: z.boolean() }),
  meta: z.object({ createdAt: z.iso.datetime(), updatedAt: z.iso.datetime() }),
})

export const parseProjectJson = (content: string): IDEF0Project => {
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
    const nodes = new Map(d.nodes.map(n => [n.id, n]))
    for (const n of d.nodes) {
      if (n.diagramId !== d.id) throw new Error('Неверная принадлежность блока диаграмме')
      if (n.childDiagramId) {
        const child = diagrams.get(n.childDiagramId)
        if (n.kind !== 'function' || !child || child.parentDiagramId !== d.id || child.parentNodeId !== n.id) throw new Error('Неверная ссылка на декомпозицию')
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
  return { ...project, version: '2.0.0' }
}

export const serializeProject = (project: IDEF0Project): string => JSON.stringify(project, null, 2)
export const downloadProjectJson = (project: IDEF0Project): void => {
  downloadTextFile(serializeProject(project), `${project.name.replace(/[<>:"/\\|?*]/g, '-').trim() || 'project'}.json`, 'application/json')
}
