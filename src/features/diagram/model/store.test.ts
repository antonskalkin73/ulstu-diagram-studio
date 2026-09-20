import { beforeEach, expect, it } from 'vitest'
import { useIdef0Store } from './useIdef0Store'
import { createEmptyProject } from '@/features/project/lib/projectFactory'
import { parseProjectJson, serializeProject } from '@/features/project/lib/projectFile'
const store = () => useIdef0Store.getState()
beforeEach(() => store().setProject(createEmptyProject()))
it('retains immutable history and treats a movement as one operation', () => {
  store().createContextFunction()
  const before = store().project
  const node = before.diagrams[0]!.nodes[0]!
  store().updateNodePositions([{ id: node.id, x: 500, y: 300 }])
  expect(before.diagrams[0]!.nodes[0]!.position).toEqual({ x: 240, y: 180 })
  store().undo()
  expect(store().project).toBe(before)
  store().redo()
  expect(store().project.diagrams[0]!.nodes[0]!.position).toEqual({ x: 500, y: 300 })
  const count = store().past.length
  store().updateNodePositions([{ id: node.id, x: 500, y: 300 }])
  expect(store().past).toHaveLength(count)
})
it('does not add navigation to undo history and preserves unchanged diagrams', () => {
  store().createContextFunction()
  const nodeId = store().project.diagrams[0]!.nodes[0]!.id
  store().openDecomposition(nodeId)
  const root = store().project.diagrams[0]
  store().addFunctionNode({ x: 0, y: 0 })
  expect(store().project.diagrams[0]).toBe(root)
  store().navigateToDiagram(store().project.rootDiagramId)
  const count = store().past.length
  store().openDecomposition(nodeId)
  expect(store().past).toHaveLength(count)
})
it('deletes a mixed selection atomically and restores it on undo', () => {
  store().createContextFunction()
  store().addBoundaryNode('input', { x: 0, y: 0 })
  const diagram = store().project.diagrams[0]!
  store().setSelection({ nodeIds: diagram.nodes.map(n => n.id), arrowIds: [] })
  const before = store().project
  const count = store().past.length
  store().deleteSelection()
  expect(store().project.diagrams[0]!.nodes).toHaveLength(0)
  expect(store().past).toHaveLength(count + 1)
  store().undo()
  expect(store().project).toBe(before)
})
it('supports multiple roots and safe deletion of decomposition trees', () => {
  store().addDiagram()
  const second = store().currentDiagramId
  store().createContextFunction()
  store().openDecomposition(store().project.diagrams.find(d => d.id === second)!.nodes[0]!.id)
  store().deleteDiagram(second)
  expect(store().project.diagrams).toHaveLength(1)
  expect(store().currentDiagramId).toBe(store().project.rootDiagramId)
  store().undo()
  expect(store().project.diagrams).toHaveLength(3)
  expect(() => parseProjectJson(serializeProject(store().project))).not.toThrow()
})

it('copies blocks and their internal connections across diagrams with fresh IDs', () => {
  store().createContextFunction()
  store().addBoundaryNode('input', { x: 0, y: 0 })
  const original = store().project.diagrams[0]!
  const fn = original.nodes.find(n => n.kind === 'function')!
  const port = original.nodes.find(n => n.kind === 'boundaryPort')!
  store().connectArrow({ source: port.id, target: fn.id, sourceHandle: 'source-output', targetHandle: 'target-input' })
  store().setSelection({ nodeIds: [fn.id, port.id], arrowIds: [] })
  store().copySelection()
  store().addDiagram()
  store().pasteSelection()
  const copied = store().project.diagrams[1]!
  expect(copied.nodes).toHaveLength(2)
  expect(copied.arrows).toHaveLength(1)
  expect(copied.nodes.every(n => n.diagramId === copied.id && ![fn.id, port.id].includes(n.id))).toBe(true)
  expect(() => parseProjectJson(serializeProject(store().project))).not.toThrow()
  store().undo()
  expect(store().project.diagrams[1]!.nodes).toHaveLength(0)
})
