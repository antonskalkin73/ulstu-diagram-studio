import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Database, FileUp, GitBranch, Plus, Shapes, Trash2, X } from 'lucide-react'
import { LeftSidebar } from '@/components/LeftSidebar'
import { RightSidebar } from '@/components/RightSidebar'
import { TopBar } from '@/components/TopBar'
import { useIdef0Store } from '@/features/diagram/model/useIdef0Store'
import { downloadProjectJson, parseProjectJson } from '@/features/project/lib/projectFile'
import { deleteStoredProject, listStoredProjects, migrateLegacyProject, saveProjectToStorage } from '@/features/project/lib/projectStorage'
import { useWorkspace } from '@/features/project/lib/workspace'
import { createEmptyProject } from '@/features/project/lib/projectFactory'
import { createId } from '@/utils/id'
import { diagramCatalog } from '@/types/project'
import type { EditorProject } from '@/types/diagram'

const DiagramEditor = lazy(() => import('@/features/diagram/ui/DiagramEditor').then(module => ({ default: module.DiagramEditor })))

const FlowchartEditor = lazy(() => import('@/features/flowchart/FlowchartEditor').then(module => ({ default: module.FlowchartEditor })))

const editable = (target: EventTarget | null) => target instanceof HTMLElement && (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)

export default function App() {
  const state = useIdef0Store()
  const workspace = useWorkspace(useShallow(s => ({ tabs: s.tabs, left: s.left, right: s.right, toggleLeft: s.toggleLeft, toggleRight: s.toggleRight })))
  const [screen, setScreen] = useState<'home' | 'editor'>('home')
  const [projects, setProjects] = useState<EditorProject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saveError, setSaveError] = useState('')
  const [savedProject, setSavedProject] = useState<EditorProject | null>(null)
  const [chooser, setChooser] = useState<'project' | 'diagram' | null>(null)
  const [problems, setProblems] = useState(false)
  const [exporting, setExporting] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const queue = useRef<Promise<void>>(Promise.resolve())
  const activeProject = useRef<string | null>(null)
  const project = state.project
  const current = project.diagrams.find(d => d.id === state.currentDiagramId)
  const tabs = (workspace.tabs[project.id] ?? []).filter(id => project.diagrams.some(d => d.id === id))

  const enqueueSave = (snapshot: EditorProject) => {
    queue.current = queue.current.catch(() => {}).then(() => saveProjectToStorage(snapshot)).then(() => {
      setSavedProject(snapshot)
      setSaveError('')
    }).catch((reason: unknown) => { setSaveError(`Не удалось сохранить проект: ${reason instanceof Error ? reason.message : String(reason)}. Скачайте JSON или повторите сохранение.`) })
  }

  useEffect(() => {
    let cancelled = false
    const initialize = async () => {
      try { await migrateLegacyProject() } catch (e) { if (!cancelled) setError(`Перенос старого черновика: ${e instanceof Error ? e.message : String(e)}. Исходный черновик сохранён.`) }
      try { const rows = await listStoredProjects(); if (!cancelled) setProjects(rows) }
      catch (e) { if (!cancelled) setError(`Не удалось открыть локальные проекты: ${String(e)}`) }
      finally { if (!cancelled) setLoading(false) }
    }
    void initialize()
    return () => { cancelled = true }
  }, [])

  useEffect(() => useIdef0Store.subscribe((next, previous) => {
    if (next.currentDiagramId && (next.currentDiagramId !== previous.currentDiagramId || next.project.id !== previous.project.id)) useWorkspace.getState().open(next.project.id, next.currentDiagramId)
    if (next.project !== previous.project && activeProject.current === next.project.id) enqueueSave(next.project)
  }), [])

  const openProject = (item: EditorProject) => {
    activeProject.current = null
    state.setProject(item)
    activeProject.current = item.id
    useWorkspace.getState().open(item.id, item.rootDiagramId)
    setScreen('editor')
    enqueueSave(item)
  }
  const goHome = async () => {
    // Retry the latest snapshot before changing screens, so failures cannot lose work.
    try {
      await queue.current
      await saveProjectToStorage(useIdef0Store.getState().project)
      setProjects(await listStoredProjects())
      activeProject.current = null
      setScreen('home')
    } catch (e) { setError(`Не удалось сохранить проект: ${String(e)}. Скачайте JSON и повторите попытку.`) }
  }
  const closeTab = (id: string) => {
    useWorkspace.getState().close(project.id, id)
    if (id === state.currentDiagramId) {
      const remaining = tabs.filter(tab => tab !== id)
      const next = remaining.at(-1)
      if (next) state.navigateToDiagram(next)
      else useIdef0Store.setState({ currentDiagramId: '', selection: { nodeIds: [], arrowIds: [] }, selectedElement: null })
    }
  }
  const openDiagram = (id: string) => { useWorkspace.getState().open(project.id, id); state.navigateToDiagram(id) }
  const exportDiagram = async (type: 'png' | 'svg' | 'pdf' | 'all') => {
    if (exporting || (!current && type !== 'all')) return
    setExporting(true)
    try {
      const { exportDiagrams } = await import('@/features/export/lib/exportDiagram')
      await exportDiagrams(type === 'all' ? project.diagrams : [current!], type === 'all' ? 'pdf' : type, project.name)
    } catch (e) { setError(`Ошибка экспорта: ${String(e)}`) }
    finally { setExporting(false) }
  }

  useEffect(() => {
    if (screen !== 'editor') return
    const handler = (event: KeyboardEvent) => {
      if (editable(event.target)) return
      const s = useIdef0Store.getState()
      const mod = event.ctrlKey || event.metaKey
      if (mod && event.key.toLowerCase() === 's') { event.preventDefault(); downloadProjectJson(s.project) }
      if (mod && event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) s.redo(); else s.undo() }
      if (mod && event.key.toLowerCase() === 'c' && s.selection.nodeIds.length) { event.preventDefault(); s.copySelection() }
      if (mod && event.key.toLowerCase() === 'v') { event.preventDefault(); s.pasteSelection() }
      if (mod && event.key.toLowerCase() === 'd') { event.preventDefault(); s.duplicateSelection() }
      if (event.key === 'Delete') { event.preventDefault(); s.deleteSelection() }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [screen])

  useEffect(() => {
    if (screen !== 'editor' || savedProject === project) return
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [project, savedProject, screen])

  useEffect(() => {
    if (!chooser) return
    const previous = document.activeElement as HTMLElement | null
    const trap = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const buttons = Array.from(document.querySelectorAll<HTMLButtonElement>('[role="dialog"] button:not(:disabled)'))
      const first = buttons[0], last = buttons.at(-1)
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', trap)
    return () => { document.removeEventListener('keydown', trap); previous?.focus() }
  }, [chooser])

  return <div className="studio">
    <input ref={fileInput} type="file" accept=".json,application/json" hidden onChange={async event => {
      const file = event.target.files?.[0]
      event.target.value = ''
      if (!file) return
      try {
        const imported = parseProjectJson(await file.text())
        // Import always makes a copy; it never overwrites another local project.
        imported.id = createId('project'); imported.meta.updatedAt = new Date().toISOString()
        openProject(imported)
      } catch (e) { setError(`Не удалось импортировать: ${e instanceof Error ? e.message : String(e)}`) }
    }} />
    {(error || saveError) && <div className="error-banner" role="alert"><span>{error || saveError}</span>{screen === 'editor' && <button onClick={() => { setError(''); enqueueSave(project) }}>Повторить сохранение</button>}<button aria-label="Закрыть сообщение" onClick={() => setError('')}><X size={16} /></button></div>}
    {screen === 'home' ? <main className="home">
      <header className="home-header"><div className="brand"><span className="brand-icon"><Shapes size={23} /></span> Diagram Studio</div><span className="local-badge">Локальное рабочее пространство</span></header>
      <section className="home-intro"><div className="eyebrow">ОТ ИДЕИ К СТРУКТУРЕ</div><h1>Ваши системы.<br /><span>В понятных диаграммах.</span></h1><p>Проектируйте процессы, исследуйте связи и собирайте модели в одном проекте.</p>
        <div className="home-actions"><button className="button primary" onClick={() => setChooser('project')}><Plus size={17} /> Новый проект</button><button className="button" onClick={() => fileInput.current?.click()}><FileUp size={17} /> Открыть JSON</button></div>
      </section>
      <div className="section-heading">Ваши проекты <span>{projects.length}</span></div>
      {loading ? <p role="status">Загрузка проектов…</p> : projects.length === 0 ? <div className="empty-projects"><GitBranch size={28} /><h2>Здесь появятся ваши проекты</h2><p>Создайте первый проект или откройте существующий JSON-файл.</p></div> : <div className="project-grid">{projects.map(item => <article className="project-card" key={item.id}>
        <button className="project-card-open" onClick={() => openProject(item)}><div className="card-preview"><GitBranch size={36} /><span>{[...new Set(item.diagrams.map(d => d.type === 'idef0' ? 'IDEF0' : 'Блок-схема'))].join(' · ')}</span></div><h2>{item.name || 'Без названия'}</h2><p>{item.diagrams.length} диаграмм · {new Date(item.meta.updatedAt).toLocaleDateString('ru-RU')}</p></button>
        <button className="card-delete icon-button" aria-label={`Удалить проект ${item.name}`} onClick={async () => {
          if (!window.confirm(`Удалить локальный проект «${item.name}»? Это действие нельзя отменить.`)) return
          try { await deleteStoredProject(item.id); setProjects(await listStoredProjects()) } catch (e) { setError(String(e)) }
        }}><Trash2 size={15} /></button>
      </article>)}</div>}
      <footer><Database size={15} /> Проекты хранятся в этом браузере. Скачивайте JSON, чтобы переносить их и сохранять резервные копии.</footer>
    </main> : <>
      <TopBar name={project.name} onName={state.setProjectName} status={exporting ? 'Подготовка экспорта…' : saveError ? 'Не удалось сохранить' : savedProject === project ? 'Сохранено в браузере' : 'Сохранение…'} onHome={() => void goHome()} onSave={() => downloadProjectJson(project)} onExport={type => void exportDiagram(type)} onUndo={state.undo} onRedo={state.redo} canUndo={state.past.length > 0} canRedo={state.future.length > 0} onLeft={workspace.toggleLeft} onRight={workspace.toggleRight}>
        <div className="tabs" role="tablist" aria-label="Открытые диаграммы">{tabs.map(id => {
            const diagram = project.diagrams.find(d => d.id === id)!
            return <div className={`tab ${id === state.currentDiagramId ? 'active' : ''}`} key={id}><button role="tab" aria-selected={id === state.currentDiagramId} onClick={() => openDiagram(id)}><span>{diagram.type === 'idef0' ? 'IDEF0' : 'Блок-схема'}</span>{diagram.title}</button><button aria-label={`Закрыть вкладку ${diagram.title}`} onClick={() => closeTab(id)}><X size={13} /></button></div>
          })}<button className="icon-button" onClick={() => setChooser('diagram')} aria-label="Новая диаграмма"><Plus size={17} /></button></div>
      </TopBar>
      <div className="editor-body">
        {workspace.left && <LeftSidebar diagrams={project.diagrams} activeId={state.currentDiagramId} rootId={project.rootDiagramId} onOpen={openDiagram} onAdd={() => setChooser('diagram')} onDelete={id => {
          if (window.confirm('Удалить диаграмму и все её декомпозиции? Действие можно отменить.')) state.deleteDiagram(id)
        }} />}
        <main className="editor-main">
          {current ? <Suspense fallback={<div className="no-diagram" role="status">Загрузка редактора…</div>}>{current.type === 'flowchart' ? <FlowchartEditor key={project.id + current.id} /> : <DiagramEditor key={project.id + current.id} />}</Suspense> : <div className="no-diagram"><Shapes size={40} /><h2>Откройте диаграмму из дерева</h2><p>Закрытые вкладки остаются в проекте.</p><button className="button" onClick={() => openDiagram(project.rootDiagramId)}>Открыть корневую диаграмму</button></div>}
          <div className="problems-panel"><button className="problems-toggle" onClick={() => setProblems(!problems)}>{problems ? '▾' : '▸'} Проверка модели <span>{state.issues.filter(i => i.severity === 'error').length} ошибок</span><span>{state.issues.filter(i => i.severity === 'warning').length} предупреждений</span></button>
            {problems && <div className="problems-list">{state.issues.length === 0 ? <p>Проблем не найдено.</p> : state.issues.map(issue => <button key={issue.id} onClick={() => {
              openDiagram(issue.diagramId)
              state.setSelection({ nodeIds: issue.elementType === 'node' && issue.elementId ? [issue.elementId] : [], arrowIds: issue.elementType === 'arrow' && issue.elementId ? [issue.elementId] : [] })
            }}><span className={issue.severity}>{issue.severity === 'error' ? '●' : '▲'}</span><span>{issue.message}</span><small>{project.diagrams.find(d => d.id === issue.diagramId)?.nodeNumber}</small></button>)}</div>}
          </div>
        </main>
        {workspace.right && current && <RightSidebar key={state.selectedElement?.id ?? current.id} />}
      </div>
    </>}
    {chooser && <div className="modal-backdrop" onClick={() => setChooser(null)}><section className="type-dialog" role="dialog" aria-modal="true" aria-label="Выбор типа диаграммы" onClick={e => e.stopPropagation()} onKeyDown={e => { if (e.key === 'Escape') setChooser(null) }}>
      <div className="dialog-heading"><div><div className="eyebrow">НОВАЯ ДИАГРАММА</div><h2>Что будем проектировать?</h2></div><button className="icon-button" aria-label="Закрыть" autoFocus onClick={() => setChooser(null)}><X size={20} /></button></div>
      {diagramCatalog.map(kind => <button className="type-option" key={kind.type} disabled={!kind.available} onClick={() => {
        if (kind.type === 'er') return
        if (chooser === 'project') openProject(createEmptyProject(kind.type)); else state.addDiagram(kind.type)
        setChooser(null)
      }}><span className="type-symbol">{kind.type === 'er' ? <Database /> : kind.type === 'flowchart' ? <Shapes /> : <GitBranch />}</span><span><strong>{kind.title}</strong><small>{kind.description}</small></span><span className="type-badge">{kind.available ? 'Создать →' : 'Скоро'}</span></button>)}
      <p className="dialog-note">В одном проекте можно сочетать IDEF0 и блок-схемы. Редактор ERD появится позже.</p>
    </section></div>}
  </div>
}
