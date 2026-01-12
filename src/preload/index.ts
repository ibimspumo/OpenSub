import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type {
  WhisperConfig,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgress,
  VideoMetadata,
  ExportOptions,
  ExportProgress
} from '../shared/types'

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('api', {
  // ============================================
  // Whisper Service
  // ============================================
  whisper: {
    start: (config: WhisperConfig): Promise<{ status: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHISPER_START, config),

    transcribe: (
      audioPath: string,
      options?: TranscriptionOptions
    ): Promise<TranscriptionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHISPER_TRANSCRIBE, audioPath, options),

    cancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_CANCEL),

    getStatus: (): Promise<{ initialized: boolean; processing: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHISPER_STATUS),

    stop: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_STOP),

    onProgress: (callback: (progress: TranscriptionProgress) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: TranscriptionProgress) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.WHISPER_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WHISPER_PROGRESS, handler)
    },

    onError: (callback: (error: { message: string }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: { message: string }) => {
        callback(error)
      }
      ipcRenderer.on(IPC_CHANNELS.WHISPER_ERROR, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WHISPER_ERROR, handler)
    }
  },

  // ============================================
  // FFmpeg Service
  // ============================================
  ffmpeg: {
    extractAudio: (videoPath: string, outputPath: string): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_EXTRACT_AUDIO, videoPath, outputPath),

    getMetadata: (videoPath: string): Promise<VideoMetadata> =>
      ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_GET_METADATA, videoPath),

    exportVideo: (
      videoPath: string,
      subtitlePath: string,
      options: ExportOptions
    ): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_EXPORT, videoPath, subtitlePath, options),

    cancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.FFMPEG_CANCEL),

    onProgress: (callback: (progress: ExportProgress) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: ExportProgress) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.FFMPEG_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.FFMPEG_PROGRESS, handler)
    }
  },

  // ============================================
  // File System
  // ============================================
  file: {
    selectVideo: (): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_VIDEO),

    selectOutput: (defaultName: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_SELECT_OUTPUT, defaultName),

    getAppPath: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.FILE_GET_APP_PATH)
  }
})

// Type declarations for window.api
declare global {
  interface Window {
    api: {
      whisper: {
        start: (config: WhisperConfig) => Promise<{ status: string }>
        transcribe: (
          audioPath: string,
          options?: TranscriptionOptions
        ) => Promise<TranscriptionResult>
        cancel: () => Promise<void>
        getStatus: () => Promise<{ initialized: boolean; processing: boolean }>
        stop: () => Promise<void>
        onProgress: (callback: (progress: TranscriptionProgress) => void) => () => void
        onError: (callback: (error: { message: string }) => void) => () => void
      }
      ffmpeg: {
        extractAudio: (videoPath: string, outputPath: string) => Promise<string>
        getMetadata: (videoPath: string) => Promise<VideoMetadata>
        exportVideo: (
          videoPath: string,
          subtitlePath: string,
          options: ExportOptions
        ) => Promise<string>
        cancel: () => Promise<void>
        onProgress: (callback: (progress: ExportProgress) => void) => () => void
      }
      file: {
        selectVideo: () => Promise<string | null>
        selectOutput: (defaultName: string) => Promise<string | null>
        getAppPath: () => Promise<string>
      }
    }
  }
}
