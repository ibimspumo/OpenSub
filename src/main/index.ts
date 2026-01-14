import { app, shell, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { config } from 'dotenv'
import { registerWhisperHandlers, cleanupWhisperService, initializeWhisperServiceAtStartup } from './ipc/whisper-handlers'
import { registerFFmpegHandlers } from './ipc/ffmpeg-handlers'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerProjectHandlers, cleanupProjectHandlers } from './ipc/project-handlers'
import { registerAnalysisHandlers, cleanupAnalysisService } from './ipc/analysis-handlers'

// Load .env file
config({ path: join(app.getAppPath(), '.env') })

// Register custom protocol for serving local media files
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'media',
    privileges: {
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: true
    }
  }
])

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 15, y: 15 },
    backgroundColor: '#0f172a',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()

    // Start loading AI model after window is shown
    // This allows the loading screen to display progress
    initializeWhisperServiceAtStartup().catch((error) => {
      console.error('Failed to initialize AI model at startup:', error)
    })
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the remote URL for development or the local html file for production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// App lifecycle
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.opensub.editor')

  // Register protocol handler for local media files
  protocol.handle('media', (request) => {
    const filePath = decodeURIComponent(request.url.replace('media://', ''))
    return net.fetch(pathToFileURL(filePath).toString())
  })

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerWhisperHandlers()
  registerFFmpegHandlers()
  registerFileHandlers()
  registerProjectHandlers()
  registerAnalysisHandlers()

  // IPC handler for window maximize toggle (double-click on title bar)
  ipcMain.handle('window:toggleMaximize', () => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize()
      } else {
        win.maximize()
      }
      return win.isMaximized()
    }
    return false
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  // Cleanup services
  await cleanupWhisperService()
  cleanupProjectHandlers()
  cleanupAnalysisService()

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app quit
app.on('before-quit', async () => {
  await cleanupWhisperService()
})

// Export mainWindow for IPC handlers
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
