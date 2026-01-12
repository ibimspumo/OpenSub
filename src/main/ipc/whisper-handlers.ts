import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { WhisperService } from '../services/WhisperService'
import { IPC_CHANNELS } from '../../shared/types'
import type { WhisperConfig, TranscriptionOptions } from '../../shared/types'
import { getMainWindow } from '../index'

let whisperService: WhisperService | null = null

export function registerWhisperHandlers(): void {
  // Start the WhisperX service
  ipcMain.handle(
    IPC_CHANNELS.WHISPER_START,
    async (_event: IpcMainInvokeEvent, config: WhisperConfig) => {
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
    }
  })
}

export async function cleanupWhisperService(): Promise<void> {
  if (whisperService) {
    await whisperService.stop()
    whisperService = null
  }
}
