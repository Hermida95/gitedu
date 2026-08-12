import { app, BrowserWindow } from 'electron'
import path from 'node:path'
import { registerGitHandlers } from './ipc/gitHandlers'
import { registerGitActionHandlers } from './ipc/gitActionHandlers'
import { registerDialogHandlers } from './ipc/dialogHandlers'
import { registerWatcherHandlers, stopWatcher } from './ipc/watcherHandlers'

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  // Sin esto, mainWindow se queda apuntando a una ventana ya destruida tras
  // cerrarla, y cualquier código que la use luego (p.ej. el watcher) revienta
  // con "Object has been destroyed" en vez de simplemente no hacer nada.
  mainWindow.on('closed', () => {
    stopWatcher()
    mainWindow = null
  })

  // Endurecimiento defensivo: hoy la UI no renderiza ningún enlace externo, pero
  // sin esto, si alguna vez lo hiciera (o algo consiguiera inyectar uno), la
  // ventana navegaría a contenido remoto arbitrario con el MISMO preload que
  // expone window.gitedu — es decir, esa página remota tendría acceso a leer y
  // escribir cualquier repo git local. Se deniega toda navegación fuera del
  // propio origen de la app y toda apertura de ventanas nuevas.
  const allowedOrigin = process.env.VITE_DEV_SERVER_URL
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isAllowed = allowedOrigin ? url.startsWith(allowedOrigin) : url.startsWith('file://')
    if (!isAllowed) event.preventDefault()
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  registerGitHandlers()
  registerGitActionHandlers()
  registerDialogHandlers()
  registerWatcherHandlers(() => mainWindow)
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
