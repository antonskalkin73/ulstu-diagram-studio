import { flowchartShapes, flowchartSides, type FlowchartShape } from '@/types/flowchart'
import { getDiagramFrame, getExternalArrowFunction } from '@/features/diagram/lib/diagramGeometry'
import { produce } from 'immer'
import { create } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import type { Connection } from '@xyflow/react'
import { BOUNDARY_HANDLES, FUNCTION_HANDLES } from '@/entities/idef0/constants'
import { createBoundaryPortNode, createChildDiagram, createEmptyProject, createFunctionNode } from '@/features/project/lib/projectFactory'
import type { ArrowType } from '@/types/idef0'
import type { DiagramNode, DiagramArrow, EditorProject, ValidationIssue } from '@/types/diagram'
import { validateProject } from '@/features/validation/lib/validateProject'
import { createId } from '@/utils/id'
import {
  collectChildDiagramIds,
  getArrowTypeFromHandles,
  getDiagramById,
  getDiagramPath,
  getNodeById,
  isArrowSemanticallyValid,
} from '@/utils/idef0'

interface HistoryEntry {
  project: EditorProject
  currentDiagramId: string
}

interface SelectionState {
  nodeIds: string[]
  arrowIds: string[]
}

interface SelectedElement {
  kind: 'diagram' | 'node' | 'arrow'
  id: string
}

interface ContextMenuState {
  x: number
  y: number
  flowX: number
  flowY: number
  kind: 'pane' | 'node' | 'arrow'
  targetId?: string
}

interface DraftState {
  project: EditorProject
  currentDiagramId: string
  selection: SelectionState
  selectedElement: SelectedElement | null
}

interface Idef0Store {
  project: EditorProject
  currentDiagramId: string
  issues: ValidationIssue[]
  selection: SelectionState
  selectedElement: SelectedElement | null
  contextMenu: ContextMenuState | null
  past: HistoryEntry[]
  future: HistoryEntry[]
  addDiagram: (type?: 'idef0' | 'flowchart') => void
  addFlowchartNode: (shape: FlowchartShape, position: { x: number; y: number }) => void
  setFlowchartShape: (id: string, shape: FlowchartShape) => void
  deleteDiagram: (id: string) => void
  clipboard: { type: 'idef0' | 'flowchart'; nodes: DiagramNode[]; arrows: DiagramArrow[] } | null
  copySelection: () => void
  pasteSelection: () => void
  duplicateSelection: () => void
  alignSelection: (axis: 'x' | 'y') => void
  setProject: (project: EditorProject) => void
  newProject: () => void
  setProjectName: (name: string) => void
  updateDiagramTitle: (title: string) => void
  navigateToDiagram: (diagramId: string) => void
  createContextFunction: (position?: { x: number; y: number }) => void
  addFunctionNode: (position: { x: number; y: number }) => void
  addExternalArrow: (role: ArrowType, functionId?: string, point?: { x: number; y: number }) => void
  addBoundaryNode: (role: ArrowType, position: { x: number; y: number }) => void
  updateNode: (nodeId: string, patch: Partial<{ name: string; notes: string }>) => void
  updateArrow: (arrowId: string, patch: Partial<{ label: string; routeOffset: number }>) => void
  removeElement: (kind: 'node' | 'arrow', id: string) => void
  deleteSelection: () => void
  updateNodePositions: (positions: Array<{ id: string; x: number; y: number }>) => void
  connectArrow: (connection: Connection) => { ok: boolean; message?: string }
  openDecomposition: (nodeId: string) => void
  setSelection: (selection: SelectionState) => void
  setContextMenu: (menu: ContextMenuState | null) => void
  toggleStrictMode: () => void
  toggleSnapToGrid: () => void
  toggleMiniMap: () => void
  undo: () => void
  redo: () => void
}

const buildIssues = (project: EditorProject): ValidationIssue[] => validateProject(project)

const initialProject = createEmptyProject()

const applyMutation = (
  state: Idef0Store,
  mutator: (draft: DraftState) => void,
): Partial<Idef0Store> => {
  const before: DraftState = { project: state.project, currentDiagramId: state.currentDiagramId, selection: state.selection, selectedElement: state.selectedElement }
  const draft = produce(before, draft => {
    mutator(draft)
    for (const diagram of draft.project.diagrams) {
      const previous = state.project.diagrams.find(d => d.id === diagram.id)
      if (!previous || previous.arrows === diagram.arrows) continue
      const obsolete = diagram.nodes.filter(n => n.kind === 'boundaryPort'
        && previous.arrows.some(a => a.source === n.id || a.target === n.id)
        && !diagram.arrows.some(a => a.source === n.id || a.target === n.id)).map(n => n.id)
      if (obsolete.length) diagram.nodes = diagram.nodes.filter(n => !obsolete.includes(n.id))
    }
  })
  if (draft === before) return {}
  const changed = draft.project !== state.project
  const project = changed ? produce(draft.project, p => { p.meta.updatedAt = new Date().toISOString() }) : state.project
  return {
    ...draft, project,
    issues: changed ? buildIssues(project) : state.issues,
    contextMenu: null,
    past: changed ? [...state.past, { project: state.project, currentDiagramId: state.currentDiagramId }].slice(-100) : state.past,
    future: changed ? [] : state.future,
  }
}

export const useIdef0Store = create<Idef0Store>((set, get) => ({
  clipboard: null,
  project: initialProject,
  currentDiagramId: initialProject.rootDiagramId,
  issues: buildIssues(initialProject),
  selection: { nodeIds: [], arrowIds: [] },
  selectedElement: { kind: 'diagram', id: initialProject.rootDiagramId },
  contextMenu: null,
  past: [],
  future: [],
  addDiagram: (type = 'idef0') => set(state => applyMutation(state, draft => {
    const diagram = createEmptyProject(type).diagrams[0]!
    diagram.title = `${type === 'flowchart' ? 'Блок-схема' : 'Новая модель'} ${draft.project.diagrams.filter(d => !d.parentDiagramId).length + 1}`
    draft.project.diagrams.push(diagram)
    draft.currentDiagramId = diagram.id
    draft.selection = { nodeIds: [], arrowIds: [] }
    draft.selectedElement = { kind: 'diagram', id: diagram.id }
  })),
  addFlowchartNode: (shape, position) => set(state => applyMutation(state, draft => {
    const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
    if (diagram?.type !== 'flowchart') return
    const size = flowchartShapes[shape]
    const node: DiagramNode = { id: createId('node'), kind: 'flowchart', shape, diagramId: diagram.id, name: '', position, width: size.width, height: size.height }
    diagram.nodes.push(node)
    draft.selection = { nodeIds: [node.id], arrowIds: [] }
    draft.selectedElement = { kind: 'node', id: node.id }
  })),
  setFlowchartShape: (id, shape) => set(state => applyMutation(state, draft => {
    const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
    const node = diagram?.nodes.find(n => n.id === id)
    if (diagram?.type !== 'flowchart' || node?.kind !== 'flowchart') return
    node.shape = shape
    node.width = flowchartShapes[shape].width
    node.height = flowchartShapes[shape].height
  })),
  deleteDiagram: (id) => set(state => applyMutation(state, draft => {
    if (id === draft.project.rootDiagramId) return
    const removed = new Set(collectChildDiagramIds(draft.project.diagrams, id))
    draft.project.diagrams = draft.project.diagrams.filter(d => !removed.has(d.id))
    for (const d of draft.project.diagrams) for (const n of d.nodes) if (n.childDiagramId && removed.has(n.childDiagramId)) n.childDiagramId = null
    if (removed.has(draft.currentDiagramId)) draft.currentDiagramId = draft.project.rootDiagramId
    draft.selection = { nodeIds: [], arrowIds: [] }
    draft.selectedElement = { kind: 'diagram', id: draft.currentDiagramId }
  })),
  copySelection: () => {
    const state = get()
    const d = getDiagramById(state.project.diagrams, state.currentDiagramId)
    if (!d) return
    const nodes = d.nodes.filter(n => state.selection.nodeIds.includes(n.id))
    if (!nodes.length) return
    set({ clipboard: structuredClone({ type: d.type, nodes, arrows: d.arrows.filter(a => nodes.some(n => n.id === a.source) && nodes.some(n => n.id === a.target)) }) })
  },
  pasteSelection: () => set(state => applyMutation(state, draft => {
    const d = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
    if (!d || !state.clipboard || state.clipboard.type !== d.type) return
    const mapping = new Map<string, string>()
    for (const n of state.clipboard.nodes) {
      if (d.isContext && n.kind === 'function' && d.nodes.some(node => node.kind === 'function')) continue
      const copy = { ...n, id: createId('node'), diagramId: d.id, position: { x: n.position.x + 40, y: n.position.y + 40 }, childDiagramId: null }
      if (n.kind === 'function') copy.nodeNumber = createFunctionNode(d, undefined, copy.position).nodeNumber
      mapping.set(n.id, copy.id)
      d.nodes.push(copy)
    }
    for (const a of state.clipboard.arrows) if (mapping.has(a.source) && mapping.has(a.target)) d.arrows.push({ ...a, id: createId('arrow'), source: mapping.get(a.source)!, target: mapping.get(a.target)! })
    if (!mapping.size) return
    draft.selection = { nodeIds: [...mapping.values()], arrowIds: [] }
    draft.selectedElement = { kind: 'node', id: [...mapping.values()][0]! }
  })),
  duplicateSelection: () => { if (!get().selection.nodeIds.length) return; get().copySelection(); get().pasteSelection() },
  alignSelection: (axis) => {
    const state = get()
    const nodes = getDiagramById(state.project.diagrams, state.currentDiagramId)?.nodes.filter(n => state.selection.nodeIds.includes(n.id)) ?? []
    if (nodes.length < 2) return
    const value = Math.min(...nodes.map(n => n.position[axis]))
    state.updateNodePositions(nodes.map(n => ({ id: n.id, ...n.position, [axis]: value })))
  },
  setProject: (project) => {
    set({
      project,
      currentDiagramId: project.rootDiagramId,
      issues: buildIssues(project),
      selection: { nodeIds: [], arrowIds: [] },
      selectedElement: { kind: 'diagram', id: project.rootDiagramId },
      contextMenu: null,
      past: [],
      future: [],
    })
  },
  newProject: () => {
    const project = createEmptyProject()
    set({
      project,
      currentDiagramId: project.rootDiagramId,
      issues: buildIssues(project),
      selection: { nodeIds: [], arrowIds: [] },
      selectedElement: { kind: 'diagram', id: project.rootDiagramId },
      contextMenu: null,
      past: [],
      future: [],
    })
  },
  setProjectName: (name) => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.project.name = name
      }),
    )
  },
  updateDiagramTitle: (title) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (diagram) {
          diagram.title = title
        }
      }),
    )
  },
  navigateToDiagram: (diagramId) => {
    const diagram = getDiagramById(get().project.diagrams, diagramId)
    if (!diagram) {
      return
    }

    set({
      currentDiagramId: diagramId,
      selectedElement: { kind: 'diagram', id: diagramId },
      selection: { nodeIds: [], arrowIds: [] },
      contextMenu: null,
    })
  },
  createContextFunction: (position = { x: 240, y: 180 }) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (!diagram || diagram.type !== 'idef0' || diagram.nodes.some((node) => node.kind === 'function')) {
          return
        }

        diagram.nodes.push(createFunctionNode(diagram, undefined, position))
      }),
    )
  },
  addFunctionNode: (position) => {
    const active = getDiagramById(get().project.diagrams, get().currentDiagramId)
    if (active?.isContext && active.nodes.some(n => n.kind === 'function')) return
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (!diagram || diagram.type !== 'idef0') {
          return
        }

        const parentNode = diagram.parentNodeId ? getNodeById(getDiagramById(draft.project.diagrams, diagram.parentDiagramId ?? '') ?? diagram, diagram.parentNodeId) : undefined
        const node = createFunctionNode(diagram, parentNode, position)
        diagram.nodes.push(node)
        draft.selectedElement = { kind: 'node', id: node.id }
        draft.selection = { nodeIds: [node.id], arrowIds: [] }
      }),
    )
  },
  addExternalArrow: (role, functionId, boundaryPoint) => set(state => applyMutation(state, draft => {
    const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
    if (!diagram || diagram.type !== 'idef0') return
    const fn = functionId ? diagram.nodes.find(n => n.id === functionId && n.kind === 'function') : getExternalArrowFunction(diagram, draft.selection)
    if (!fn) return
    const frame = getDiagramFrame(diagram)
    const count = diagram.arrows.filter(a => a.arrowType === role && (a.source === fn.id || a.target === fn.id)).length
    const x = fn.position.x + fn.width / 2 + count * 40
    const y = fn.position.y + fn.height / 2 + count * 40
    const point = boundaryPoint ?? (role === 'input' ? { x: frame.x, y } : role === 'output' ? { x: frame.x + frame.width, y }
      : role === 'control' ? { x, y: frame.y } : { x, y: frame.y + frame.height })
    const boundary = createBoundaryPortNode(diagram.id, role, { x: point.x - 4, y: point.y - 4 })
    diagram.nodes.push(boundary)
    const arrow = {
      id: createId('arrow'), arrowType: role, label: '',
      source: role === 'output' ? fn.id : boundary.id,
      target: role === 'output' ? boundary.id : fn.id,
      sourceHandle: role === 'output' ? FUNCTION_HANDLES.outputSource : BOUNDARY_HANDLES.sourceOutput,
      targetHandle: role === 'output' ? BOUNDARY_HANDLES.outputTarget : role === 'input' ? FUNCTION_HANDLES.inputTarget
        : role === 'control' ? FUNCTION_HANDLES.controlTarget : FUNCTION_HANDLES.mechanismTarget,
    }
    diagram.arrows.push(arrow)
    draft.selection = { nodeIds: [], arrowIds: [arrow.id] }
    draft.selectedElement = { kind: 'arrow', id: arrow.id }
  })),
  addBoundaryNode: (role, position) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (!diagram || diagram.type !== 'idef0') {
          return
        }

        const node = createBoundaryPortNode(diagram.id, role, position)
        diagram.nodes.push(node)
        draft.selectedElement = { kind: 'node', id: node.id }
        draft.selection = { nodeIds: [node.id], arrowIds: [] }
      }),
    )
  },
  updateNode: (nodeId, patch) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        const node = diagram ? getNodeById(diagram, nodeId) : undefined
        if (!node) {
          return
        }

        if (typeof patch.name === 'string') {
          node.name = patch.name
        }

        if (typeof patch.notes === 'string') {
          node.notes = patch.notes
        }
      }),
    )
  },
  updateArrow: (arrowId, patch) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        const arrow = diagram?.arrows.find((item) => item.id === arrowId)
        if (!arrow) {
          return
        }

        if (typeof patch.routeOffset === 'number') arrow.routeOffset = patch.routeOffset
        if (typeof patch.label === 'string') {
          for (const node of diagram!.nodes) {
            if (node.kind === 'boundaryPort' && (node.id === arrow.source || node.id === arrow.target)) node.name = ''
          }
          arrow.label = patch.label
        }
      }),
    )
  },
  removeElement: (kind, id) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (!diagram) {
          return
        }

        if (kind === 'arrow') {
          diagram.arrows = diagram.arrows.filter((arrow) => arrow.id !== id)
        } else {
          const node = getNodeById(diagram, id)
          diagram.nodes = diagram.nodes.filter((item) => item.id !== id)
          diagram.arrows = diagram.arrows.filter((arrow) => arrow.source !== id && arrow.target !== id)

          if (node?.childDiagramId) {
            const removeIds = new Set(collectChildDiagramIds(draft.project.diagrams, node.childDiagramId))
            draft.project.diagrams = draft.project.diagrams.filter((item) => !removeIds.has(item.id))
          }
        }

        draft.selection = { nodeIds: [], arrowIds: [] }
        draft.selectedElement = { kind: 'diagram', id: draft.currentDiagramId }
      }),
    )
  },
  deleteSelection: () => {
    if (!get().selection.nodeIds.length && !get().selection.arrowIds.length) return
    set(state => applyMutation(state, draft => {
      const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
      if (!diagram) return
      const selected = new Set(state.selection.nodeIds)
      const removed = new Set<string>()
      diagram.nodes.filter(n => selected.has(n.id)).forEach(n => {
        if (n.childDiagramId) collectChildDiagramIds(draft.project.diagrams, n.childDiagramId).forEach(id => removed.add(id))
      })
      diagram.nodes = diagram.nodes.filter(n => !selected.has(n.id))
      diagram.arrows = diagram.arrows.filter(a => !selected.has(a.source) && !selected.has(a.target) && !state.selection.arrowIds.includes(a.id))
      draft.project.diagrams = draft.project.diagrams.filter(d => !removed.has(d.id))
      draft.selection = { nodeIds: [], arrowIds: [] }
      draft.selectedElement = { kind: 'diagram', id: draft.currentDiagramId }
    }))
  },
  updateNodePositions: (positions) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const diagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (!diagram || positions.length === 0) {
          return
        }

        positions.forEach(({ id, x, y }) => {
          const node = getNodeById(diagram, id)
          if (node) {
            if (node.position.x !== x || node.position.y !== y) node.position = { x, y }
          }
        })
      }),
    )
  },
  connectArrow: (connection) => {
    const state = get()
    const diagram = getDiagramById(state.project.diagrams, state.currentDiagramId)
    if (!diagram || !connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) {
      return { ok: false, message: 'Не удалось определить соединение.' }
    }

    const source = getNodeById(diagram, connection.source)
    const target = getNodeById(diagram, connection.target)
    if (!source || !target || source.id === target.id) {
      return { ok: false, message: 'Нельзя соединить элемент сам с собой.' }
    }

    if (diagram.type === 'flowchart') {
      if (!flowchartSides.some(side => side === connection.sourceHandle) || !flowchartSides.some(side => side === connection.targetHandle)) return { ok: false, message: 'Выберите точку на стороне блока.' }
      if (source.shape === 'end' || target.shape === 'start') return { ok: false, message: 'В «Начало» нельзя входить, а из «Конец» нельзя выходить.' }
      if (diagram.arrows.some(a => a.source === source.id && a.target === target.id && a.sourceHandle === connection.sourceHandle && a.targetHandle === connection.targetHandle)) return { ok: false, message: 'Такой переход уже существует.' }
      set(current => applyMutation(current, draft => {
        const active = getDiagramById(draft.project.diagrams, draft.currentDiagramId)!
        const arrow: DiagramArrow = { id: createId('arrow'), source: source.id, target: target.id, sourceHandle: connection.sourceHandle!, targetHandle: connection.targetHandle!, arrowType: 'sequence', label: '' }
        active.arrows.push(arrow)
        draft.selection = { nodeIds: [], arrowIds: [arrow.id] }
        draft.selectedElement = { kind: 'arrow', id: arrow.id }
      }))
      return { ok: true }
    }

    const arrowType = getArrowTypeFromHandles(source, target, connection.sourceHandle, connection.targetHandle)
    if (!arrowType) {
      return { ok: false, message: 'Не удалось определить тип стрелки.' }
    }

    if (
      state.project.settings.strictMode &&
      !isArrowSemanticallyValid(source, target, arrowType, connection.sourceHandle, connection.targetHandle)
    ) {
      return { ok: false, message: 'Строгий режим запрещает такое подключение.' }
    }

    set((currentState) =>
      applyMutation(currentState, (draft) => {
        const currentDiagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        if (!currentDiagram) {
          return
        }

        currentDiagram.arrows.push({
          id: createId('arrow'),
          source: connection.source,
          target: connection.target,
          sourceHandle: connection.sourceHandle ?? FUNCTION_HANDLES.outputSource,
          targetHandle: connection.targetHandle ?? BOUNDARY_HANDLES.outputTarget,
          arrowType,
          label: '',
        })
      }),
    )

    return { ok: true }
  },
  openDecomposition: (nodeId) => {
    set((state) =>
      applyMutation(state, (draft) => {
        const currentDiagram = getDiagramById(draft.project.diagrams, draft.currentDiagramId)
        const node = currentDiagram ? getNodeById(currentDiagram, nodeId) : undefined
        if (!currentDiagram || currentDiagram.type !== 'idef0' || !node || node.kind !== 'function') {
          return
        }

        if (!node.childDiagramId) {
          const childDiagram = createChildDiagram(currentDiagram.id, node)
          node.childDiagramId = childDiagram.id
          draft.project.diagrams.push(childDiagram)
        }

        draft.currentDiagramId = node.childDiagramId
        draft.selectedElement = { kind: 'diagram', id: node.childDiagramId }
        draft.selection = { nodeIds: [], arrowIds: [] }
      }),
    )
  },
  setSelection: (selection) => {
    const previous = get().selection
    if (previous.nodeIds.join('|') === selection.nodeIds.join('|') && previous.arrowIds.join('|') === selection.arrowIds.join('|')) return
    const currentDiagramId = get().currentDiagramId
    const selectedElement = selection.nodeIds[0]
      ? { kind: 'node' as const, id: selection.nodeIds[0] }
      : selection.arrowIds[0]
        ? { kind: 'arrow' as const, id: selection.arrowIds[0] }
        : { kind: 'diagram' as const, id: currentDiagramId }

    set({ selection, selectedElement })
  },
  setContextMenu: (contextMenu) => set({ contextMenu }),
  toggleStrictMode: () => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.project.settings.strictMode = !draft.project.settings.strictMode
      }),
    )
  },
  toggleSnapToGrid: () => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.project.settings.snapToGrid = !draft.project.settings.snapToGrid
      }),
    )
  },
  toggleMiniMap: () => {
    set((state) =>
      applyMutation(state, (draft) => {
        draft.project.settings.showMiniMap = !draft.project.settings.showMiniMap
      }),
    )
  },
  undo: () => {
    const state = get()
    const previous = state.past.at(-1)
    if (!previous) {
      return
    }

    const current: HistoryEntry = {
      project: state.project,
      currentDiagramId: state.currentDiagramId,
    }

    set({
      project: previous.project,
      currentDiagramId: previous.currentDiagramId,
      issues: buildIssues(previous.project),
      selection: { nodeIds: [], arrowIds: [] },
      selectedElement: { kind: 'diagram', id: previous.currentDiagramId },
      contextMenu: null,
      past: state.past.slice(0, -1),
      future: [current, ...state.future].slice(0, 100),
    })
  },
  redo: () => {
    const state = get()
    const next = state.future[0]
    if (!next) {
      return
    }

    const current: HistoryEntry = {
      project: state.project,
      currentDiagramId: state.currentDiagramId,
    }

    set({
      project: next.project,
      currentDiagramId: next.currentDiagramId,
      issues: buildIssues(next.project),
      selection: { nodeIds: [], arrowIds: [] },
      selectedElement: { kind: 'diagram', id: next.currentDiagramId },
      contextMenu: null,
      past: [...state.past, current].slice(-100),
      future: state.future.slice(1),
    })
  },
}))

export const useCurrentDiagram = () =>
  useIdef0Store((state) => getDiagramById(state.project.diagrams, state.currentDiagramId))

export const useCurrentPath = () =>
  useIdef0Store(useShallow((state) => getDiagramPath(state.project.diagrams, state.currentDiagramId)))
