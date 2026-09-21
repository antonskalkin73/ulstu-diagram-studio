import { useEffect, useRef, useState } from 'react'
import type { DiagramArrow, EditorDiagram } from '@/types/diagram'
import { referentialActions, type ERForeignKey } from '@/types/er'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { erTables, newForeignKey } from './model'

export function ERForeignKeyDialog({ diagram, arrow, onClose }: { diagram: EditorDiagram; arrow?: DiagramArrow; onClose: () => void }) {
  const tables = erTables(diagram)
  const [source, setSource] = useState(arrow?.source ?? tables[0]?.id ?? '')
  const [target, setTarget] = useState(arrow?.target ?? tables[1]?.id ?? tables[0]?.id ?? '')
  const [label, setLabel] = useState(arrow?.label ?? '')
  const from = tables.find(n => n.id === source), to = tables.find(n => n.id === target)
  const [fk, setFk] = useState(() => structuredClone(arrow?.foreignKey ?? newForeignKey(from?.table.columns[0]?.id ?? '', to?.table.columns[0]?.id ?? '')))
  const [error, setError] = useState('')
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => { previous?.focus() }
  }, [])
  const patch = (update: Partial<ERForeignKey>) => setFk({ ...fk, ...update })
  return <div className="modal-backdrop er-modal-backdrop"><div className="er-fk-dialog" role="dialog" aria-modal="true" aria-label="Внешний ключ" ref={dialog} onKeyDown={e => {
    e.stopPropagation()
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab') {
      const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),button:not(:disabled)'))
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus() }
      if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus() }
    }
  }}><header><h2>Внешний ключ</h2><button className="icon-button" onClick={onClose} aria-label="Закрыть внешний ключ">×</button></header>
    <div className="er-dialog-scroll">
      <label>Имя ограничения<input value={label} placeholder="Автоматически в PostgreSQL" onChange={e => setLabel(e.target.value)} /></label>
      <div className="er-form-grid er-two"><label>Таблица с внешним ключом<select value={source} onChange={e => { setSource(e.target.value); patch({ columns: [''], referencedColumns: [''] }) }}>{tables.map(n => <option key={n.id} value={n.id}>{n.table.schema}.{n.name || 'Без имени'}</option>)}</select></label><label>Родительская таблица<select value={target} onChange={e => { setTarget(e.target.value); patch({ columns: [''], referencedColumns: [''] }) }}>{tables.map(n => <option key={n.id} value={n.id}>{n.table.schema}.{n.name || 'Без имени'}</option>)}</select></label></div>
      <h3>Соответствие колонок</h3>
      <p className="er-help">Правая сторона должна содержать полный PK или UNIQUE. Для составного ключа добавьте все пары в соответствующем порядке.</p>
      {fk.columns.map((id, at) => <div className="er-fk-pair" key={at}>
        <select aria-label={`Колонка FK ${at + 1}`} value={id} onChange={e => patch({ columns: fk.columns.map((c, i) => i === at ? e.target.value : c) })}><option value="">Выберите колонку</option>{from?.table.columns.map(c => <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>)}</select><span>→</span>
        <select aria-label={`Колонка PK/UNIQUE ${at + 1}`} value={fk.referencedColumns[at]} onChange={e => patch({ referencedColumns: fk.referencedColumns.map((c, i) => i === at ? e.target.value : c) })}><option value="">Выберите колонку</option>{to?.table.columns.map(c => <option key={c.id} value={c.id}>{c.name || 'Без имени'}</option>)}</select>
        <button aria-label={`Удалить пару ${at + 1}`} disabled={fk.columns.length === 1} onClick={() => patch({ columns: fk.columns.filter((_, i) => i !== at), referencedColumns: fk.referencedColumns.filter((_, i) => i !== at) })}>×</button>
      </div>)}
      <button className="button" onClick={() => patch({ columns: [...fk.columns, ''], referencedColumns: [...fk.referencedColumns, ''] })}>＋ Пара колонок</button>
      <div className="er-form-grid"><label>ON DELETE<select value={fk.onDelete} onChange={e => patch({ onDelete: e.target.value as ERForeignKey['onDelete'] })}>{referentialActions.map(v => <option key={v}>{v}</option>)}</select></label><label>ON UPDATE<select value={fk.onUpdate} onChange={e => patch({ onUpdate: e.target.value as ERForeignKey['onUpdate'] })}>{referentialActions.map(v => <option key={v}>{v}</option>)}</select></label><label>MATCH<select value={fk.match} onChange={e => patch({ match: e.target.value as ERForeignKey['match'] })}><option>SIMPLE</option><option>FULL</option></select></label></div>
      <label className="er-inline"><input type="checkbox" checked={fk.deferrable} onChange={e => patch({ deferrable: e.target.checked, ...(e.target.checked ? {} : { initiallyDeferred: false }) })} /> DEFERRABLE</label><label className="er-inline"><input type="checkbox" checked={fk.initiallyDeferred} disabled={!fk.deferrable} onChange={e => patch({ initiallyDeferred: e.target.checked })} /> INITIALLY DEFERRED</label>
      {error && <p role="alert" className="er-danger">{error}</p>}
    </div><footer><button className="button" onClick={onClose}>Отмена</button><button className="button primary" onClick={() => {
      if (new Set(fk.columns).size !== fk.columns.length || new Set(fk.referencedColumns).size !== fk.referencedColumns.length) { setError('В каждой стороне пары колонки не должны повторяться.'); return }
      if (useIdef0Store.getState().saveERForeignKey(arrow?.id ?? null, source, target, label, fk)) onClose()
      else setError('Выберите таблицы и все пары колонок.')
    }}>Применить связь</button></footer>
  </div></div>
}
