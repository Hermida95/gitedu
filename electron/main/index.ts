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
