import { useEffect, useMemo, useRef, useState } from 'react'
import { Background, BackgroundVariant, ConnectionMode, Controls, MiniMap, ReactFlow, ReactFlowProvider, useEdgesState, useNodesState, useReactFlow, type Node } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCurrentDiagram, useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { useWorkspace } from '@/features/project/lib/workspace'
import { ERTableNode, type ERFlowNode } from './ERTableNode'
import { ERRelationEdge, type ERFlowEdge } from './ERRelationEdge'
import { erTables, relationshipCardinality, columnNames } from './model'
import { ERTableDialog } from './ERTableDialog'
import { ERForeignKeyDialog } from './ERForeignKeyDialog'
import { useERUI } from './useERUI'
import { buildPostgresSQL } from './sql'
import { downloadTextFile } from '@/utils/idef0'

const nodeTypes = { erTable: ERTableNode }
const edgeTypes = { erRelation: ERRelationEdge }

function Canvas() {
  const diagram = useCurrentDiagram()!
  const state = useIdef0Store()
  const flow = useReactFlow()
  const canvas = useRef<HTMLDivElement>(null)
  const [message, setMessage] = useState('')
  const ui = useERUI()
  const tables = useMemo(() => erTables(diagram), [diagram])
  const modelNodes = useMemo<ERFlowNode[]>(() => tables.map(node => ({ id: node.id, type: 'erTable', position: node.position, data: { node, foreignColumns: diagram.arrows.filter(a => a.source === node.id).flatMap(a => a.foreignKey?.columns ?? []) }, style: { width: node.width, height: node.height } })), [tables, diagram.arrows])
  const modelEdges = useMemo<ERFlowEdge[]>(() => diagram.arrows.flatMap(arrow => {
    const source = tables.find(t => t.id === arrow.source), target = tables.find(t => t.id === arrow.target)
    if (!source || !target || !arrow.foreignKey) return []
    const description = `${source.name} (${columnNames(source, arrow.foreignKey.columns)}) → ${target.name} (${columnNames(target, arrow.foreignKey.referencedColumns)})`
    return [{ ...arrow, type: 'erRelation' as const, data: { arrow, ...relationshipCardinality(source, arrow), description } }]
  }), [diagram.arrows, tables])
  const editingTable = tables.find(t => t.id === ui.editingTable)
  const editingRelation = diagram.arrows.find(a => a.id === ui.editingRelation)
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

  const add = () => {
    const rect = canvas.current?.getBoundingClientRect()
    if (!rect) return
    const position = flow.screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
    position.x -= 195; position.y -= 90
    while (diagram.nodes.some(n => Math.abs(n.position.x - position.x) < 30 && Math.abs(n.position.y - position.y) < 30)) { position.x += 40; position.y += 40 }
    state.addERTable(position)
    ui.editTable(useIdef0Store.getState().selection.nodeIds[0]!)
  }
  const commitPositions = (moved: Node[]) => state.updateNodePositions(moved.map(n => ({ id: n.id, ...n.position })))

  return <div className="diagram-editor er-editor">
    <div className="flowchart-heading"><strong>{diagram.title}</strong><span>PostgreSQL 18 · Связь: колонка FK → колонка PK / UNIQUE</span></div>
    <div className="canvas-toolbar">
      <button onClick={add}>＋ Таблица</button>
      <button disabled={!tables.length} onClick={() => ui.editRelation('new')}>＋ Внешний ключ</button>
      <button disabled={!tables.length} onClick={() => { try { downloadTextFile(buildPostgresSQL(diagram), `${diagram.title.replace(/[<>:"/\\|?*]/g, '-') || 'schema'}.sql`, 'text/plain'); setMessage('') } catch (e) { setMessage(e instanceof Error ? e.message : String(e)) } }}>SQL PostgreSQL 18</button>
      <span className="separator" />
      <button onClick={state.duplicateSelection} disabled={!state.selection.nodeIds.length}>Копия</button>
      <button onClick={state.pasteSelection} disabled={state.clipboard?.type !== 'er'}>Вставить</button>
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
        onNodeDoubleClick={(_, node) => ui.editTable(node.id)}
        onEdgeDoubleClick={(_, edge) => ui.editRelation(edge.id)}
        onNodeDragStop={(_, node, dragged) => commitPositions(dragged.length ? dragged : [node])}
        onSelectionDragStop={(_, dragged) => commitPositions(dragged)}
        onConnect={connection => { const result = state.connectArrow(connection); setMessage(result.ok ? '' : result.message ?? '') }}
        onPaneClick={() => state.setSelection({ nodeIds: [], arrowIds: [] })}
        onMoveEnd={(_, viewport) => useWorkspace.getState().setViewport(viewportKey, viewport)}>
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#cbd5e1" />
        <Controls showInteractive={false} />
        {state.project.settings.showMiniMap && <MiniMap pannable zoomable nodeColor="#e2e8f0" />}
      </ReactFlow>
      {!diagram.nodes.length && <div className="flowchart-empty"><h2>Спроектируйте схему данных</h2><p>Добавьте таблицы, настройте колонки и ключи.<br />Связи соединяют конкретные колонки, включая составные ключи.</p></div>}
      <div className="er-legend">PK первичный · FK внешний · UQ уникальный · 0..N много · 0..1 необязательно · 1 обязательно</div>
    </div>
    {editingTable && <ERTableDialog key={editingTable.id} node={editingTable} onClose={() => ui.editTable(null)} />}
    {(editingRelation || ui.editingRelation === 'new') && <ERForeignKeyDialog key={ui.editingRelation} diagram={diagram} arrow={editingRelation} onClose={() => ui.editRelation(null)} />}
  </div>
}

export function EREditor() { return <ReactFlowProvider><Canvas /></ReactFlowProvider> }
