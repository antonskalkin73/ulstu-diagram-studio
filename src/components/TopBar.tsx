import { ArrowLeft, Download, PanelLeft, PanelRight, Redo2, Undo2 } from 'lucide-react'
import { CommitInput } from './CommitInput'
export function TopBar({ name, status, onName, onHome, onSave, onExport, onUndo, onRedo, canUndo, canRedo, onLeft, onRight }: {
  name: string; status: string; onName: (value: string) => void; onHome: () => void; onSave: () => void;
  onExport: (type: 'png' | 'svg' | 'pdf' | 'all') => void; onUndo: () => void; onRedo: () => void;
  canUndo: boolean; canRedo: boolean; onLeft: () => void; onRight: () => void
}) {
  return <header className="editor-header">
    <button className="icon-button" onClick={onHome} title="Все проекты" aria-label="Все проекты"><ArrowLeft size={19} /></button>
    <div className="project-heading"><CommitInput value={name} onCommit={onName} aria-label="Название проекта" /><small role="status">{status}</small></div>
    <div className="header-actions">
      <button className="icon-button" onClick={onUndo} disabled={!canUndo} title="Отменить · Ctrl+Z" aria-label="Отменить"><Undo2 size={17} /></button>
      <button className="icon-button" onClick={onRedo} disabled={!canRedo} title="Повторить · Ctrl+Shift+Z" aria-label="Повторить"><Redo2 size={17} /></button>
      <span className="separator" />
      <button className="icon-button" onClick={onLeft} title="Дерево диаграмм" aria-label="Переключить дерево"><PanelLeft size={17} /></button>
      <button className="icon-button" onClick={onRight} title="Свойства" aria-label="Переключить свойства"><PanelRight size={17} /></button>
      <button className="button" onClick={onSave}><Download size={15} /> JSON</button>
      <details className="export-menu"><summary className="button primary">Экспорт</summary><div className="dropdown">
        <button onClick={() => onExport('png')}>Изображение PNG</button><button onClick={() => onExport('svg')}>Векторный SVG</button>
        <button onClick={() => onExport('pdf')}>Диаграмма в PDF</button><button onClick={() => onExport('all')}>Все диаграммы в PDF</button>
      </div></details>
    </div>
  </header>
}
