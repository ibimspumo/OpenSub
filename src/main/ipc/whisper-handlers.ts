import { ipcMain, IpcMainInvokeEvent, BrowserWindow } from 'electron'
import { WhisperService } from '../services/WhisperService'
import { IPC_CHANNELS } from '../../shared/types'
import type { WhisperConfig, TranscriptionOptions, TranscriptionProgress, AlignmentRequest } from '../../shared/types'
import { getMainWindow } from '../index'
import { settingsService } from '../services/SettingsService'
import { getWhisperModelName } from '../services/ModelManager'

let whisperService: WhisperService | null = null
let isModelReady = false
let currentModelId: string | null = null  // Track which model is currently loaded

// Get the shared whisper service instance
export function getWhisperService(): WhisperService | null {
  return whisperService
}

// Check if the model is ready
export function isWhisperModelReady(): boolean {
  return isModelReady
}

// Initialize WhisperService at app startup
export async function initializeWhisperServiceAtStartup(): Promise<void> {
  // Get the selected model from settings (defaults to large-v3)
  const selectedModelId = settingsService.getSelectedModelId()
  const whisperModelName = getWhisperModelName(selectedModelId)

  console.log(`Using Whisper model: ${whisperModelName} (from: ${selectedModelId})`)

  const config: WhisperConfig = {
    model: whisperModelName,
    language: 'de',
    device: 'mps'
  }

  whisperService = new WhisperService(config)
  currentModelId = selectedModelId

  // Forward progress events to renderer (for loading screen)
  whisperService.on('progress', (progress: TranscriptionProgress) => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WHISPER_PROGRESS, progress)
    }
  })

  whisperService.on('error', (error: Error) => {
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WHISPER_ERROR, { message: error.message })
    }
  })

  try {
    console.log('Starting WhisperService at app startup...')
    await whisperService.start()
    await whisperService.initialize()
    isModelReady = true

    // Notify renderer that model is ready
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.WHISPER_MODEL_READY, { ready: true })
    }
    console.log('WhisperService initialized successfully')
  } catch (error) {
    console.error('Failed to initialize WhisperService at startup:', error)
    isModelReady = false
    throw error
  }
}

export function registerWhisperHandlers(): void {
  // Start the WhisperX service (kept for compatibility, but model should already be loaded)
  ipcMain.handle(
    IPC_CHANNELS.WHISPER_START,
    async (_event: IpcMainInvokeEvent, config: WhisperConfig) => {
      // If service is already running with model loaded, just return success
      if (whisperService && isModelReady) {
        console.log('WhisperService already running, skipping re-initialization')
        return { status: 'started' }
      }

      console.log('WhisperService not ready, starting fresh...', { hasService: !!whisperService, isModelReady })

      // Otherwise start fresh (fallback)
      if (whisperService) {
        await whisperService.stop()
      }

      whisperService = new WhisperService(config)

      // Forward progress events to renderer
      whisperService.on('progress', (progress) => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.WHISPER_PROGRESS, progress)
        }
      })

      whisperService.on('error', (error) => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.WHISPER_ERROR, { message: error.message })
        }
      })

      await whisperService.start()
      await whisperService.initialize()
      isModelReady = true

      return { status: 'started' }
    }
  )

  // Transcribe audio file
  ipcMain.handle(
    IPC_CHANNELS.WHISPER_TRANSCRIBE,
    async (
      _event: IpcMainInvokeEvent,
      audioPath: string,
      options?: TranscriptionOptions
    ) => {
      if (!whisperService) {
        throw new Error('WhisperService not started')
      }

      return whisperService.transcribe(audioPath, options)
    }
  )

  // Forced alignment for AI corrections
  ipcMain.handle(
    IPC_CHANNELS.WHISPER_ALIGN,
    async (_event: IpcMainInvokeEvent, request: AlignmentRequest) => {
      if (!whisperService) {
        throw new Error('WhisperService not started')
      }

      return whisperService.align(request.audioPath, request.segments)
    }
  )

  // Cancel transcription
  ipcMain.handle(IPC_CHANNELS.WHISPER_CANCEL, async () => {
    if (whisperService) {
      await whisperService.cancel()
    }
  })

  // Get status
  ipcMain.handle(IPC_CHANNELS.WHISPER_STATUS, async () => {
    if (!whisperService) {
      return { initialized: false, processing: false }
    }
    return whisperService.getStatus()
  })

  // Stop service
  ipcMain.handle(IPC_CHANNELS.WHISPER_STOP, async () => {
    if (whisperService) {
      await whisperService.stop()
      whisperService = null
      isModelReady = false
    }
  })

  // Check if model is ready (for startup loading screen)
  ipcMain.handle(IPC_CHANNELS.WHISPER_MODEL_READY, async () => {
    return { ready: isModelReady }
  })
}

export async function cleanupWhisperService(): Promise<void> {
  if (whisperService) {
    await whisperService.stop()
    whisperService = null
    isModelReady = false
    currentModelId = null
  }
}

/**
 * Get the currently loaded model ID
 */
export function getCurrentModelId(): string | null {
  return currentModelId
}

/**
 * Reinitialize WhisperService with a new model.
 * Used when the user changes the model in settings.
 */
export async function reinitializeWithModel(modelId: string): Promise<void> {
  // Stop existing service if running
  await cleanupWhisperService()

  // Save the new model selection
  settingsService.setSelectedModelId(modelId)

  // Reinitialize with the new model
  await initializeWhisperServiceAtStartup()
}
