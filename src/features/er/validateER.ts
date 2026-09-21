import type { EditorDiagram, ValidationIssue } from '@/types/diagram'
import { erTables, isCandidateKey, normalizedType } from './model'
import { typeError } from './postgresTypes'

export function validateER(diagram: EditorDiagram): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (id: string, code: string, message: string, severity: 'error' | 'warning' = 'error', elementType: 'node' | 'arrow' = 'node') =>
    issues.push({ id: `${diagram.id}-${id}-${code}-${issues.length}`, diagramId: diagram.id, elementId: id, elementType, severity, code: `er-${code}`, message })
  const tables = erTables(diagram)
  const names = new Set<string>()
  const schemaRelations = new Set<string>()
  const identifier = (name: string) => name.trim().length > 0 && !name.includes('\0') && new TextEncoder().encode(name).length <= 63
  for (const node of tables) {
    const title = `${node.table.schema}.${node.name}`
    const nameKey = JSON.stringify([node.table.schema, node.name])
    if (!identifier(node.name) || !identifier(node.table.schema)) add(node.id, 'name', 'Имя таблицы и схемы: 1–63 байта UTF-8, без нулевых символов.')
    if (names.has(nameKey)) add(node.id, 'duplicate-table', `Повтор таблицы ${title}.`)
    names.add(nameKey); schemaRelations.add(nameKey)
  }
  for (const node of tables) {
    const t = node.table, prefix = `${t.schema}.${node.name}: `
    const columns = new Set<string>(), constraintNames = new Set<string>()
    if (!t.columns.length) add(node.id, 'columns', prefix + 'добавьте хотя бы одну колонку.')
    if (!t.columns.some(c => c.primaryKey)) add(node.id, 'pk', prefix + 'не задан первичный ключ.', 'warning')
    for (const c of t.columns) {
      const label = prefix + (c.name || 'колонка') + ': '
      if (!identifier(c.name)) add(node.id, 'column-name', label + 'имя должно занимать 1–63 байта UTF-8.')
      if (columns.has(c.name)) add(node.id, 'duplicate-column', label + 'повтор имени колонки.')
      columns.add(c.name)
      const error = typeError(c)
      if (error) add(node.id, 'type', label + error)
      if (c.identity && (!['smallint', 'integer', 'bigint'].includes(c.dataType) || c.arrayDimensions)) add(node.id, 'identity-type', label + 'IDENTITY требует целочисленный тип без массива.')
      if ([Boolean(c.identity), Boolean(c.generated), Boolean(c.defaultValue.trim()), /serial$/.test(c.dataType)].filter(Boolean).length > 1) add(node.id, 'generation-conflict', label + 'DEFAULT, IDENTITY, GENERATED и SERIAL несовместимы друг с другом.')
      if (c.generated && !c.expression.trim()) add(node.id, 'generated-expression', label + 'задайте выражение генерации.')
      if (c.collation && !['text', 'character', 'character varying'].includes(c.dataType)) add(node.id, 'collation', label + 'COLLATE в редакторе поддерживается для строковых типов.')
    }
    for (const item of [...t.indexes, ...t.checks]) {
      if (item.name && (!identifier(item.name) || constraintNames.has(item.name))) add(node.id, 'constraint-name', prefix + 'имена ограничений/индексов должны быть корректными и неповторяющимися.')
      if (item.name) constraintNames.add(item.name)
    }
    for (const i of t.indexes) {
      if (i.name) {
        const key = JSON.stringify([t.schema, i.name])
        if (schemaRelations.has(key)) add(node.id, 'index-name', prefix + `имя ${i.name} уже занято в этой схеме.`)
        schemaRelations.add(key)
      }
      if (!i.columns.length || new Set(i.columns).size !== i.columns.length || [...i.columns, ...i.include].some(id => !t.columns.some(c => c.id === id))) add(node.id, 'index-columns', prefix + 'проверьте колонки индекса/UNIQUE.')
      if (i.include.some(id => i.columns.includes(id)) || new Set(i.include).size !== i.include.length) add(node.id, 'include-columns', prefix + 'INCLUDE не должен повторять ключевые колонки.')
      if ((i.unique || i.kind === 'unique') && i.method !== 'btree') add(node.id, 'unique-method', prefix + 'UNIQUE поддерживается только с B-tree.')
      if (i.nullsNotDistinct && !(i.unique || i.kind === 'unique')) add(node.id, 'nulls-distinct', prefix + 'NULLS NOT DISTINCT требует UNIQUE.')
      if (i.kind === 'unique' && i.predicate.trim()) add(node.id, 'partial-unique', prefix + 'для частичной уникальности используйте уникальный индекс, а не ограничение UNIQUE.')
      if (i.include.length && !['btree', 'gist', 'spgist'].includes(i.method)) add(node.id, 'include-method', prefix + 'INCLUDE поддерживается B-tree, GiST и SP-GiST.')
      if (['hash', 'spgist'].includes(i.method) && i.columns.length > 1) add(node.id, 'index-multicolumn', prefix + `${i.method} не поддерживает многоколоночный индекс.`)
      if (i.method !== 'btree') add(node.id, 'operator-class', prefix + `проверьте наличие стандартного класса операторов ${i.method} для выбранных типов.`, 'warning')
    }
    for (const check of t.checks) if (!check.expression.trim()) add(node.id, 'check', prefix + 'выражение CHECK пустое.')
  }
  for (const a of diagram.arrows) {
    const s = tables.find(n => n.id === a.source), t = tables.find(n => n.id === a.target), fk = a.foreignKey
    const fail = (code: string, message: string, severity: 'error' | 'warning' = 'error') => add(a.id, code, `${a.label || 'Внешний ключ'}: ${message}`, severity, 'arrow')
    if (!s || !t || !fk || !fk.columns.length || fk.columns.length !== fk.referencedColumns.length || fk.columns.some(id => !s.table.columns.some(c => c.id === id)) || fk.referencedColumns.some(id => !t.table.columns.some(c => c.id === id))) { fail('fk-columns', 'некорректное соответствие колонок.'); continue }
    if (new Set(fk.columns).size !== fk.columns.length || new Set(fk.referencedColumns).size !== fk.referencedColumns.length) fail('fk-duplicate', 'колонки не должны повторяться.')
    if (a.label && !identifier(a.label)) fail('fk-name', 'некорректное имя ограничения.')
    if (a.label && (diagram.arrows.some(other => other.id !== a.id && other.source === a.source && other.label === a.label) || [...s.table.indexes, ...s.table.checks].some(c => c.name === a.label))) fail('fk-name-duplicate', 'имя ограничения уже занято в таблице.')
    if (!isCandidateKey(t.table, fk.referencedColumns)) fail('fk-key', 'ссылка должна вести на полный PRIMARY KEY, UNIQUE или полный нечастичный уникальный индекс.')
    if (fk.initiallyDeferred && !fk.deferrable) fail('fk-deferred', 'INITIALLY DEFERRED требует DEFERRABLE.')
    fk.columns.forEach((id, index) => {
      const from = s.table.columns.find(c => c.id === id)!, to = t.table.columns.find(c => c.id === fk.referencedColumns[index])!
      const int = ['smallint', 'integer', 'bigint']
      if (normalizedType(from) !== normalizedType(to) && !(int.includes(normalizedType(from)) && int.includes(normalizedType(to)))) fail('fk-type', `типы ${from.name} и ${to.name} отличаются; проверьте совместимость в PostgreSQL.`, 'warning')
      if ([fk.onDelete, fk.onUpdate].includes('SET NULL') && (!from.nullable || from.primaryKey || from.identity || /serial$/.test(from.dataType))) fail('fk-set-null', `SET NULL несовместим с NOT NULL у ${from.name}.`)
      if ([fk.onDelete, fk.onUpdate].includes('SET DEFAULT') && !from.defaultValue.trim()) fail('fk-default', `для ${from.name} не задан DEFAULT; проверьте результат действия SET DEFAULT.`, 'warning')
    })
    if (!isCandidateKey(s.table, fk.columns) && !s.table.indexes.some(i => !i.predicate && fk.columns.every((id, n) => i.columns[n] === id))) fail('fk-index', 'индекс на ссылающихся колонках не задан.', 'warning')
  }
  return issues
}
