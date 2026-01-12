import { ipcMain, IpcMainInvokeEvent } from 'electron'
import { FFmpegService } from '../services/FFmpegService'
import { IPC_CHANNELS } from '../../shared/types'
import type { ExportOptions } from '../../shared/types'
import { getMainWindow } from '../index'

const ffmpegService = new FFmpegService()

export function registerFFmpegHandlers(): void {
  // Extract audio from video
  ipcMain.handle(
    IPC_CHANNELS.FFMPEG_EXTRACT_AUDIO,
    async (_event: IpcMainInvokeEvent, videoPath: string, outputPath: string) => {
      return ffmpegService.extractAudio(videoPath, outputPath)
    }
  )

  // Get video metadata
  ipcMain.handle(
    IPC_CHANNELS.FFMPEG_GET_METADATA,
    async (_event: IpcMainInvokeEvent, videoPath: string) => {
      return ffmpegService.getMetadata(videoPath)
    }
  )

  // Export video with burned subtitles
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

      return ffmpegService.exportWithSubtitles(videoPath, subtitlePath, options, onProgress)
    }
  )

  // Cancel export
  ipcMain.handle(IPC_CHANNELS.FFMPEG_CANCEL, async () => {
    ffmpegService.cancel()
  })
}
