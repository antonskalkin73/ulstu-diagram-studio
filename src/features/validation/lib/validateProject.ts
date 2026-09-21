import { validateFlowchart } from '@/features/flowchart/validateFlowchart'
import type { EditorProject, ValidationIssue } from '@/types/diagram'
import {
  getDiagramById,
  getIncomingArrows,
  getNodeById,
  getOutgoingArrows,
  isArrowSemanticallyValid,
} from '@/utils/idef0'

export const validateProject = (project: EditorProject): ValidationIssue[] => {
  const issues: ValidationIssue[] = []

  project.diagrams.forEach((diagram) => {
    if (diagram.type === 'flowchart') { issues.push(...validateFlowchart(diagram)); return }
    diagram.nodes.forEach((node) => {
      if (node.kind === 'function') {
        if (!node.name.trim()) {
          issues.push({
            id: `${diagram.id}-${node.id}-missing-name`,
            severity: 'error',
            code: 'function-name-required',
            message: 'Функциональный блок должен иметь имя.',
            diagramId: diagram.id,
            elementId: node.id,
            elementType: 'node',
          })
        }

        if (getOutgoingArrows(diagram, node.id).length === 0) {
          issues.push({
            id: `${diagram.id}-${node.id}-no-output`,
            severity: 'warning',
            code: 'function-without-output',
            message: `У блока ${node.nodeNumber ?? node.name} нет Output.`,
            diagramId: diagram.id,
            elementId: node.id,
            elementType: 'node',
          })
        }

        if (getIncomingArrows(diagram, node.id, 'control').length === 0) {
          issues.push({
            id: `${diagram.id}-${node.id}-no-control`,
            severity: 'warning',
            code: 'function-without-control',
            message: `У блока ${node.nodeNumber ?? node.name} нет Control.`,
            diagramId: diagram.id,
            elementId: node.id,
            elementType: 'node',
          })
        }

        if (getIncomingArrows(diagram, node.id, 'mechanism').length === 0) {
          issues.push({
            id: `${diagram.id}-${node.id}-no-mechanism`,
            severity: 'warning',
            code: 'function-without-mechanism',
            message: `У блока ${node.nodeNumber ?? node.name} нет Mechanism.`,
            diagramId: diagram.id,
            elementId: node.id,
            elementType: 'node',
          })
        }
      }

      if (node.childDiagramId && !getDiagramById(project.diagrams, node.childDiagramId)) {
        issues.push({
          id: `${diagram.id}-${node.id}-missing-child`,
          severity: 'error',
          code: 'missing-child-diagram',
          message: 'Узел ссылается на несуществующую диаграмму декомпозиции.',
          diagramId: diagram.id,
          elementId: node.id,
          elementType: 'node',
        })
      }
    })

    diagram.arrows.forEach((arrow) => {
      const source = getNodeById(diagram, arrow.source)
      const target = getNodeById(diagram, arrow.target)

      if (!source || !target) {
        issues.push({
          id: `${diagram.id}-${arrow.id}-missing-endpoint`,
          severity: 'error',
          code: 'arrow-endpoint-missing',
          message: 'Стрелка ссылается на отсутствующий узел.',
          diagramId: diagram.id,
          elementId: arrow.id,
          elementType: 'arrow',
        })
        return
      }

      if (!isArrowSemanticallyValid(source, target, arrow.arrowType, arrow.sourceHandle, arrow.targetHandle)) {
        issues.push({
          id: `${diagram.id}-${arrow.id}-invalid-semantics`,
          severity: project.settings.strictMode ? 'error' : 'warning',
          code: 'arrow-invalid-side',
          message: 'Стрелка подключена не к допустимой стороне IDEF0.',
          diagramId: diagram.id,
          elementId: arrow.id,
          elementType: 'arrow',
        })
      }

      if (!arrow.label.trim()) {
        issues.push({
          id: `${diagram.id}-${arrow.id}-missing-label`,
          severity: 'warning',
          code: 'arrow-empty-label',
          message: 'Подпись стрелки не заполнена.',
          diagramId: diagram.id,
          elementId: arrow.id,
          elementType: 'arrow',
        })
      }
    })
  })

  return issues
}
