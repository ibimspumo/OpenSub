/**
 * Typed bridge to the Rust backend.
 *
 * This replaces the old Electron `window.api` preload bridge. Every backend
 * capability is exposed here as a typed function so components never call
 * `invoke()` directly.
 */

import { invoke, convertFileSrc } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { open, save } from '@tauri-apps/plugin-dialog'
import type {
  VideoMetadata,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgress,
  ModelStatus,
  ModelDownloadProgress,
  ExportOptions,
  ExportProgress,
  Project,
  StoredProject,
  StoredProjectMeta,
  Subtitle,
  SubtitleFrame,
  AnalysisConfig,
  AnalysisResult,
  AnalysisProgress,
  TranscriptionWord
} from './types'

// ============================================
// Events
// ============================================

export const EVENTS = {
  TRANSCRIPTION_PROGRESS: 'transcription:progress',
  MODEL_DOWNLOAD: 'model:download',
  EXPORT_PROGRESS: 'export:progress',
  ANALYSIS_PROGRESS: 'analysis:progress'
} as const

function subscribe<T>(event: string, callback: (payload: T) => void): () => void {
  const unlistenPromise: Promise<UnlistenFn> = listen<T>(event, (e) => callback(e.payload))
  return () => {
    unlistenPromise.then((unlisten) => unlisten())
  }
}

// ============================================
// Media
// ============================================

/** Build a streamable URL for a local media file (asset protocol, range-request capable) */
export function mediaSrc(path: string): string {
  return convertFileSrc(path)
}

// ============================================
// FFmpeg
// ============================================

export const ffmpeg = {
  getMetadata: (videoPath: string): Promise<VideoMetadata> =>
    invoke('video_metadata', { videoPath }),

  /** Extract 16 kHz mono WAV. Returns the path of the extracted file. */
  extractAudio: (videoPath: string): Promise<string> =>
    invoke('extract_audio', { videoPath }),

  /** Compute waveform peaks (min/max pairs) for timeline rendering. */
  waveformPeaks: (audioPath: string, samplesPerSecond: number): Promise<number[]> =>
    invoke('waveform_peaks', { audioPath, samplesPerSecond }),

  exportVideo: (videoPath: string, options: ExportOptions): Promise<string> =>
    invoke('export_video', { videoPath, options }),

  cancel: (): Promise<void> => invoke('cancel_export'),

  onProgress: (callback: (progress: ExportProgress) => void) =>
    subscribe<ExportProgress>(EVENTS.EXPORT_PROGRESS, callback)
}

// ============================================
// Transcription (Parakeet)
// ============================================

export const transcription = {
  transcribe: (audioPath: string, options?: TranscriptionOptions): Promise<TranscriptionResult> =>
    invoke('transcribe', { audioPath, options: options ?? {} }),

  cancel: (): Promise<void> => invoke('cancel_transcription'),

  /**
   * Re-transcribe a small audio window to get fresh word timings after a text
   * edit (replaces WhisperX forced alignment).
   */
  realignSegment: (
    audioPath: string,
    start: number,
    end: number
  ): Promise<TranscriptionWord[]> =>
    invoke('realign_segment', { audioPath, start, end }),

  onProgress: (callback: (progress: TranscriptionProgress) => void) =>
    subscribe<TranscriptionProgress>(EVENTS.TRANSCRIPTION_PROGRESS, callback)
}

// ============================================
// Model Management
// ============================================

export const models = {
  status: (): Promise<ModelStatus> => invoke('model_status'),

  /** Download the ASR (and optionally diarization) models with progress events. */
  download: (includeDiarization: boolean): Promise<void> =>
    invoke('download_models', { includeDiarization }),

  cancelDownload: (): Promise<void> => invoke('cancel_model_download'),

  onProgress: (callback: (progress: ModelDownloadProgress) => void) =>
    subscribe<ModelDownloadProgress>(EVENTS.MODEL_DOWNLOAD, callback)
}

// ============================================
// Projects
// ============================================

export const projects = {
  save: (project: Project): Promise<StoredProjectMeta> =>
    invoke('project_save', { project }),

  load: (id: string): Promise<StoredProject | null> =>
    invoke('project_load', { id }),

  list: (): Promise<StoredProjectMeta[]> => invoke('project_list'),

  delete: (id: string): Promise<boolean> => invoke('project_delete', { id }),

  rename: (id: string, newName: string): Promise<boolean> =>
    invoke('project_rename', { id, newName }),

  generateThumbnail: (projectId: string, videoPath: string): Promise<string | null> =>
    invoke('project_thumbnail', { projectId, videoPath })
}

// ============================================
// Files & Temp
// ============================================

export const files = {
  selectVideo: async (): Promise<string | null> => {
    const result = await open({
      multiple: false,
      filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi'] }]
    })
    return result ?? null
  },

  selectOutput: async (defaultName: string): Promise<string | null> => {
    const result = await save({
      defaultPath: defaultName,
      filters: [{ name: 'MP4 Video', extensions: ['mp4'] }]
    })
    return result ?? null
  },

  selectJsonOutput: async (defaultName: string): Promise<string | null> => {
    const result = await save({
      defaultPath: defaultName,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    return result ?? null
  },

  selectJsonInput: async (): Promise<string | null> => {
    const result = await open({
      multiple: false,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    return result ?? null
  },

  selectTextOutput: async (defaultName: string): Promise<string | null> => {
    const result = await save({
      defaultPath: defaultName,
      filters: [{ name: 'Text', extensions: ['txt'] }]
    })
    return result ?? null
  },

  deleteTempFile: (path: string): Promise<void> => invoke('delete_temp_file', { path }),

  readTextFile: (path: string): Promise<string> => invoke('read_text_file', { path }),

  writeTextFile: (path: string, contents: string): Promise<void> =>
    invoke('write_text_file', { path, contents }),

  /** Persist rendered subtitle frames (base64 PNGs) to a temp dir for export. */
  saveSubtitleFrames: (frames: SubtitleFrame[], fps: number): Promise<string> =>
    invoke('save_subtitle_frames', { frames, fps }),

  cleanupSubtitleFrames: (frameDir: string): Promise<void> =>
    invoke('cleanup_subtitle_frames', { frameDir })
}

// ============================================
// Transcript Export
// ============================================

export const transcript = {
  exportText: async (subtitles: Subtitle[], projectName: string): Promise<string | null> => {
    const path = await files.selectTextOutput(`${projectName}-transkript.txt`)
    if (!path) return null
    const text = subtitles.map((s) => s.text).join('\n\n')
    await files.writeTextFile(path, text)
    return path
  },

  exportTimecodes: async (subtitles: Subtitle[], projectName: string): Promise<string | null> => {
    const path = await files.selectTextOutput(`${projectName}-timecodes.txt`)
    if (!path) return null
    const fmt = (t: number) => {
      const m = Math.floor(t / 60)
      const s = (t % 60).toFixed(2).padStart(5, '0')
      return `${m.toString().padStart(2, '0')}:${s}`
    }
    const text = subtitles
      .map((s) => `[${fmt(s.startTime)} → ${fmt(s.endTime)}] ${s.text}`)
      .join('\n')
    await files.writeTextFile(path, text)
    return path
  }
}

// ============================================
// AI Analysis (OpenRouter)
// ============================================

export const analysis = {
  analyze: (params: {
    audioPath: string
    subtitles: Subtitle[]
    config: AnalysisConfig
  }): Promise<AnalysisResult> => invoke('analyze_subtitles', { params }),

  cancel: (): Promise<void> => invoke('cancel_analysis'),

  getWordTimings: (params: {
    audioPath: string
    text: string
    segmentStart: number
    segmentEnd: number
  }): Promise<{ words: { word: string; start: number; end: number }[] }> =>
    invoke('gemini_word_timings', { params }),

  onProgress: (callback: (progress: AnalysisProgress) => void) =>
    subscribe<AnalysisProgress>(EVENTS.ANALYSIS_PROGRESS, callback)
}

// ============================================
// Fonts
// ============================================

export const fonts = {
  getSystemFonts: (): Promise<string[]> => invoke('list_system_fonts')
}

// ============================================
// Window
// ============================================

export const appWindow = {
  toggleMaximize: async (): Promise<void> => {
    const win = getCurrentWindow()
    await win.toggleMaximize()
  },

  startDragging: async (): Promise<void> => {
    const win = getCurrentWindow()
    await win.startDragging()
  }
}

// ============================================
// Aggregate export
// ============================================

export const api = {
  mediaSrc,
  ffmpeg,
  transcription,
  models,
  projects,
  files,
  transcript,
  analysis,
  fonts,
  appWindow
}

export default api
