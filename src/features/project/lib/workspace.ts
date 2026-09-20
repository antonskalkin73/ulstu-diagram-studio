import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Viewport } from '@xyflow/react'

interface Workspace {
  tabs: Record<string, string[]>
  viewports: Record<string, Viewport>
  left: boolean
  right: boolean
  open: (projectId: string, diagramId: string) => void
  close: (projectId: string, diagramId: string) => void
  setViewport: (id: string, viewport: Viewport) => void
  toggleLeft: () => void
  toggleRight: () => void
}
export const useWorkspace = create<Workspace>()(persist((set) => ({
  tabs: {}, viewports: {}, left: true, right: true,
  open: (projectId, diagramId) => set(s => {
    const tabs = s.tabs[projectId] ?? []
    return tabs.includes(diagramId) ? s : { tabs: { ...s.tabs, [projectId]: [...tabs, diagramId] } }
  }),
  close: (projectId, diagramId) => set(s => ({ tabs: { ...s.tabs, [projectId]: (s.tabs[projectId] ?? []).filter(id => id !== diagramId) } })),
  setViewport: (id, viewport) => set(s => ({ viewports: { ...s.viewports, [id]: viewport } })),
  toggleLeft: () => set(s => ({ left: !s.left })),
  toggleRight: () => set(s => ({ right: !s.right })),
}), { name: 'diagram-studio:workspace' }))
