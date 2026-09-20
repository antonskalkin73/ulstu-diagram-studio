import type { IDEF0Project } from '@/types/idef0'
import { LOCAL_STORAGE_PROJECT_KEY, LOCAL_STORAGE_PENDING_KEY } from '@/entities/idef0/constants'
import { parseProjectJson } from './projectFile'

const DB_NAME = 'diagram-studio'
const STORE = 'projects'

const openDatabase = (): Promise<IDBDatabase> => new Promise((resolve, reject) => {
  const request = indexedDB.open(DB_NAME, 1)
  request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' })
  request.onsuccess = () => { request.result.onversionchange = () => request.result.close(); resolve(request.result) }
  request.onerror = () => reject(request.error)
  request.onblocked = () => reject(new Error('Закройте другие вкладки редактора и повторите попытку'))
})

async function transact<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDatabase()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, mode)
    let request: IDBRequest<T>
    try { request = operation(tx.objectStore(STORE)) }
    catch (error) { tx.abort(); db.close(); reject(error); return }
    tx.oncomplete = () => { db.close(); resolve(request.result) }
    tx.onabort = () => { db.close(); reject(tx.error ?? request.error ?? new Error('Не удалось сохранить проект')) }
    tx.onerror = () => { /* onabort reports transaction failure */ }
  })
}

export const saveProjectToStorage = async (project: IDEF0Project): Promise<void> => {
  await transact('readwrite', store => store.put(project))
}
export const listStoredProjects = async (): Promise<IDEF0Project[]> => {
  const rows = await transact('readonly', store => store.getAll())
  return rows.map(row => parseProjectJson(JSON.stringify(row))).sort((a, b) => b.meta.updatedAt.localeCompare(a.meta.updatedAt))
}
export const deleteStoredProject = async (id: string): Promise<void> => {
  await transact('readwrite', store => store.delete(id))
}

// The old draft is removed only after a successful transaction. Existing projects win.
export const migrateLegacyProject = async (): Promise<void> => {
  const raw = localStorage.getItem(LOCAL_STORAGE_PROJECT_KEY)
  if (!raw) return
  const project = parseProjectJson(raw)
  const existing = await transact('readonly', store => store.get(project.id))
  if (!existing) await saveProjectToStorage(project)
  localStorage.removeItem(LOCAL_STORAGE_PROJECT_KEY)
  localStorage.removeItem(LOCAL_STORAGE_PENDING_KEY)
}
