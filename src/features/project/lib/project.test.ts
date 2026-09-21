import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createEmptyProject } from './projectFactory'
import { parseProjectJson, serializeProject } from './projectFile'
import { deleteStoredProject, listStoredProjects, migrateLegacyProject, saveProjectToStorage } from './projectStorage'
import { LOCAL_STORAGE_PROJECT_KEY } from '@/entities/idef0/constants'

beforeEach(async () => {
  const map = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (key: string) => map.get(key) ?? null, setItem: (key: string, value: string) => map.set(key, value), removeItem: (key: string) => map.delete(key) })
  for (const project of await listStoredProjects()) await deleteStoredProject(project.id)
})
describe('Project files', () => {
  it('roundtrips the current format and migrates v1', () => {
    const project = createEmptyProject()
    expect(parseProjectJson(serializeProject(project))).toEqual(project)
    const legacy = JSON.parse(serializeProject(project))
    legacy.version = '1.0.0'; delete legacy.diagrams[0].type
    expect(parseProjectJson(JSON.stringify(legacy)).diagrams[0]?.type).toBe('idef0')
    expect(parseProjectJson(JSON.stringify(legacy)).version).toBe('3.0.0')
  })
  it('rejects unknown versions, malformed data, orphan references and cycles', () => {
    const project = createEmptyProject()
    expect(() => parseProjectJson('{}')).toThrow()
    expect(() => parseProjectJson(JSON.stringify({ ...project, version: '99.0.0' }))).toThrow()
    project.diagrams[0]!.parentDiagramId = project.rootDiagramId
    expect(() => parseProjectJson(serializeProject(project))).toThrow()
    project.diagrams[0]!.parentDiagramId = null
    project.diagrams[0]!.arrows.push({ id: 'edge', source: 'absent', target: 'absent', sourceHandle: 'a', targetHandle: 'b', arrowType: 'input', label: '' })
    expect(() => parseProjectJson(serializeProject(project))).toThrow()
  })
})
describe('IndexedDB', () => {
  it('stores multiple projects and only deletes the selected project', async () => {
    const a = createEmptyProject(), b = createEmptyProject()
    await saveProjectToStorage(a); await saveProjectToStorage(b)
    expect(await listStoredProjects()).toHaveLength(2)
    await deleteStoredProject(a.id)
    expect((await listStoredProjects())[0]?.id).toBe(b.id)
  })
  it('migrates once without overwriting an existing project', async () => {
    const project = createEmptyProject()
    localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, serializeProject(project))
    await migrateLegacyProject()
    expect(localStorage.getItem(LOCAL_STORAGE_PROJECT_KEY)).toBeNull()
    await saveProjectToStorage({ ...project, name: 'Новая версия' })
    localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, serializeProject(project))
    await migrateLegacyProject()
    expect((await listStoredProjects())[0]?.name).toBe('Новая версия')
  })
  it('keeps malformed legacy drafts intact', async () => {
    localStorage.setItem(LOCAL_STORAGE_PROJECT_KEY, '{broken')
    await expect(migrateLegacyProject()).rejects.toThrow()
    expect(localStorage.getItem(LOCAL_STORAGE_PROJECT_KEY)).toBe('{broken')
  })
})
