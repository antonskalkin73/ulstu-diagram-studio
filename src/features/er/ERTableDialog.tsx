import { useEffect, useRef, useState } from 'react'
import type { ERColumn, ERIndex } from '@/types/er'
import { createId } from '@/utils/id'
import { newColumn, type ERTableNode } from './model'
import { postgresTypeGroups, typeParameters } from './postgresTypes'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'

export function ColumnPicker({ columns, value, onChange, label }: { columns: ERColumn[]; value: string[]; onChange: (ids: string[]) => void; label: string }) {
  return <fieldset className="er-column-picker"><legend>{label} (порядок выбора сохраняется)</legend>{columns.map(c => <label key={c.id}>
    <input type="checkbox" checked={value.includes(c.id)} onChange={e => onChange(e.target.checked ? [...value, c.id] : value.filter(id => id !== c.id))} />
    {c.name || 'Без имени'}{value.includes(c.id) ? ` · ${value.indexOf(c.id) + 1}` : ''}
  </label>)}</fieldset>
}

export function ERTableDialog({ node, onClose }: { node: ERTableNode; onClose: () => void }) {
  const [name, setName] = useState(node.name)
  const [notes, setNotes] = useState(node.notes ?? '')
  const [table, setTable] = useState(() => structuredClone(node.table))
  const dialog = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    dialog.current?.querySelector<HTMLInputElement>('input')?.focus()
    return () => { previous?.focus() }
  }, [])
  const column = (id: string, patch: Partial<ERColumn>) => setTable(t => ({ ...t, columns: t.columns.map(c => c.id === id ? { ...c, ...patch } : c) }))
  const index = (id: string, patch: Partial<ERIndex>) => setTable(t => ({ ...t, indexes: t.indexes.map(i => i.id === id ? { ...i, ...patch } : i) }))
  const move = (id: string, delta: number) => setTable(t => {
    const columns = [...t.columns], at = columns.findIndex(c => c.id === id), target = at + delta
    if (target < 0 || target >= columns.length) return t
    ;[columns[at], columns[target]] = [columns[target]!, columns[at]!]
    return { ...t, columns }
  })
  return <div className="modal-backdrop er-modal-backdrop"><div ref={dialog} className="er-table-dialog" role="dialog" aria-modal="true" aria-label="Структура таблицы" onKeyDown={e => {
    e.stopPropagation()
    if (e.key === 'Escape') onClose()
    if (e.key === 'Tab') {
      const controls = Array.from(dialog.current!.querySelectorAll<HTMLElement>('input:not(:disabled),select:not(:disabled),textarea:not(:disabled),button:not(:disabled),summary'))
      if (e.shiftKey && document.activeElement === controls[0]) { e.preventDefault(); controls.at(-1)?.focus() }
      if (!e.shiftKey && document.activeElement === controls.at(-1)) { e.preventDefault(); controls[0]?.focus() }
    }
  }}>
    <header><div><small>POSTGRESQL 18 · ФИЗИЧЕСКАЯ МОДЕЛЬ</small><h2>Структура таблицы</h2></div><button className="icon-button" aria-label="Закрыть структуру" onClick={onClose}>×</button></header>
    <div className="er-dialog-scroll">
      <div className="er-form-grid"><label>Схема<input value={table.schema} onChange={e => setTable({ ...table, schema: e.target.value })} /></label><label>Имя таблицы<input placeholder="orders" value={name} onChange={e => setName(e.target.value)} /></label><label>Комментарий таблицы<input value={notes} onChange={e => setNotes(e.target.value)} /></label></div>
      <label className="er-inline"><input type="checkbox" checked={table.unlogged} onChange={e => setTable({ ...table, unlogged: e.target.checked })} /> UNLOGGED — данные не журналируются в WAL</label>
      <div className="er-section-title"><h3>Колонки <small>{table.columns.length}</small></h3><button className="button" onClick={() => setTable({ ...table, columns: [...table.columns, newColumn()] })}>＋ Колонка</button></div>
      <p className="er-help">PK образуют один составной первичный ключ в порядке колонок. UNIQUE в строке — отдельное ограничение на эту колонку.</p>
      <div className="er-columns-heading"><span>Имя</span><span>Тип PostgreSQL 18</span><span>Параметры</span><span>[]</span><span>NULL</span><span>PK</span><span>UQ</span><span>Порядок</span></div>
      {table.columns.map((c, at) => <div key={c.id} className="er-column-edit" data-column-id={c.id}>
        <div className="er-columns-row">
          <input aria-label="Имя колонки" placeholder="column_name" value={c.name} onChange={e => column(c.id, { name: e.target.value })} />
          <select aria-label="Тип данных" value={c.dataType} onChange={e => column(c.id, { dataType: e.target.value, typeArgs: '' })}>{Object.entries(postgresTypeGroups).map(([group, types]) => <optgroup key={group} label={group}>{types.map(type => <option key={type}>{type}</option>)}</optgroup>)}</select>
          <input aria-label="Параметры типа" placeholder={typeParameters(c.dataType) || '—'} title={typeParameters(c.dataType)} disabled={!typeParameters(c.dataType)} value={c.typeArgs} onChange={e => column(c.id, { typeArgs: e.target.value })} />
          <select aria-label="Размерность массива" value={c.arrayDimensions} onChange={e => column(c.id, { arrayDimensions: Number(e.target.value) })}>{[0, 1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n || '—'}</option>)}</select>
          <input aria-label="Разрешён NULL" type="checkbox" checked={c.nullable && !c.primaryKey && !c.identity && !/serial$/.test(c.dataType)} disabled={c.primaryKey || Boolean(c.identity) || /serial$/.test(c.dataType)} onChange={e => column(c.id, { nullable: e.target.checked })} />
          <input aria-label="Первичный ключ" type="checkbox" checked={c.primaryKey} onChange={e => column(c.id, { primaryKey: e.target.checked, ...(e.target.checked ? { nullable: false } : {}) })} />
          <input aria-label="Уникальная колонка" type="checkbox" checked={c.unique} onChange={e => column(c.id, { unique: e.target.checked })} />
          <div className="er-row-actions"><button aria-label="Колонка выше" disabled={!at} onClick={() => move(c.id, -1)}>↑</button><button aria-label="Колонка ниже" disabled={at === table.columns.length - 1} onClick={() => move(c.id, 1)}>↓</button><button aria-label="Удалить колонку" onClick={() => setTable({ ...table, columns: table.columns.filter(col => col.id !== c.id) })}>×</button></div>
        </div>
        <details><summary>DEFAULT, генерация, COLLATE и комментарий</summary><div className="er-form-grid">
          <label>DEFAULT (SQL)<input placeholder="now(), 0, 'value'" value={c.defaultValue} onChange={e => column(c.id, { defaultValue: e.target.value })} /></label>
          <label>IDENTITY<select value={c.identity} onChange={e => column(c.id, { identity: e.target.value as ERColumn['identity'] })}><option value="">Нет</option><option>ALWAYS</option><option>BY DEFAULT</option></select></label>
          <label>GENERATED<select value={c.generated} onChange={e => column(c.id, { generated: e.target.value as ERColumn['generated'] })}><option value="">Нет</option><option>STORED</option><option>VIRTUAL</option></select></label>
          <label>Выражение GENERATED<input placeholder="quantity * unit_price" value={c.expression} onChange={e => column(c.id, { expression: e.target.value })} /></label>
          <label>COLLATE<input placeholder="pg_catalog.C" value={c.collation} onChange={e => column(c.id, { collation: e.target.value })} /></label>
          <label>Комментарий колонки<input value={c.comment} onChange={e => column(c.id, { comment: e.target.value })} /></label>
        </div></details>
      </div>)}
      <div className="er-section-title"><h3>Индексы и составные UNIQUE</h3><button className="button" onClick={() => setTable({ ...table, indexes: [...table.indexes, { id: createId('index'), name: '', kind: 'index', columns: [], include: [], method: 'btree', unique: false, nullsNotDistinct: false, predicate: '' }] })}>＋ Индекс / UNIQUE</button></div>
      {table.indexes.map(i => <div className="er-constraint-edit" key={i.id}><div className="er-form-grid">
        <label>Имя индекса / ограничения<input placeholder="Автоматически в PostgreSQL" value={i.name} onChange={e => index(i.id, { name: e.target.value })} /></label>
        <label>Вид<select value={i.kind} onChange={e => index(i.id, { kind: e.target.value as ERIndex['kind'], ...(e.target.value === 'unique' ? { method: 'btree', unique: true, predicate: '' } : {}) })}><option value="index">Индекс</option><option value="unique">Ограничение UNIQUE</option></select></label>
        <label>Метод<select value={i.method} disabled={i.kind === 'unique'} onChange={e => index(i.id, { method: e.target.value as ERIndex['method'] })}>{['btree', 'hash', 'gist', 'spgist', 'gin', 'brin'].map(m => <option key={m}>{m}</option>)}</select></label>
      </div><ColumnPicker columns={table.columns} value={i.columns} onChange={columns => index(i.id, { columns })} label="Ключевые колонки" />
        <ColumnPicker columns={table.columns} value={i.include} onChange={include => index(i.id, { include })} label="INCLUDE" />
        <div className="er-form-grid"><label className="er-inline"><input type="checkbox" checked={i.unique || i.kind === 'unique'} disabled={i.kind === 'unique'} onChange={e => index(i.id, { unique: e.target.checked })} /> UNIQUE</label><label className="er-inline"><input type="checkbox" checked={i.nullsNotDistinct} onChange={e => index(i.id, { nullsNotDistinct: e.target.checked })} /> NULLS NOT DISTINCT</label><label>WHERE (частичный индекс)<input disabled={i.kind === 'unique'} value={i.predicate} onChange={e => index(i.id, { predicate: e.target.value })} /></label></div>
        <button className="er-danger" onClick={() => setTable({ ...table, indexes: table.indexes.filter(item => item.id !== i.id) })}>Удалить индекс / UNIQUE</button>
      </div>)}
      <div className="er-section-title"><h3>Ограничения CHECK</h3><button className="button" onClick={() => setTable({ ...table, checks: [...table.checks, { id: createId('check'), name: '', expression: '' }] })}>＋ CHECK</button></div>
      {table.checks.map(check => <div className="er-form-grid er-constraint-edit" key={check.id}><label>Имя CHECK<input value={check.name} onChange={e => setTable({ ...table, checks: table.checks.map(c => c.id === check.id ? { ...c, name: e.target.value } : c) })} /></label><label>Выражение CHECK<input placeholder="amount >= 0" value={check.expression} onChange={e => setTable({ ...table, checks: table.checks.map(c => c.id === check.id ? { ...c, expression: e.target.value } : c) })} /></label><button className="er-danger" onClick={() => setTable({ ...table, checks: table.checks.filter(c => c.id !== check.id) })}>Удалить CHECK</button></div>)}
      <p className="er-help">Удаление колонки удаляет связанные внешние ключи и исключает колонку из индексов. Операцию можно отменить. Выражения SQL проверяются целевой базой данных.</p>
    </div>
    <footer><button className="button" onClick={onClose}>Отмена</button><button className="button primary" onClick={() => { useIdef0Store.getState().updateERTable(node.id, name, table, notes); onClose() }}>Применить структуру</button></footer>
  </div></div>
}
