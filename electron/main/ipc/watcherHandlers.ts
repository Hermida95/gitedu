import fs from 'node:fs'
import path from 'node:path'
import { ipcMain, type BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-contract'

// Un único watcher activo a la vez: cada vez que se carga un repo distinto,
// se cierra el anterior y se abre uno nuevo apuntando a su .git.
let activeWatcher: fs.FSWatcher | null = null
let debounceTimer: ReturnType<typeof setTimeout> | null = null

// Se llama al cerrar la ventana: si no, el watcher (y su timer pendiente) sigue
// vivo sin nadie escuchando, y cuando el timer dispara intenta usar una ventana
// ya destruida -> "TypeError: Object has been destroyed" sin capturar.
export function stopWatcher(): void {
  activeWatcher?.close()
  activeWatcher = null
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = null
}

export function registerWatcherHandlers(getWindow: () => BrowserWindow | null): void {
  ipcMain.handle(IPC_CHANNELS.WATCH_REPO, (_event, repoPath: string): boolean => {
    stopWatcher()

    const gitDir = path.join(repoPath, '.git')
    if (!fs.existsSync(gitDir)) return false

    try {
      // recursive:true solo está soportado de forma nativa en macOS y Windows;
      // en Linux fs.watch lanza y caemos al catch (el usuario siempre puede recargar a mano).
      activeWatcher = fs.watch(gitDir, { recursive: true }, () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
          // isDestroyed(): defensa extra además de anular mainWindow al cerrarla —
          // por si en el futuro hay más de una ventana con ciclos de vida propios.
          const win = getWindow()
          if (win && !win.isDestroyed()) {
            win.webContents.send(IPC_CHANNELS.REPO_CHANGED_EVENT)
          }
        }, 400)
      })
      return true
    } catch {
      return false
    }
  })
}
