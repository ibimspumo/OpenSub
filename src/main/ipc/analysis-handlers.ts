import { ipcMain, IpcMainInvokeEvent, app } from 'electron'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { OpenRouterService, WordTimingRequest, WordTimingResult } from '../services/OpenRouterService'
import { FFmpegService } from '../services/FFmpegService'
import { IPC_CHANNELS } from '../../shared/types'
import type { Subtitle, AnalysisConfig } from '../../shared/types'
import { getMainWindow } from '../index'

let analysisService: OpenRouterService | null = null
const ffmpegService = new FFmpegService()

interface AnalyzeParams {
  videoPath: string
  subtitles: Subtitle[]
  config: AnalysisConfig
}

export function registerAnalysisHandlers(): void {
  // Analyze subtitles with AI
  ipcMain.handle(
    IPC_CHANNELS.AI_ANALYZE,
    async (_event: IpcMainInvokeEvent, params: AnalyzeParams) => {
      const { videoPath, subtitles, config } = params
      const mainWindow = getMainWindow()

      // Get API key from environment (loaded via dotenv in main process)
      const apiKey = config.apiKey || process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OpenRouter API-Key nicht gefunden. Bitte OPENROUTER_API_KEY in .env Datei konfigurieren.')
      }

      // 1. Extract MP3
      mainWindow?.webContents.send(IPC_CHANNELS.AI_PROGRESS, {
        stage: 'extracting',
        percent: 5,
        message: 'Audio wird extrahiert...'
      })

      const tempDir = app.getPath('temp')
      const mp3Path = join(tempDir, `opensub_analysis_${Date.now()}.mp3`)

      try {
        await ffmpegService.extractAudioAsMP3(videoPath, mp3Path)

        // 2. Create analysis service and start analysis
        analysisService = new OpenRouterService({
          apiKey,
          model: config.model
        })

        // Forward progress events to renderer
        analysisService.on('progress', (progress) => {
          mainWindow?.webContents.send(IPC_CHANNELS.AI_PROGRESS, progress)
        })

        const result = await analysisService.analyze(mp3Path, subtitles, config.language)

        // 3. Cleanup temp file
        try {
          await unlink(mp3Path)
        } catch {
          // Ignore cleanup errors
        }

        return result
      } catch (error) {
        // Cleanup on error
        try {
          await unlink(mp3Path)
        } catch {
          // Ignore cleanup errors
        }

        mainWindow?.webContents.send(IPC_CHANNELS.AI_PROGRESS, {
          stage: 'error',
          percent: 0,
          message: error instanceof Error ? error.message : 'Analyse fehlgeschlagen'
        })

        throw error
      }
    }
  )

  // Cancel analysis
  ipcMain.handle(IPC_CHANNELS.AI_CANCEL, async () => {
    if (analysisService) {
      analysisService.cancel()
      analysisService = null
    }
  })

  // Get word timing from Gemini (fallback when WhisperX alignment fails)
  ipcMain.handle(
    IPC_CHANNELS.AI_WORD_TIMING,
    async (_event: IpcMainInvokeEvent, params: WordTimingRequest): Promise<WordTimingResult> => {
      // Get API key
      const apiKey = process.env.OPENROUTER_API_KEY
      if (!apiKey) {
        throw new Error('OpenRouter API-Key nicht gefunden. Bitte OPENROUTER_API_KEY in .env Datei konfigurieren.')
      }

      // Create service instance for this request (use same model as analysis)
      const service = new OpenRouterService({
        apiKey,
        model: 'google/gemini-3-flash-preview'
      })

      return service.getWordTimings(params)
    }
  )
}

export function cleanupAnalysisService(): void {
  if (analysisService) {
    analysisService.cancel()
    analysisService = null
  }
}
