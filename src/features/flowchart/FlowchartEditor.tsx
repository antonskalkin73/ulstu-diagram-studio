import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, ConnectionMode, Controls, MarkerType, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Edge, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCurrentDiagram, useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { useWorkspace } from '@/features/project/lib/workspace'
import { ArrowEdge } from '@/features/diagram/ui/ArrowEdge'
import { flowchartShapes, type FlowchartShape } from '@/types/flowchart'
import { FlowchartNode, type FlowchartFlowNode } from './FlowchartNode'
import type { ArrowEdgeData } from '@/features/diagram/lib/flowMappers'

const nodeTypes = { flowchart: FlowchartNode }
const edgeTypes = { idef0Arrow: ArrowEdge }

function Canvas() {
  const diagram = useCurrentDiagram()!
  const state = useIdef0Store()
  const flow = useReactFlow()
  const canvas = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const modelNodes = useMemo<FlowchartFlowNode[]>(() => diagram.nodes.map(node => ({ id: node.id, type: 'flowchart', position: node.position, data: { node }, style: { width: node.width, height: node.height } })), [diagram.nodes])
  const modelEdges = useMemo<Edge<ArrowEdgeData, 'idef0Arrow'>[]>(() => diagram.arrows.map(arrow => ({ ...arrow, type: 'idef0Arrow', data: { arrow }, markerEnd: { type: MarkerType.ArrowClosed, color: '#475569' } })), [diagram.arrows])
  const [nodes, setNodes, onNodesChange] = useNodesState(modelNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(modelEdges)
  const viewportKey = `${state.project.id}:${diagram.id}`
  const initialViewport = useMemo(() => useWorkspace.getState().viewports[viewportKey], [viewportKey])
  const [fitOnOpen] = useState(() => !initialViewport && diagram.nodes.length > 0)
  useEffect(() => {
    setNodes(previous => modelNodes.map(node => {
      const old = previous.find(n => n.id === node.id)
      return { ...old, ...node, position: old?.dragging ? old.position : node.position, selected: state.selection.nodeIds.includes(node.id) }
    }))
  }, [modelNodes, state.selection.nodeIds, setNodes])
  useEffect(() => { setEdges(modelEdges.map(edge => ({ ...edge, selected: state.selection.arrowIds.includes(edge.id) }))) }, [modelEdges, state.selection.arrowIds, setEdges])

  const add = (shape: FlowchartShape) => {
    const rect = canvas.current?.getBoundingClientRect()
    if (!rect) return
    const position = flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    position.x -= flowchartShapes[shape].width / 2
    position.y -= flowchartShapes[shape].height / 2
    // Repeated additions remain visible and separately draggable.
    while (diagram.nodes.some(n => Math.abs(n.position.x - position.x) < 30 && Math.abs(n.position.y - position.y) < 30)) { position.x += 40; position.y += 40 }
    if (state.project.settings.snapToGrid) { position.x = Math.round(position.x / 20) * 20; position.y = Math.round(position.y / 20) * 20 }
    state.addFlowchartNode(shape, position)
  }
  const commitPositions = (moved: Node[]) => state.updateNodePositions(moved.map(n => ({ id: n.id, ...n.position })))

  return <div className="diagram-editor flowchart-editor">
    <div className="flowchart-heading"><strong>{diagram.title}</strong><span>Добавьте блоки и соедините точки на их сторонах стрелками</span></div>
    <div className="canvas-toolbar flowchart-palette" aria-label="Фигуры блок-схемы">
      {Object.entries(flowchartShapes).map(([shape, item]) => <button key={shape} onClick={() => add(shape as FlowchartShape)} title={`Добавить: ${item.title}`}>＋ {item.title}</button>)}
    </div>
    <div className="canvas-toolbar">
      <button onClick={state.duplicateSelection} disabled={!state.selection.nodeIds.length}>Копия</button>
      <button onClick={state.pasteSelection} disabled={state.clipboard?.type !== 'flowchart'}>Вставить</button>
      <button onClick={state.deleteSelection} disabled={!state.selection.nodeIds.length && !state.selection.arrowIds.length}>Удалить</button>
      <button onClick={() => state.alignSelection('x')} disabled={state.selection.nodeIds.length < 2}>По левому краю</button>
      <button onClick={() => state.alignSelection('y')} disabled={state.selection.nodeIds.length < 2}>По верхнему краю</button>
      <label><input type="checkbox" checked={state.project.settings.snapToGrid} onChange={state.toggleSnapToGrid} /> Сетка</label>
      <label><input type="checkbox" checked={state.project.settings.showMiniMap} onChange={state.toggleMiniMap} /> Миникарта</label>
    </div>
    {message && <div className="flowchart-message" role="alert">{message}<button onClick={() => setMessage('')} aria-label="Закрыть подсказку">×</button></div>}
    <div className="canvas-area" ref={canvas}>
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        connectionMode={ConnectionMode.Loose} defaultViewport={initialViewport} fitView={fitOnOpen}
        minZoom={0.2} maxZoom={2} snapToGrid={state.project.settings.snapToGrid} snapGrid={[20, 20]}
        multiSelectionKeyCode={['Meta', 'Control']} deleteKeyCode={null}
        onNodesChange={changes => {
          onNodesChange(changes)
          const selected = changes.filter(c => c.type === 'select')
          if (!selected.length) return
          const current = useIdef0Store.getState().selection
          const ids = new Set(current.nodeIds)
          for (const change of selected) { if (change.selected) ids.add(change.id); else ids.delete(change.id) }
          state.setSelection({ nodeIds: [...ids], arrowIds: current.arrowIds })
        }}
        onEdgesChange={changes => {
          onEdgesChange(changes)
          const selected = changes.filter(c => c.type === 'select')
          if (!selected.length) return
          const current = useIdef0Store.getState().selection
          const ids = new Set(current.arrowIds)
          for (const change of selected) { if (change.selected) ids.add(change.id); else ids.delete(change.id) }
          state.setSelection({ nodeIds: current.nodeIds, arrowIds: [...ids] })
        }}
        onNodeDragStop={(_, node, dragged) => commitPositions(dragged.length ? dragged : [node])}
        onSelectionDragStop={(_, dragged) => commitPositions(dragged)}
        onConnect={connection => { const result = state.connectArrow(connection); setMessage(result.ok ? '' : result.message ?? '') }}
        onPaneClick={() => state.setSelection({ nodeIds: [], arrowIds: [] })}
        onMoveEnd={(_, viewport) => useWorkspace.getState().setViewport(viewportKey, viewport)}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        {state.project.settings.showMiniMap && <MiniMap pannable zoomable nodeColor="#e2e8f0" />}
      </ReactFlow>
      {!diagram.nodes.length && <div className="flowchart-empty"><h2>Начните с первого блока</h2><p>Выберите «Начало» в панели фигур.<br />Текст внутри блока — подсказка: он исчезнет при вводе.</p></div>}
    </div>
  </div>
}

export function FlowchartEditor() { return <ReactFlowProvider><Canvas /></ReactFlowProvider> }
