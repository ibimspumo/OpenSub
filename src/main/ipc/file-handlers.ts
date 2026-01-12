import { ipcMain, dialog, app } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getMainWindow } from '../index'

export function registerFileHandlers(): void {
  // Select video file
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_VIDEO, async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Video auswählen',
      properties: ['openFile'],
      filters: [
        {
          name: 'Video',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']
        },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Select output file location
  ipcMain.handle(
    IPC_CHANNELS.FILE_SELECT_OUTPUT,
    async (_event, defaultName: string) => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return null

      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Video speichern',
        defaultPath: defaultName,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
          { name: 'MOV Video', extensions: ['mov'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      return result.filePath
    }
  )

  // Get app path
  ipcMain.handle(IPC_CHANNELS.FILE_GET_APP_PATH, async () => {
    return app.getAppPath()
  })
}
