import { beforeEach, describe, expect, it } from 'vitest'
import { addRecentRepo, getRecentRepos, removeRecentRepo } from './recentRepos'

// Mock mínimo en memoria: no asumimos que el entorno de test traiga localStorage
// real (jsdom no está instalado; esto es intencionadamente independiente de eso).
function installMemoryLocalStorage() {
  const store = new Map<string, string>()
  ;(globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: () => null,
    get length() {
      return store.size
    },
  } as Storage
}

beforeEach(() => {
  installMemoryLocalStorage()
})

describe('recentRepos', () => {
  it('starts empty', () => {
    expect(getRecentRepos()).toEqual([])
  })

  it('adds a repo to the front', () => {
    addRecentRepo('/a')
    const result = addRecentRepo('/b')
    expect(result).toEqual(['/b', '/a'])
  })

  it('moves an existing entry to the front instead of duplicating it', () => {
    addRecentRepo('/a')
    addRecentRepo('/b')
    const result = addRecentRepo('/a')
    expect(result).toEqual(['/a', '/b'])
  })

  it('caps the list at 8 entries, dropping the oldest', () => {
    for (let i = 0; i < 10; i++) addRecentRepo(`/repo-${i}`)
    const result = getRecentRepos()
    expect(result).toHaveLength(8)
    expect(result[0]).toBe('/repo-9')
    expect(result).not.toContain('/repo-0')
    expect(result).not.toContain('/repo-1')
  })

  it('ignores blank input', () => {
    addRecentRepo('/a')
    const result = addRecentRepo('   ')
    expect(result).toEqual(['/a'])
  })

  it('removeRecentRepo removes just that entry', () => {
    addRecentRepo('/a')
    addRecentRepo('/b')
    const result = removeRecentRepo('/a')
    expect(result).toEqual(['/b'])
  })
})
