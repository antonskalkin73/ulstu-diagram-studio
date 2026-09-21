import { create } from 'zustand'
export const useERUI = create<{ editingTable: string | null; editingRelation: string | null; editTable: (id: string | null) => void; editRelation: (id: string | null) => void }>(set => ({
  editingTable: null, editingRelation: null,
  editTable: editingTable => set({ editingTable }), editRelation: editingRelation => set({ editingRelation }),
}))
