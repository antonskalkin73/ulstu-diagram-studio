import type { EditorDiagram, ValidationIssue } from '@/types/diagram'

export function validateFlowchart(diagram: EditorDiagram): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const add = (code: string, message: string, elementId = diagram.id, elementType: 'node' | 'arrow' | 'diagram' = 'node') => {
    issues.push({ id: `${diagram.id}-${elementId}-${code}`, severity: 'warning', code, message, diagramId: diagram.id, elementId, elementType })
  }
  const starts = diagram.nodes.filter(n => n.shape === 'start')
  if (starts.length !== 1) add('flowchart-start', 'У блок-схемы должен быть один блок «Начало».', diagram.id, 'diagram')
  if (!diagram.nodes.some(n => n.shape === 'end')) add('flowchart-end', 'Добавьте блок «Конец».', diagram.id, 'diagram')
  const reachable = new Set(starts.map(n => n.id))
  const queue = [...reachable]
  for (let index = 0; index < queue.length; index++) {
    for (const arrow of diagram.arrows.filter(a => a.source === queue[index])) {
      if (!reachable.has(arrow.target)) { reachable.add(arrow.target); queue.push(arrow.target) }
    }
  }
  for (const node of diagram.nodes) {
    const incoming = diagram.arrows.filter(a => a.target === node.id)
    const outgoing = diagram.arrows.filter(a => a.source === node.id)
    if (!node.name.trim()) add('flowchart-name', 'Заполните текст блока.', node.id)
    if (starts.length && !reachable.has(node.id)) add('flowchart-unreachable', 'Блок недостижим из начала алгоритма.', node.id)
    if (node.shape === 'start' && incoming.length) add('flowchart-start-incoming', 'Блок «Начало» не должен иметь входящих переходов.', node.id)
    if (node.shape === 'end' && outgoing.length) add('flowchart-end-outgoing', 'Блок «Конец» не должен иметь исходящих переходов.', node.id)
    if (node.shape !== 'end' && !outgoing.length) add('flowchart-dead-end', 'Из блока нет перехода к следующему шагу.', node.id)
    if (node.shape === 'decision') {
      if (outgoing.length < 2) add('flowchart-branches', 'Для условия нужны как минимум две ветви.', node.id)
      const labels = new Set<string>()
      for (const arrow of outgoing) {
        const label = arrow.label.trim().toLocaleLowerCase('ru')
        if (!label) add('flowchart-branch-label', 'Подпишите ветвь условия, например «Да» или «Нет».', arrow.id, 'arrow')
        else if (labels.has(label)) add('flowchart-duplicate-label', 'У ветвей условия одинаковые подписи.', arrow.id, 'arrow')
        labels.add(label)
      }
    }
  }
  return issues
}
