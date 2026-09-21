import { CommitInput } from '@/components/CommitInput'
import { useCurrentDiagram, useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { columnNames, erTables, relationshipCardinality } from './model'
import { useERUI } from './useERUI'

export function ERInspector() {
  const diagram = useCurrentDiagram()!
  const state = useIdef0Store()
  const tables = erTables(diagram)
  const node = state.selectedElement?.kind === 'node' ? tables.find(n => n.id === state.selectedElement?.id) : undefined
  const arrow = state.selectedElement?.kind === 'arrow' ? diagram.arrows.find(a => a.id === state.selectedElement?.id) : undefined
  const from = tables.find(n => n.id === arrow?.source), to = tables.find(n => n.id === arrow?.target)
  const fk = arrow?.foreignKey
  return <aside className="inspector er-inspector" aria-label="Свойства ERD"><h3>{node ? 'Таблица' : arrow ? 'Внешний ключ' : 'Схема данных'}</h3>
    {node ? <>
      <strong>{node.table.schema}.{node.name || 'Без имени'}</strong>
      <p>{node.table.columns.length} колонок · {node.table.indexes.length} индексов / UNIQUE · {node.table.checks.length} CHECK</p>
      <button className="button primary" onClick={() => useERUI.getState().editTable(node.id)}>Редактировать структуру</button>
      {node.notes && <p>{node.notes}</p>}
      <h4>Связи таблицы</h4>
      {diagram.arrows.filter(a => a.source === node.id || a.target === node.id).map(a => <button className="er-inspector-link" key={a.id} onClick={() => state.setSelection({ nodeIds: [], arrowIds: [a.id] })}>{a.label || 'Внешний ключ'} → {tables.find(t => t.id === (a.source === node.id ? a.target : a.source))?.name || 'Без имени'}</button>)}
      <p className="er-help">Двойное нажатие на таблицу открывает структуру. Перетащите точку колонки FK к колонке PK/UNIQUE родительской таблицы.</p>
    </> : arrow && fk && from && to ? <>
      <strong>{arrow.label || 'Без имени'}</strong>
      <p>{from.table.schema}.{from.name}<br /><code>({columnNames(from, fk.columns)})</code></p><p>↓ REFERENCES</p><p>{to.table.schema}.{to.name}<br /><code>({columnNames(to, fk.referencedColumns)})</code></p>
      <p>Кратность: {relationshipCardinality(from, arrow).child} → {relationshipCardinality(from, arrow).parent}</p>
      <p>ON DELETE {fk.onDelete}<br />ON UPDATE {fk.onUpdate}<br />MATCH {fk.match}<br />{fk.deferrable ? `DEFERRABLE · ${fk.initiallyDeferred ? 'DEFERRED' : 'IMMEDIATE'}` : 'NOT DEFERRABLE'}</p>
      <button className="button primary" onClick={() => useERUI.getState().editRelation(arrow.id)}>Редактировать связь</button>
      <label>Смещение маршрута<input type="range" min="-200" max="200" step="10" defaultValue={arrow.routeOffset ?? 0} key={arrow.id + ':' + arrow.routeOffset} onPointerUp={e => state.updateArrow(arrow.id, { routeOffset: Number(e.currentTarget.value) })} onKeyUp={e => state.updateArrow(arrow.id, { routeOffset: Number(e.currentTarget.value) })} /></label>
      <button className="er-danger" onClick={() => state.removeElement('arrow', arrow.id)}>Удалить связь</button>
    </> : <>
      <label>Название диаграммы<CommitInput value={diagram.title} onCommit={state.updateDiagramTitle} /></label>
      <p>PostgreSQL 18<br />{tables.length} таблиц · {diagram.arrows.length} внешних ключей</p>
      <p className="er-help">Редактор хранит физические имена, типы, ограничения и индексы. SQL выгружается кнопкой над холстом. Кардинальность определяется ограничениями колонок.</p>
      <a href="https://www.postgresql.org/docs/18/datatype.html" target="_blank" rel="noreferrer">Типы PostgreSQL 18 ↗</a>
    </>}
  </aside>
}
