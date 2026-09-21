import { BoundaryZones } from './BoundaryZones'
import { boundaryRoleAtPoint } from '@/features/diagram/lib/boundaryZones'
import { FUNCTION_HANDLES } from '@/entities/idef0/constants'
import { getBoundaryPosition, getDiagramFrame, getExternalArrowFunction } from '@/features/diagram/lib/diagramGeometry'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  useReactFlow,
  useViewport,
  useNodesState,
  useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useWorkspace } from '@/features/project/lib/workspace'
import { useShallow } from 'zustand/react/shallow'
import { ARROW_TYPE_COLORS, ARROW_TYPE_LABELS, SNAP_GRID } from '@/entities/idef0/constants'
import { toFlowEdges, toFlowNodes } from '@/features/diagram/lib/flowMappers'
import {
  useCurrentDiagram,
  useCurrentPath,
  useIdef0Store,
} from '@/features/diagram/model/useIdef0Store'
import { ArrowEdge } from '@/features/diagram/ui/ArrowEdge'
import { BoundaryPortNode } from '@/features/diagram/ui/BoundaryPortNode'
import { FunctionNode } from '@/features/diagram/ui/FunctionNode'

const nodeTypes = {
  idef0Function: FunctionNode,
  boundaryPort: BoundaryPortNode,
} as unknown as NodeTypes

const edgeTypes = {
  idef0Arrow: ArrowEdge,
} as unknown as EdgeTypes

const EditorCanvas = () => {
  const diagram = useCurrentDiagram()
  const path = useCurrentPath()
  const reactFlow = useReactFlow()
  const {
    connectArrow,
    createContextFunction,
    addFunctionNode,
    addExternalArrow,
    setSelection,
    setContextMenu,
    contextMenu,
    openDecomposition,
    removeElement,
    project,
    selection,
    clipboard,
  } = useIdef0Store(useShallow((state) => ({
    connectArrow: state.connectArrow,
    createContextFunction: state.createContextFunction,
    addFunctionNode: state.addFunctionNode,
    addExternalArrow: state.addExternalArrow,
    setSelection: state.setSelection,
    setContextMenu: state.setContextMenu,
    contextMenu: state.contextMenu,
    openDecomposition: state.openDecomposition,
    removeElement: state.removeElement,
    project: state.project,
    selection: state.selection,
    clipboard: state.clipboard,
  })))

  const canvasRef = useRef<HTMLDivElement>(null)
  const viewport = useViewport()
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 })
  useEffect(() => {
    const element = canvasRef.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setCanvasSize(previous => previous.width === entry.contentRect.width && previous.height === entry.contentRect.height
        ? previous : { width: entry.contentRect.width, height: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  const frame = useMemo(() => ({
    x: (18 - viewport.x) / viewport.zoom, y: (18 - viewport.y) / viewport.zoom,
    width: Math.max(60, canvasSize.width - 36) / viewport.zoom,
    height: Math.max(60, canvasSize.height - 36) / viewport.zoom,
  }), [viewport.x, viewport.y, viewport.zoom, canvasSize.width, canvasSize.height])
  const modelNodes = useMemo(() => diagram ? toFlowNodes(diagram, frame) : [], [diagram, frame])
  const modelEdges = useMemo(() => diagram ? toFlowEdges(diagram) : [], [diagram])
  const [nodes, setNodes, onNodesChange] = useNodesState(modelNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(modelEdges)
  const viewportKey = `${project.id}:${diagram?.id}`
  const initialViewport = useMemo(() => useWorkspace.getState().viewports[viewportKey], [viewportKey])
  useEffect(() => {
    setNodes(previous => modelNodes.map(node => ({ ...previous.find(n => n.id === node.id), ...node, position: previous.find(n => n.id === node.id)?.dragging ? previous.find(n => n.id === node.id)!.position : node.position, selected: selection.nodeIds.includes(node.id) })))
  }, [modelNodes, selection.nodeIds, setNodes])
  useEffect(() => {
    setEdges(modelEdges.map(edge => ({ ...edge, selected: selection.arrowIds.includes(edge.id) })))
  }, [modelEdges, selection.arrowIds, setEdges])
  // SelectionChange also fires for controlled prop updates. Feeding it back into
  // the model can alternate old/new selections forever. Only user change events
  // update the model; programmatic selection travels to React Flow one way.
  const handleNodesChange = useCallback((changes: Parameters<typeof onNodesChange>[0]) => {
    const active = useIdef0Store.getState()
    const diagram = active.project.diagrams.find(d => d.id === active.currentDiagramId)
    const boundedChanges = changes.map(change => {
      if (!diagram || change.type !== 'position' || !change.position) return change
      const node = diagram.nodes.find(n => n.id === change.id)
      return node?.kind === 'boundaryPort'
        ? { ...change, position: getBoundaryPosition({ ...node, position: change.position }, frame) }
        : change
    })
    onNodesChange(boundedChanges)
    const selectedChanges = changes.filter(change => change.type === 'select')
    if (!selectedChanges.length) return
    const current = useIdef0Store.getState().selection
    const ids = new Set(current.nodeIds)
    for (const change of selectedChanges) {
      if (change.selected) ids.add(change.id)
      else ids.delete(change.id)
    }
    setSelection({ nodeIds: [...ids], arrowIds: current.arrowIds })
  }, [onNodesChange, setSelection, frame])
  const handleEdgesChange = useCallback((changes: Parameters<typeof onEdgesChange>[0]) => {
    onEdgesChange(changes)
    const selectedChanges = changes.filter(change => change.type === 'select')
    if (!selectedChanges.length) return
    const current = useIdef0Store.getState().selection
    const ids = new Set(current.arrowIds)
    for (const change of selectedChanges) {
      if (change.selected) ids.add(change.id)
      else ids.delete(change.id)
    }
    setSelection({ nodeIds: current.nodeIds, arrowIds: [...ids] })
  }, [onEdgesChange, setSelection])
  const commitPositions = (movedNodes: Node[]) => useIdef0Store.getState().updateNodePositions(movedNodes.map(n => ({ id: n.id, ...n.position })))

  const handlePaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault()
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: position.x,
        flowY: position.y,
        kind: 'pane',
      })
    },
    [reactFlow, setContextMenu],
  )

  const handleNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault()
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setSelection({ nodeIds: [node.id], arrowIds: [] })
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: position.x,
        flowY: position.y,
        kind: 'node',
        targetId: node.id,
      })
    },
    [reactFlow, setContextMenu, setSelection],
  )

  const handleEdgeContextMenu = useCallback(
    (event: React.MouseEvent, edge: Edge) => {
      event.preventDefault()
      const position = reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY })
      setSelection({ nodeIds: [], arrowIds: [edge.id] })
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        flowX: position.x,
        flowY: position.y,
        kind: 'arrow',
        targetId: edge.id,
      })
    },
    [reactFlow, setContextMenu, setSelection],
  )

  const handleContextAction = useCallback(
    (action: 'function' | 'input' | 'control' | 'output' | 'mechanism' | 'delete' | 'decompose') => {
      if (!contextMenu) {
        return
      }

      if (action === 'function') {
        const createMethod = diagram?.isContext && diagram.nodes.filter((node) => node.kind === 'function').length === 0
          ? createContextFunction
          : addFunctionNode
        createMethod({ x: contextMenu.flowX, y: contextMenu.flowY })
      }

      if (action === 'input' || action === 'control' || action === 'output' || action === 'mechanism') {
        addExternalArrow(action)
      }

      if (action === 'delete' && contextMenu.targetId && contextMenu.kind !== 'pane') {
        removeElement(contextMenu.kind === 'node' ? 'node' : 'arrow', contextMenu.targetId)
      }

      if (action === 'decompose' && contextMenu.targetId) {
        openDecomposition(contextMenu.targetId)
      }

      setContextMenu(null)
    },
    [addExternalArrow, addFunctionNode, contextMenu, createContextFunction, diagram, openDecomposition, removeElement, setContextMenu],
  )

  return (
    <div className="diagram-editor">
      <div className="flex items-center justify-between border-b border-line bg-white px-4 py-3">
        <div>
          <div className="text-sm font-semibold text-slate-900">{diagram?.title}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            {path.map((item, index) => (
              <span key={item.id} className="flex items-center gap-2">
                <button className="breadcrumb" onClick={() => useIdef0Store.getState().navigateToDiagram(item.id)}>{item.title}</button>
                {index < path.length - 1 ? <span>›</span> : null}
              </span>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
          {Object.entries(ARROW_TYPE_LABELS).map(([type, label]) => (
            <div key={type} className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: ARROW_TYPE_COLORS[type as keyof typeof ARROW_TYPE_COLORS] }} />
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="canvas-toolbar">
        <button onClick={() => addFunctionNode(reactFlow.screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 }))} disabled={diagram?.isContext && diagram.nodes.some(n => n.kind === 'function')}>＋ Функция</button>
        {(['input', 'control', 'output', 'mechanism'] as const).map(role => <button key={role} disabled={!diagram || !getExternalArrowFunction(diagram, selection)} title="Добавить стрелку между границей листа и выбранной функцией" onClick={() => addExternalArrow(role)}>{ARROW_TYPE_LABELS[role]}</button>)}
        <span className="separator" />
        <button onClick={() => useIdef0Store.getState().duplicateSelection()} disabled={!selection.nodeIds.length} title="Дублировать выделенные элементы · Ctrl+D">Копия</button>
        <button onClick={() => useIdef0Store.getState().pasteSelection()} disabled={!clipboard} title="Вставить элементы · Ctrl+V">Вставить</button>
        <button onClick={() => useIdef0Store.getState().alignSelection('x')} disabled={selection.nodeIds.length < 2}>По левому краю</button>
        <button onClick={() => useIdef0Store.getState().alignSelection('y')} disabled={selection.nodeIds.length < 2}>По верхнему краю</button>
        <label><input type="checkbox" checked={project.settings.snapToGrid} onChange={() => useIdef0Store.getState().toggleSnapToGrid()} /> Сетка</label>
        <label><input type="checkbox" checked={project.settings.showMiniMap} onChange={() => useIdef0Store.getState().toggleMiniMap()} /> Миникарта</label>
        <label><input type="checkbox" checked={project.settings.strictMode} onChange={() => useIdef0Store.getState().toggleStrictMode()} /> Строгий режим</label>
      </div>
      <div className="canvas-area" ref={canvasRef}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onInit={instance => { if (!initialViewport && diagram) void instance.fitBounds(getDiagramFrame(diagram), { padding: 0.1 }) }}
          defaultViewport={initialViewport}
          minZoom={0.25}
          maxZoom={1.8}
          snapToGrid={project.settings.snapToGrid}
          snapGrid={SNAP_GRID}
          multiSelectionKeyCode={['Meta', 'Control']}
          deleteKeyCode={null}
          onNodesChange={handleNodesChange}
          onEdgesChange={handleEdgesChange}
          onNodeDragStop={(_, node, dragged) => commitPositions(dragged.length ? dragged : [node])}
          onSelectionDragStop={(_, dragged) => commitPositions(dragged)}
          onConnectEnd={(event, connection) => {
            if (connection.isValid || !canvasRef.current || !diagram) return
            const node = diagram.nodes.find(n => n.id === connection.fromNode?.id && n.kind === 'function')
            const pointer = 'changedTouches' in event ? event.changedTouches[0] : event
            if (!node || !pointer) return
            const rect = canvasRef.current.getBoundingClientRect()
            const role = boundaryRoleAtPoint(pointer.clientX - rect.left, pointer.clientY - rect.top, rect.width, rect.height)
            const handles = { input: FUNCTION_HANDLES.inputTarget, control: FUNCTION_HANDLES.controlTarget, output: FUNCTION_HANDLES.outputSource, mechanism: FUNCTION_HANDLES.mechanismTarget }
            if (role && connection.fromHandle?.id === handles[role]) addExternalArrow(role, node.id, reactFlow.screenToFlowPosition({ x: pointer.clientX, y: pointer.clientY }))
          }}
          onConnect={(connection) => {
            const result = connectArrow(connection)
            if (!result.ok && result.message) {
              window.alert(result.message)
            }
          }}
          onNodeDoubleClick={(_, node) => openDecomposition(node.id)}
          onPaneContextMenu={handlePaneContextMenu}
          onNodeContextMenu={handleNodeContextMenu}
          onEdgeContextMenu={handleEdgeContextMenu}
          onMoveEnd={(_, viewport) => useWorkspace.getState().setViewport(viewportKey, viewport)}
          onPaneClick={() => {
            setSelection({ nodeIds: [], arrowIds: [] })
            setContextMenu(null)
          }}
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
          {project.settings.showMiniMap ? (
            <MiniMap
              style={{ right: 40, bottom: 40 }}
              pannable
              zoomable
              nodeStrokeColor={node => node.type === 'diagramFrame' ? '#cbd5e1' : '#475569'}
              nodeColor={() => '#ffffff'}
              maskColor="rgba(148, 163, 184, 0.16)"
            />
          ) : null}
          <Controls showInteractive={false} style={{ left: 40, bottom: 40 }} />
        </ReactFlow>
        <BoundaryZones canvasRef={canvasRef} onConnect={(role, nodeId, point) => addExternalArrow(role, nodeId, reactFlow.screenToFlowPosition(point))} />

        {diagram && diagram.nodes.length === 0 ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="pointer-events-auto max-w-md rounded-2xl border border-dashed border-slate-300 bg-white/95 p-6 text-center shadow-panel">
              <div className="text-lg font-semibold text-slate-900">Пустая диаграмма</div>
              <p className="mt-2 text-sm text-slate-500">
                Добавьте функцию, затем используйте Input, Control, Output и Mechanism для стрелок от границ листа.
              </p>
              <div className="mt-4 flex flex-wrap justify-center gap-3">
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                  onClick={() => createContextFunction()}
                >
                  Создать контекстную диаграмму
                </button>
                <button
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  disabled
                  title="Сначала создайте функцию"
                >
                  Добавить Input
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {contextMenu ? (
          <div
            className="fixed z-20 min-w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-2xl"
            style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 300) }}
          >
            {contextMenu.kind === 'pane' ? (
              <>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => handleContextAction('function')}>
                  Добавить Function
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" disabled={!diagram || !getExternalArrowFunction(diagram, selection)} onClick={() => handleContextAction('input')}>
                  Добавить внешний Input
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" disabled={!diagram || !getExternalArrowFunction(diagram, selection)} onClick={() => handleContextAction('control')}>
                  Добавить внешний Control
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" disabled={!diagram || !getExternalArrowFunction(diagram, selection)} onClick={() => handleContextAction('output')}>
                  Добавить внешний Output
                </button>
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" disabled={!diagram || !getExternalArrowFunction(diagram, selection)} onClick={() => handleContextAction('mechanism')}>
                  Добавить внешний Mechanism
                </button>
              </>
            ) : (
              <>
                {contextMenu.kind === 'node' ? (
                  <button className="w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-slate-100" onClick={() => handleContextAction('decompose')}>
                    Открыть декомпозицию
                  </button>
                ) : null}
                <button className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50" onClick={() => handleContextAction('delete')}>
                  Удалить
                </button>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export const DiagramEditor = () => (
  <ReactFlowProvider>
    <EditorCanvas />
  </ReactFlowProvider>
)
