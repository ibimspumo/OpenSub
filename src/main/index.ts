import { app, shell, BrowserWindow, ipcMain, dialog, protocol } from 'electron'
import { join } from 'path'
import { createReadStream, statSync, ReadStream } from 'fs'
import { lookup } from 'mime-types'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { config } from 'dotenv'
import { registerWhisperHandlers, cleanupWhisperService, initializeWhisperServiceAtStartup } from './ipc/whisper-handlers'
import { registerFFmpegHandlers } from './ipc/ffmpeg-handlers'
import { registerFileHandlers } from './ipc/file-handlers'
import { registerProjectHandlers, cleanupProjectHandlers } from './ipc/project-handlers'
import { registerAnalysisHandlers, cleanupAnalysisService } from './ipc/analysis-handlers'
import { registerSettingsHandlers } from './ipc/settings-handlers'
import { registerModelHandlers } from './ipc/model-handlers'
import { registerDebugHandlers } from './ipc/debug-handlers'
import { debugInfo, debugError, getDebugService } from './services/DebugService'
import { IPC_CHANNELS } from '../shared/types'

// Load .env file
config({ path: join(app.getAppPath(), '.env') })

// Track active media streams to prevent memory leaks
// Key: filePath, Value: Set of active streams for that file
const activeMediaStreams = new Map<string, Set<ReadStream>>()
const MAX_STREAMS_PER_FILE = 5 // Limit concurrent streams per file

/**
 * Clean up old streams for a file when too many are open
 */
function cleanupOldStreams(filePath: string): void {
  const streams = activeMediaStreams.get(filePath)
  if (!streams) return

  // If we have too many streams, destroy the oldest ones
  if (streams.size >= MAX_STREAMS_PER_FILE) {
    const streamsArray = Array.from(streams)
    // Destroy all but the newest stream
    for (let i = 0; i < streamsArray.length - 1; i++) {
      const stream = streamsArray[i]
      try {
        stream.destroy()
        streams.delete(stream)
      } catch {
        // Ignore errors when destroying streams
      }
    }
  }
}

/**
 * Register a new stream and track it
 */
function trackStream(filePath: string, stream: ReadStream): void {
  cleanupOldStreams(filePath)

  let streams = activeMediaStreams.get(filePath)
  if (!streams) {
    streams = new Set()
    activeMediaStreams.set(filePath, streams)
  }
  streams.add(stream)

  // Auto-remove stream when it ends or errors
  const cleanup = () => {
    streams?.delete(stream)
    if (streams?.size === 0) {
      activeMediaStreams.delete(filePath)
    }
  }

  stream.once('end', cleanup)
  stream.once('error', cleanup)
  stream.once('close', cleanup)
}

/**
 * Clean up all streams for a specific file
 */
export function cleanupMediaStreams(filePath?: string): void {
  if (filePath) {
    const streams = activeMediaStreams.get(filePath)
    if (streams) {
      for (const stream of streams) {
        try {
          stream.destroy()
        } catch {
          // Ignore errors
        }
      }
      activeMediaStreams.delete(filePath)
    }
  } else {
    // Clean up all streams
    for (const [, streams] of activeMediaStreams) {
      for (const stream of streams) {
        try {
          stream.destroy()
        } catch {
          // Ignore errors
        }
      }
    }
    activeMediaStreams.clear()
  }
}

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
    debugInfo('main', 'Window ready-to-show event fired')
    mainWindow?.show()

    // Log app status at startup
    const debugService = getDebugService()
    const status = debugService.getStatus()
    debugInfo('main', 'App starting - full status', status)

    // Start loading AI model after window is shown
    // This allows the loading screen to display progress
    debugInfo('main', 'Calling initializeWhisperServiceAtStartup...')
    initializeWhisperServiceAtStartup()
      .then(() => {
        debugInfo('main', 'initializeWhisperServiceAtStartup completed successfully')
        debugService.setWhisperStatus(true, true)
      })
      .catch((error) => {
        const errorMessage = error instanceof Error ? error.message : String(error)
        debugError('main', 'initializeWhisperServiceAtStartup FAILED', { error: errorMessage, stack: error?.stack })
        debugService.setWhisperStatus(false, false)

        // Send error to renderer so it can display it
        if (mainWindow && !mainWindow.isDestroyed()) {
          debugInfo('main', 'Sending WHISPER_ERROR with fatal=true to renderer')
          mainWindow.webContents.send(IPC_CHANNELS.WHISPER_ERROR, {
            message: `Python-Service konnte nicht gestartet werden: ${errorMessage}`,
            fatal: true
          })
        }
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

  // Register protocol handler for local media files with Range request support
  // This is CRITICAL for video seeking to work properly
  protocol.handle('media', async (request) => {
    const filePath = decodeURIComponent(request.url.replace('media://', ''))

    try {
      const stat = statSync(filePath)
      const fileSize = stat.size
      const mimeType = lookup(filePath) || 'application/octet-stream'

      // Check for Range header (required for video seeking)
      const rangeHeader = request.headers.get('range')

      if (rangeHeader) {
        // Parse Range header: "bytes=start-end" or "bytes=start-"
        const match = rangeHeader.match(/bytes=(\d+)-(\d*)/)
        if (match) {
          const start = parseInt(match[1], 10)
          const end = match[2] ? parseInt(match[2], 10) : fileSize - 1
          const chunkSize = end - start + 1

          // Create a stream for the requested range
          const stream = createReadStream(filePath, { start, end })

          // Track the stream to prevent memory leaks
          trackStream(filePath, stream)

          // Convert Node.js stream to Web ReadableStream
          const webStream = new ReadableStream({
            start(controller) {
              stream.on('data', (chunk: Buffer) => {
                controller.enqueue(new Uint8Array(chunk))
              })
              stream.on('end', () => {
                controller.close()
              })
              stream.on('error', (err) => {
                stream.destroy()
                controller.error(err)
              })
            },
            cancel() {
              stream.destroy()
            }
          })

          // Return 206 Partial Content response
          return new Response(webStream, {
            status: 206,
            headers: {
              'Content-Type': mimeType,
              'Content-Length': String(chunkSize),
              'Content-Range': `bytes ${start}-${end}/${fileSize}`,
              'Accept-Ranges': 'bytes'
            }
          })
        }
      }

      // No Range header - return full file
      const stream = createReadStream(filePath)

      // Track the stream to prevent memory leaks
      trackStream(filePath, stream)

      const webStream = new ReadableStream({
        start(controller) {
          stream.on('data', (chunk: Buffer) => {
            controller.enqueue(new Uint8Array(chunk))
          })
          stream.on('end', () => {
            controller.close()
          })
          stream.on('error', (err) => {
            stream.destroy()
            controller.error(err)
          })
        },
        cancel() {
          stream.destroy()
        }
      })

      return new Response(webStream, {
        status: 200,
        headers: {
          'Content-Type': mimeType,
          'Content-Length': String(fileSize),
          'Accept-Ranges': 'bytes'
        }
      })
    } catch (error) {
      console.error('Media protocol error:', error)
      return new Response('File not found', { status: 404 })
    }
  })

  // Default open or close DevTools by F12 in development
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Register IPC handlers
  registerDebugHandlers()  // Register debug first so other handlers can log
  registerWhisperHandlers()
  registerFFmpegHandlers()
  registerFileHandlers()
  registerProjectHandlers()
  registerAnalysisHandlers()
  registerSettingsHandlers()
  registerModelHandlers()

  debugInfo('main', 'All IPC handlers registered')

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
  cleanupMediaStreams() // Clean up all media streams

  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// Handle app quit
app.on('before-quit', async () => {
  await cleanupWhisperService()
  cleanupMediaStreams() // Clean up all media streams
})

// Export mainWindow for IPC handlers
export function getMainWindow(): BrowserWindow | null {
  return mainWindow
}
