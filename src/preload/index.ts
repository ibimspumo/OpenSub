import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../shared/types'
import type {
  WhisperConfig,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgress,
  AlignmentSegment,
  VideoMetadata,
  ExportOptions,
  ExportProgress,
  StyleProfileExport,
  Project,
  StoredProjectMeta,
  StoredProject,
  SubtitleFrame,
  Subtitle,
  AnalysisConfig,
  AnalysisResult,
  AnalysisProgress,
  WordTimingRequest,
  WordTimingResult,
  AppSettings,
  ModelInfo
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

    align: (
      audioPath: string,
      segments: AlignmentSegment[]
    ): Promise<TranscriptionResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHISPER_ALIGN, { audioPath, segments }),

    cancel: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_CANCEL),

    getStatus: (): Promise<{ initialized: boolean; processing: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHISPER_STATUS),

    stop: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WHISPER_STOP),

    isModelReady: (): Promise<{ ready: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.WHISPER_MODEL_READY),

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
    },

    onModelReady: (callback: (data: { ready: boolean }) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, data: { ready: boolean }) => {
        callback(data)
      }
      ipcRenderer.on(IPC_CHANNELS.WHISPER_MODEL_READY, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.WHISPER_MODEL_READY, handler)
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

    getAppPath: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.FILE_GET_APP_PATH),

    writeTempFile: (
      filename: string,
      content: string
    ): Promise<{ success: boolean; filePath?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_WRITE_TEMP, filename, content),

    exportProfile: (
      profileExport: StyleProfileExport,
      defaultName: string
    ): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROFILE_EXPORT, profileExport, defaultName),

    importProfile: (): Promise<{
      success: boolean
      profileExport?: StyleProfileExport
      error?: string
      canceled?: boolean
    }> => ipcRenderer.invoke(IPC_CHANNELS.PROFILE_IMPORT),

    getTempDir: (): Promise<string> => ipcRenderer.invoke(IPC_CHANNELS.FILE_GET_TEMP_DIR),

    deleteTempFile: (filePath: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.FILE_DELETE_TEMP, filePath),

    // Subtitle frame rendering for pixel-perfect export
    saveSubtitleFrames: (
      frames: SubtitleFrame[],
      fps: number
    ): Promise<{ success: boolean; frameDir?: string; manifestPath?: string; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_FRAMES_SAVE, frames, fps),

    cleanupSubtitleFrames: (frameDir: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.SUBTITLE_FRAMES_CLEANUP, frameDir),

    // Clean up media streams to prevent memory leaks when switching videos
    cleanupMediaStreams: (filePath?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MEDIA_CLEANUP_STREAMS, filePath),

    // Transcript export functions
    exportTranscriptText: (
      subtitles: Subtitle[],
      projectName: string
    ): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_TEXT, subtitles, projectName),

    exportTranscriptTimecodes: (
      subtitles: Subtitle[],
      projectName: string
    ): Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }> =>
      ipcRenderer.invoke(IPC_CHANNELS.TRANSCRIPT_EXPORT_TIMECODES, subtitles, projectName)
  },

  // ============================================
  // Window Controls
  // ============================================
  window: {
    toggleMaximize: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.WINDOW_TOGGLE_MAXIMIZE)
  },

  // ============================================
  // Project Persistence
  // ============================================
  project: {
    save: (project: Project): Promise<StoredProjectMeta> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_SAVE, project),

    load: (id: string): Promise<StoredProject | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LOAD, id),

    delete: (id: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_DELETE, id),

    rename: (id: string, newName: string): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_RENAME, id, newName),

    list: (): Promise<StoredProjectMeta[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_LIST),

    generateThumbnail: (projectId: string, videoPath: string): Promise<string | null> =>
      ipcRenderer.invoke(IPC_CHANNELS.PROJECT_GENERATE_THUMBNAIL, projectId, videoPath)
  },

  // ============================================
  // Fonts
  // ============================================
  fonts: {
    getSystemFonts: (): Promise<string[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.FONTS_GET_SYSTEM)
  },

  // ============================================
  // AI Analysis
  // ============================================
  analysis: {
    analyze: (params: {
      videoPath: string
      subtitles: Subtitle[]
      config: AnalysisConfig
    }): Promise<AnalysisResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_ANALYZE, params),

    cancel: (): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_CANCEL),

    getWordTimings: (params: WordTimingRequest): Promise<WordTimingResult> =>
      ipcRenderer.invoke(IPC_CHANNELS.AI_WORD_TIMING, params),

    onProgress: (callback: (progress: AnalysisProgress) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, progress: AnalysisProgress) => {
        callback(progress)
      }
      ipcRenderer.on(IPC_CHANNELS.AI_PROGRESS, handler)
      return () => ipcRenderer.removeListener(IPC_CHANNELS.AI_PROGRESS, handler)
    }
  },

  // ============================================
  // Settings
  // ============================================
  settings: {
    get: (): Promise<AppSettings> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET),

    set: (settings: Partial<AppSettings>): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_SET, settings),

    hasEnvApiKey: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_HAS_ENV_API_KEY),

    getApiKey: (): Promise<string | undefined> =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS_GET_API_KEY)
  },

  // ============================================
  // Model Management
  // ============================================
  models: {
    list: (): Promise<ModelInfo[]> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODELS_LIST),

    hasAnyDownloaded: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODELS_CHECK),

    isFirstRunSetupNeeded: (): Promise<boolean> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODELS_IS_FIRST_RUN),

    getSelected: (): Promise<string> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODELS_GET_SELECTED),

    select: (modelId: string): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke(IPC_CHANNELS.MODELS_SELECT, modelId)
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
        align: (
          audioPath: string,
          segments: AlignmentSegment[]
        ) => Promise<TranscriptionResult>
        cancel: () => Promise<void>
        getStatus: () => Promise<{ initialized: boolean; processing: boolean }>
        stop: () => Promise<void>
        isModelReady: () => Promise<{ ready: boolean }>
        onProgress: (callback: (progress: TranscriptionProgress) => void) => () => void
        onError: (callback: (error: { message: string }) => void) => () => void
        onModelReady: (callback: (data: { ready: boolean }) => void) => () => void
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
        writeTempFile: (
          filename: string,
          content: string
        ) => Promise<{ success: boolean; filePath?: string; error?: string }>
        exportProfile: (
          profileExport: StyleProfileExport,
          defaultName: string
        ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
        importProfile: () => Promise<{
          success: boolean
          profileExport?: StyleProfileExport
          error?: string
          canceled?: boolean
        }>
        getTempDir: () => Promise<string>
        deleteTempFile: (filePath: string) => Promise<{ success: boolean; error?: string }>
        saveSubtitleFrames: (
          frames: SubtitleFrame[],
          fps: number
        ) => Promise<{ success: boolean; frameDir?: string; manifestPath?: string; error?: string }>
        cleanupSubtitleFrames: (frameDir: string) => Promise<{ success: boolean; error?: string }>
        cleanupMediaStreams: (filePath?: string) => Promise<{ success: boolean }>
        exportTranscriptText: (
          subtitles: Subtitle[],
          projectName: string
        ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
        exportTranscriptTimecodes: (
          subtitles: Subtitle[],
          projectName: string
        ) => Promise<{ success: boolean; filePath?: string; error?: string; canceled?: boolean }>
      }
      window: {
        toggleMaximize: () => Promise<boolean>
      }
      project: {
        save: (project: Project) => Promise<StoredProjectMeta>
        load: (id: string) => Promise<StoredProject | null>
        delete: (id: string) => Promise<boolean>
        rename: (id: string, newName: string) => Promise<boolean>
        list: () => Promise<StoredProjectMeta[]>
        generateThumbnail: (projectId: string, videoPath: string) => Promise<string | null>
      }
      fonts: {
        getSystemFonts: () => Promise<string[]>
      }
      analysis: {
        analyze: (params: {
          videoPath: string
          subtitles: Subtitle[]
          config: AnalysisConfig
        }) => Promise<AnalysisResult>
        cancel: () => Promise<void>
        getWordTimings: (params: WordTimingRequest) => Promise<WordTimingResult>
        onProgress: (callback: (progress: AnalysisProgress) => void) => () => void
      }
      settings: {
        get: () => Promise<AppSettings>
        set: (settings: Partial<AppSettings>) => Promise<void>
        hasEnvApiKey: () => Promise<boolean>
        getApiKey: () => Promise<string | undefined>
      }
      models: {
        list: () => Promise<ModelInfo[]>
        hasAnyDownloaded: () => Promise<boolean>
        isFirstRunSetupNeeded: () => Promise<boolean>
        getSelected: () => Promise<string>
        select: (modelId: string) => Promise<{ success: boolean; error?: string }>
      }
    }
  }
}
