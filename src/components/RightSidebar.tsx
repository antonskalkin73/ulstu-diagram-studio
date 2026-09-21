import { flowchartShapes, type FlowchartShape } from '@/types/flowchart'
import { getArrowLabel } from '@/features/diagram/lib/diagramGeometry'
import { CommitInput } from './CommitInput'
import { ArrowRightLeft, Box, GitBranchPlus } from 'lucide-react'
import { useShallow } from 'zustand/react/shallow'
import { ARROW_TYPE_LABELS } from '@/entities/idef0/constants'
import { useCurrentDiagram, useIdef0Store } from '@/features/diagram/model/useIdef0Store'

export const RightSidebar = () => {
  const diagram = useCurrentDiagram()
  const { selectedElement, updateNode, updateArrow, updateDiagramTitle, openDecomposition } = useIdef0Store(
    useShallow((state) => ({
      selectedElement: state.selectedElement,
      updateNode: state.updateNode,
      updateArrow: state.updateArrow,
      updateDiagramTitle: state.updateDiagramTitle,
      openDecomposition: state.openDecomposition,
    })),
  )

  const selectedNode =
    selectedElement?.kind === 'node' ? diagram?.nodes.find((node) => node.id === selectedElement.id) : undefined
  const selectedArrow =
    selectedElement?.kind === 'arrow' ? diagram?.arrows.find((arrow) => arrow.id === selectedElement.id) : undefined

  return (
    <aside className="inspector" aria-label="Свойства">
      <section className="rounded-xl border border-slate-200 p-4">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-900">
          {selectedNode ? <Box className="h-4 w-4" /> : selectedArrow ? <ArrowRightLeft className="h-4 w-4" /> : <GitBranchPlus className="h-4 w-4" />}
          {selectedNode
            ? selectedNode.kind !== 'boundaryPort'
              ? 'Свойства блока'
              : 'Свойства интерфейса'
            : selectedArrow
              ? 'Свойства стрелки'
              : 'Свойства диаграммы'}
        </div>

        {selectedNode ? (
          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block">Имя</span>
              <CommitInput
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder={selectedNode.kind === 'flowchart' ? flowchartShapes[selectedNode.shape ?? 'process'].title : 'Название функции'}
                value={selectedNode.name}
                onCommit={(value) => updateNode(selectedNode.id, { name: value })}
              />
            </label>
            {selectedNode.kind === 'flowchart' ? (
              <label className="block text-sm text-slate-600"><span className="mb-1 block">Фигура</span>
                <select aria-label="Фигура" className="w-full rounded-lg border border-slate-300 px-3 py-2" value={selectedNode.shape} onChange={e => useIdef0Store.getState().setFlowchartShape(selectedNode.id, e.target.value as FlowchartShape)}>
                  {Object.entries(flowchartShapes).map(([key, item]) => <option key={key} value={key}>{item.title}</option>)}
                </select>
              </label>
            ) : selectedNode.kind === 'function' ? (
              <label className="block text-sm text-slate-600">
                <span className="mb-1 block">Номер узла</span>
                <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={selectedNode.nodeNumber ?? ''} disabled />
              </label>
            ) : (
              <label className="block text-sm text-slate-600">
                <span className="mb-1 block">Тип интерфейса</span>
                <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={ARROW_TYPE_LABELS[selectedNode.boundaryRole ?? 'input']} disabled />
              </label>
            )}
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block">Заметки</span>
              <CommitInput multiline
                className="min-h-24 w-full rounded-lg border border-slate-300 px-3 py-2"
                value={selectedNode.notes ?? ''}
                onCommit={(value) => updateNode(selectedNode.id, { notes: value })}
              />
            </label>
            {selectedNode.kind === 'function' ? (
              <button
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white"
                onClick={() => openDecomposition(selectedNode.id)}
              >
                {selectedNode.childDiagramId ? 'Открыть декомпозицию' : 'Создать декомпозицию'}
              </button>
            ) : null}
          </div>
        ) : selectedArrow ? (
          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block">Подпись</span>
              <CommitInput
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Подпись стрелки"
                value={diagram ? getArrowLabel(selectedArrow, diagram) : selectedArrow.label}
                onCommit={(value) => updateArrow(selectedArrow.id, { label: value })}
              />
            </label>
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block">Смещение маршрута</span>
              <input type="range" min="-200" max="200" step="10" defaultValue={selectedArrow.routeOffset ?? 0}
                key={selectedArrow.id + ':' + (selectedArrow.routeOffset ?? 0)}
                onPointerUp={event => updateArrow(selectedArrow.id, { routeOffset: Number(event.currentTarget.value) })}
                onKeyUp={event => updateArrow(selectedArrow.id, { routeOffset: Number(event.currentTarget.value) })} />
            </label>
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block">Тип стрелки</span>
              <input className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" value={(selectedArrow.arrowType === 'sequence' || selectedArrow.arrowType === 'relation') ? 'Переход' : ARROW_TYPE_LABELS[selectedArrow.arrowType]} disabled />
            </label>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm text-slate-600">
              <span className="mb-1 block">Название диаграммы</span>
              <CommitInput
                className="w-full rounded-lg border border-slate-300 px-3 py-2"
                value={diagram?.title ?? ''}
                onCommit={updateDiagramTitle}
              />
            </label>
            <div className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              <div className="font-medium text-slate-900">{diagram?.type === 'flowchart' ? 'Блок-схема алгоритма' : diagram?.isContext ? 'Контекстная диаграмма' : 'Декомпозиция'}</div>
              {diagram?.type === 'idef0' ? <div className="mt-1">Номер узла: {diagram.nodeNumber}</div> : <div className="mt-1">Подписывайте ветви условия, например «Да» и «Нет». Ctrl+D — копия, Delete — удалить.</div>}
            </div>
          </div>
        )}
      </section>

    </aside>
  )
}
