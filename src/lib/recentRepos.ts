// Lista de repos abiertos recientemente en modo real, persistida en localStorage
// del propio renderer — no toca el disco del sistema ni pasa por Electron para
// esto, es una simple lista de conveniencia para no tener que re-escribir o
// re-buscar la ruta cada vez que se abre la app.
const STORAGE_KEY = 'gitedu.recentRepos'
const MAX_ENTRIES = 8

function readStorage(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === 'string') : []
  } catch {
    return []
  }
}

function writeStorage(paths: string[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(paths))
  } catch {
    // localStorage puede fallar (modo privado, cuota llena...); la lista de
    // recientes es pura conveniencia, así que un fallo aquí no debe romper nada.
  }
}

export function getRecentRepos(): string[] {
  return readStorage()
}

export function addRecentRepo(path: string): string[] {
  const trimmed = path.trim()
  if (!trimmed) return readStorage()
  const withoutDuplicate = readStorage().filter((p) => p !== trimmed)
  const updated = [trimmed, ...withoutDuplicate].slice(0, MAX_ENTRIES)
  writeStorage(updated)
  return updated
}

export function removeRecentRepo(path: string): string[] {
  const updated = readStorage().filter((p) => p !== path)
  writeStorage(updated)
  return updated
}
