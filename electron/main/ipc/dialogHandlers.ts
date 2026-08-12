import { BrowserWindow, dialog, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/ipc-contract'

export function registerDialogHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SELECT_REPO_FOLDER, async (event) => {
    const parentWindow = BrowserWindow.fromWebContents(event.sender)
    const options: Electron.OpenDialogOptions = {
      properties: ['openDirectory'],
      title: 'Selecciona un repositorio Git',
    }
    const result = parentWindow
      ? await dialog.showOpenDialog(parentWindow, options)
      : await dialog.showOpenDialog(options)

    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })
}
