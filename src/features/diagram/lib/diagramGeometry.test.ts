import { describe, expect, it } from 'vitest'
import { createBoundaryPortNode, createEmptyProject, createFunctionNode } from '@/features/project/lib/projectFactory'
import { getBoundaryPoint, getDiagramFrame } from './diagramGeometry'
import { toFlowNodes } from './flowMappers'
import { buildDiagramSvg } from '@/features/export/lib/exportDiagram'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'

describe('IDEF0 boundary arrows', () => {
  it('projects old interface blocks to their corresponding sheet edges', () => {
    const diagram = createEmptyProject().diagrams[0]!
    const frame = getDiagramFrame(diagram)
    for (const role of ['input', 'control', 'output', 'mechanism'] as const) {
      const boundary = createBoundaryPortNode(diagram.id, role, { x: 200, y: 200 })
      boundary.width = 140; boundary.height = 56
      const point = getBoundaryPoint(boundary, frame)
      if (role === 'input') expect(point.x).toBe(frame.x)
      if (role === 'output') expect(point.x).toBe(frame.x + frame.width)
      if (role === 'control') expect(point.y).toBe(frame.y)
      if (role === 'mechanism') expect(point.y).toBe(frame.y + frame.height)
      diagram.nodes.push(boundary)
    }
    expect(toFlowNodes(diagram).filter(n => n.type === 'boundaryPort').every(n => n.width === 8 && n.height === 8)).toBe(true)
  })
  it('creates connected arrows atomically and removes their endpoints with undo support', () => {
    const store = () => useIdef0Store.getState()
    store().setProject(createEmptyProject())
    store().createContextFunction()
    const original = store().project
    for (const role of ['input', 'control', 'output', 'mechanism'] as const) store().addExternalArrow(role)
    const diagram = store().project.diagrams[0]!
    expect(diagram.arrows).toHaveLength(4)
    const fn = diagram.nodes.find(n => n.kind === 'function')!
    expect(fn.name).toBe('')
    expect(diagram.arrows.every(a => a.arrowType === 'output' ? a.source === fn.id : a.target === fn.id)).toBe(true)
    store().deleteSelection()
    expect(store().project.diagrams[0]!.nodes).toHaveLength(4)
    store().undo()
    expect(store().project.diagrams[0]!.arrows).toHaveLength(4)
    for (let i = 0; i < 4; i++) store().undo()
    expect(store().project).toBe(original)
  })
  it('exports a function rectangle without a sheet, oval blocks or placeholders', () => {
    const diagram = createEmptyProject().diagrams[0]!
    diagram.nodes.push(createFunctionNode(diagram, undefined, { x: 250, y: 180 }))
    diagram.nodes.push(createBoundaryPortNode(diagram.id, 'input', { x: 0, y: 200 }))
    const svg = buildDiagramSvg(diagram).svg
    expect(svg.match(/<rect /g)).toHaveLength(2) // background and function
    expect(svg).not.toContain('Новая функция')
    expect(svg).not.toContain('Название функции')
  })
})
