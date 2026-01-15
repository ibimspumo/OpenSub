import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { FFmpegService } from '../services/FFmpegService'
import { IPC_CHANNELS } from '../../shared/types'
import type { ExportOptions } from '../../shared/types'
import { getMainWindow } from '../index'
import { debugInfo, debugError } from '../services/DebugService'

const ffmpegService = new FFmpegService()

export function registerFFmpegHandlers(): void {
  // Extract audio from video
  ipcMain.handle(
    IPC_CHANNELS.FFMPEG_EXTRACT_AUDIO,
    async (_event: IpcMainInvokeEvent, videoPath: string, outputPath: string) => {
      debugInfo('ffmpeg', 'EXTRACT_AUDIO called', { videoPath, outputPath })
      try {
        const result = await ffmpegService.extractAudio(videoPath, outputPath)
        debugInfo('ffmpeg', 'EXTRACT_AUDIO completed', { result })
        return result
      } catch (error) {
        debugError('ffmpeg', 'EXTRACT_AUDIO error', { error: String(error) })
        throw error
      }
    }
  )

  // Get video metadata
  ipcMain.handle(
    IPC_CHANNELS.FFMPEG_GET_METADATA,
    async (_event: IpcMainInvokeEvent, videoPath: string) => {
      debugInfo('ffmpeg', 'GET_METADATA called', { videoPath })
      try {
        const result = await ffmpegService.getMetadata(videoPath)
        debugInfo('ffmpeg', 'GET_METADATA completed', { result })
        return result
      } catch (error) {
        debugError('ffmpeg', 'GET_METADATA error', { error: String(error) })
        throw error
      }
    }
  )

  // Export video with burned subtitles
  // Supports two modes:
  // 1. ASS-based: Traditional subtitle burning using libass (subtitlePath provided)
  // 2. Frame-based: Pixel-perfect overlay using pre-rendered PNG frames (options.frameDir provided)
  ipcMain.handle(
    IPC_CHANNELS.FFMPEG_EXPORT,
    async (
      _event: IpcMainInvokeEvent,
      videoPath: string,
      subtitlePath: string,
      options: ExportOptions
    ) => {
      // Set up progress callback
      const onProgress = (progress: { percent: number; fps: number; time: number }) => {
        const mainWindow = getMainWindow()
        if (mainWindow) {
          mainWindow.webContents.send(IPC_CHANNELS.FFMPEG_PROGRESS, progress)
        }
      }

      // Use frame-based rendering if frameDir is provided
      if (options.useFrameRendering && options.frameDir) {
        return ffmpegService.exportWithFrameOverlay(videoPath, options.frameDir, options, onProgress)
      }

      // Fall back to ASS-based rendering
      return ffmpegService.exportWithSubtitles(videoPath, subtitlePath, options, onProgress)
    }
  )

  // Cancel export
  ipcMain.handle(IPC_CHANNELS.FFMPEG_CANCEL, async () => {
    ffmpegService.cancel()
  })
}
