import { useState } from 'react'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import type { IDEF0Diagram } from '@/types/idef0'

function TreeItem({ diagram, diagrams, activeId, onOpen, onDelete, rootId }: {
  diagram: IDEF0Diagram; diagrams: IDEF0Diagram[]; activeId: string; rootId: string;
  onOpen: (id: string) => void; onDelete: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(true)
  const children = diagrams.filter(d => d.parentDiagramId === diagram.id)
  return <li>
    <div className={`tree-row ${activeId === diagram.id ? 'active' : ''}`}>
      <button className="tree-chevron" aria-label={expanded ? 'Свернуть ветку' : 'Развернуть ветку'} onClick={() => setExpanded(!expanded)} disabled={!children.length}>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      <button className="tree-title" onClick={() => onOpen(diagram.id)} title={diagram.title}>
        <span>{diagram.title}</span><small>{diagram.nodeNumber} · IDEF0</small>
      </button>
      {diagram.id !== rootId && <button className="tree-delete" aria-label={`Удалить ${diagram.title}`} onClick={() => onDelete(diagram.id)}><Trash2 size={13} /></button>}
    </div>
    {expanded && children.length > 0 && <ul>{children.map(child => <TreeItem key={child.id} diagram={child} diagrams={diagrams} activeId={activeId} onOpen={onOpen} onDelete={onDelete} rootId={rootId} />)}</ul>}
  </li>
}
export function LeftSidebar({ diagrams, activeId, rootId, onOpen, onAdd, onDelete }: {
  diagrams: IDEF0Diagram[]; activeId: string; rootId: string;
  onOpen: (id: string) => void; onAdd: () => void; onDelete: (id: string) => void
}) {
  return <aside className="project-tree" aria-label="Дерево диаграмм">
    <div className="section-heading">Диаграммы <span>{diagrams.length}</span></div>
    <button className="add-diagram" onClick={onAdd}><Plus size={15} /> Добавить диаграмму</button>
    <ul className="tree">{diagrams.filter(d => !d.parentDiagramId).map(d => <TreeItem key={d.id} diagram={d} diagrams={diagrams} activeId={activeId} rootId={rootId} onOpen={onOpen} onDelete={onDelete} />)}</ul>
    <div className="tree-hint">Дважды нажмите на блок, чтобы открыть его декомпозицию.</div>
  </aside>
}
