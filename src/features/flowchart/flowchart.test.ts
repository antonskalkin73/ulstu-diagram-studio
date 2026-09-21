import { beforeEach, expect, it } from 'vitest'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { createEmptyProject } from '@/features/project/lib/projectFactory'
import { parseProjectJson, serializeProject } from '@/features/project/lib/projectFile'
import { buildDiagramSvg } from '@/features/export/lib/exportDiagram'
import { validateFlowchart } from './validateFlowchart'

const store = () => useIdef0Store.getState()
const diagram = () => store().project.diagrams.find(d => d.id === store().currentDiagramId)!
beforeEach(() => { store().setProject(createEmptyProject('flowchart')) })

it('keeps mixed projects, undo and clipboard isolated by notation', () => {
  store().addFlowchartNode('process', { x: 0, y: 0 })
  const flowId = diagram().id
  store().updateNode(diagram().nodes[0]!.id, { name: 'Шаг' })
  store().duplicateSelection()
  expect(diagram().nodes.map(n => n.name)).toEqual(['Шаг', 'Шаг'])
  store().undo()
  expect(diagram().nodes).toHaveLength(1)
  store().redo()
  expect(diagram().nodes).toHaveLength(2)
  store().addDiagram('idef0')
  store().pasteSelection()
  expect(diagram().nodes).toHaveLength(0)
  store().createContextFunction()
  store().navigateToDiagram(flowId)
  store().addFunctionNode({ x: 0, y: 0 })
  expect(diagram().nodes.every(n => n.kind === 'flowchart')).toBe(true)
  expect(parseProjectJson(serializeProject(store().project))).toEqual(store().project)
})

it('supports labeled branches and cycles, rejects invalid endpoints, and undoes connected deletion', () => {
  for (const [i, shape] of (['start', 'decision', 'process', 'end'] as const).entries()) store().addFlowchartNode(shape, { x: 0, y: i * 200 })
  const [start, decision, process, end] = diagram().nodes
  const connect = (source: string, target: string) => store().connectArrow({ source, target, sourceHandle: 'bottom', targetHandle: 'top' })
  expect(connect(start!.id, decision!.id).ok).toBe(true)
  expect(connect(decision!.id, process!.id).ok).toBe(true)
  store().updateArrow(diagram().arrows.at(-1)!.id, { label: 'Да' })
  expect(connect(decision!.id, end!.id).ok).toBe(true)
  store().updateArrow(diagram().arrows.at(-1)!.id, { label: 'Нет' })
  expect(connect(process!.id, decision!.id).ok).toBe(true)
  expect(connect(end!.id, start!.id).ok).toBe(false)
  expect(connect(process!.id, process!.id).ok).toBe(false)
  expect(connect(start!.id, decision!.id).ok).toBe(false)
  expect(validateFlowchart(diagram()).some(i => ['flowchart-branches', 'flowchart-unreachable', 'flowchart-branch-label'].includes(i.code))).toBe(false)
  store().setSelection({ nodeIds: [decision!.id], arrowIds: [] })
  store().deleteSelection()
  expect(diagram().arrows).toHaveLength(0)
  store().undo()
  expect(diagram().arrows).toHaveLength(4)
})

it('validates imported notation and exports real flowchart outlines and escaped text', () => {
  store().addFlowchartNode('decision', { x: -200, y: -100 })
  store().updateNode(diagram().nodes[0]!.id, { name: 'x < 5 & y > 2' })
  const svg = buildDiagramSvg(diagram()).svg
  expect(svg).toContain('M 110 0 L 220 70 L 110 140 L 0 70 Z')
  expect(svg).toContain('&lt;')
  expect(svg).toContain('&amp;')
  expect(svg).not.toContain('A-0')
  const invalid = JSON.parse(serializeProject(store().project))
  delete invalid.diagrams[0].nodes[0].shape
  expect(() => parseProjectJson(JSON.stringify(invalid))).toThrow()
  invalid.diagrams[0].nodes[0].shape = 'decision'
  invalid.diagrams[0].type = 'idef0'
  expect(() => parseProjectJson(JSON.stringify(invalid))).toThrow()
})
