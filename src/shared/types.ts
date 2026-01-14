// ============================================
// OpenSub Shared Types
// ============================================

// Projekt-Struktur
export interface Project {
  id: string
  name: string
  videoPath: string
  audioPath: string
  duration: number
  resolution: Resolution
  subtitles: Subtitle[]
  style: SubtitleStyle
  createdAt: number
  updatedAt: number
}

export interface Resolution {
  width: number
  height: number
}

// Subtitle Segment
export interface Subtitle {
  id: string
  startTime: number
  endTime: number
  text: string
  words: Word[]
  // Auto-split metadata (for tracking and re-merging split subtitles)
  splitGroupId?: string    // Links split segments to their original parent
  splitIndex?: number      // Position within split group (0, 1, 2...)
  isAutoSplit?: boolean    // Distinguishes auto-splits from manual edits
}

// Wort mit präzisem Timing
export interface Word {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

// Font weight type - supports CSS keywords and numeric values (100-900)
export type FontWeight = 'normal' | 'bold' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

// Styling Optionen
export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  fontWeight: FontWeight
  textTransform: 'none' | 'uppercase'  // Text transformation (uppercase = Versalien)
  color: string
  highlightColor: string
  backgroundColor: string
  outlineColor: string
  outlineWidth: number
  shadowColor: string
  shadowBlur: number
  position: SubtitlePosition
  // Custom position (0-1, where 0.5 is center)
  positionX: number
  positionY: number
  animation: AnimationType
  // Text box settings for text wrapping
  maxWidth: number   // Maximum width as percentage of video width (0-1, e.g., 0.8 = 80%)
  maxLines: number   // Maximum number of lines (1-2 for TikTok-style subtitles)
  // Karaoke box settings (background box behind the current highlighted word)
  karaokeBoxEnabled: boolean      // Whether to show a box behind the current karaoke word
  karaokeBoxColor: string         // Background color of the karaoke box
  karaokeBoxPadding: number       // Padding around the word in pixels
  karaokeBoxBorderRadius: number  // Border radius of the box in pixels
}

export type SubtitlePosition = 'top' | 'center' | 'bottom' | 'custom'
export type AnimationType = 'karaoke' | 'appear' | 'fade' | 'scale' | 'none'

// Magnetic snap points for positioning
export const SNAP_POINTS = {
  horizontal: [0.1, 0.5, 0.9], // left, center, right
  vertical: [0.15, 0.5, 0.65, 0.85]   // top, center, TikTok safe zone, bottom
}

export const SNAP_THRESHOLD = 0.05 // Distance to trigger snap

// ============================================
// Resolution-Based Font Size Calculation
// ============================================

/**
 * Calculate the default font size based on video resolution.
 * Uses 4K (3840px) with 96px font as the reference point.
 * Font size scales proportionally based on the largest dimension.
 *
 * Examples:
 * - 4K (3840×2160): 96px
 * - FHD (1920×1080): 48px
 * - 720p (1280×720): 32px
 *
 * @param width - Video width in pixels
 * @param height - Video height in pixels
 * @returns The calculated font size in pixels (minimum 16px)
 */
export function getDefaultFontSizeForResolution(width: number, height: number): number {
  const REFERENCE_DIMENSION = 3840 // 4K max dimension
  const REFERENCE_FONT_SIZE = 96   // Font size for 4K
  const MIN_FONT_SIZE = 16         // Minimum readable font size

  const maxDimension = Math.max(width, height)
  const calculatedSize = Math.round((maxDimension / REFERENCE_DIMENSION) * REFERENCE_FONT_SIZE)

  return Math.max(calculatedSize, MIN_FONT_SIZE)
}

// Default Style
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 48,
  fontWeight: 700,  // Bold weight (Poppins supports 400, 500, 600, 700)
  textTransform: 'uppercase',    // Versalien als Standard
  color: '#FFFFFF',
  highlightColor: '#FFD700',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  outlineColor: '#000000',
  outlineWidth: 10,              // Erhöhter Standard für bessere Lesbarkeit
  shadowColor: 'rgba(0, 0, 0, 0.8)',
  shadowBlur: 25,                // Erhöhter Standard für mehr Tiefe
  position: 'custom',
  positionX: 0.5,  // Centered horizontally
  positionY: 0.65, // TikTok safe zone (~65% from top, above UI elements)
  animation: 'karaoke',
  // Text box settings for optimal readability
  maxWidth: 0.85,  // 85% of video width
  maxLines: 2,     // Maximum 2 lines for TikTok-style subtitles
  // Karaoke box settings (disabled by default)
  karaokeBoxEnabled: false,
  karaokeBoxColor: '#32CD32',    // Lime green (as shown in reference image)
  karaokeBoxPadding: 24,         // 24px padding around the word
  karaokeBoxBorderRadius: 32    // 32px border radius for rounded corners
}

// ============================================
// Style Profile Types
// ============================================

// A saved style configuration that can be reused across projects
export interface StyleProfile {
  id: string
  name: string
  style: SubtitleStyle
  createdAt: number
  updatedAt: number
}

// Data structure for exported/imported profile JSON files
export interface StyleProfileExport {
  version: 1
  profile: StyleProfile
}

// ============================================
// AI Analysis Types
// ============================================

// Configuration for OpenRouter API
export interface AnalysisConfig {
  apiKey: string
  model: 'google/gemini-3-flash-preview'
  language: string
}

// A single correction proposed by the AI
export interface SubtitleChange {
  subtitleId: string
  subtitleIndex: number
  originalText: string
  correctedText: string
  changeType: 'spelling' | 'grammar' | 'context' | 'punctuation' | 'name'
  confidence: number
  reason?: string  // AI explanation for why it was changed
  status: 'pending' | 'accepted' | 'rejected'
}

// Result from AI analysis
export interface AnalysisResult {
  changes: SubtitleChange[]
  summary: {
    totalChanges: number
    spellingFixes: number
    grammarFixes: number
    contextFixes: number
    punctuationFixes: number
    nameFixes: number
  }
}

// Progress during analysis
export interface AnalysisProgress {
  stage: 'extracting' | 'uploading' | 'analyzing' | 'comparing' | 'complete' | 'error'
  percent: number
  message: string
}

// ============================================
// IPC Types
// ============================================

// Whisper Service Types
export interface WhisperConfig {
  model: string
  language: string
  device: 'mps' | 'cpu'
  hfToken?: string
}

export interface TranscriptionOptions {
  language?: string
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[]
  language: string
  duration: number
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  words: TranscriptionWord[]
}

export interface TranscriptionWord {
  word: string
  start: number
  end: number
  score: number
}

export interface TranscriptionProgress {
  stage: 'initializing' | 'loading' | 'transcribing' | 'aligning' | 'complete'
  percent: number
  message: string
}

// FFmpeg Types
export interface VideoMetadata {
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  audioCodec: string
}

export interface ExportOptions {
  outputPath: string
  quality: 'high' | 'medium' | 'low'
  scale?: number
  // Frame-based rendering options (for pixel-perfect subtitle overlay)
  useFrameRendering?: boolean
  frameDir?: string  // Directory containing rendered PNG frames
}

export interface ExportProgress {
  percent: number
  fps: number
  time: number
  stage?: 'rendering' | 'encoding' | 'complete'
}

// Subtitle frame for pixel-perfect overlay rendering
export interface SubtitleFrame {
  index: number
  startTime: number
  endTime: number
  data: string  // Base64 PNG data (without data URL prefix)
}

// ============================================
// IPC Channel Names
// ============================================

export const IPC_CHANNELS = {
  // Whisper
  WHISPER_START: 'whisper:start',
  WHISPER_TRANSCRIBE: 'whisper:transcribe',
  WHISPER_CANCEL: 'whisper:cancel',
  WHISPER_STATUS: 'whisper:status',
  WHISPER_STOP: 'whisper:stop',
  WHISPER_PROGRESS: 'whisper:progress',
  WHISPER_ERROR: 'whisper:error',
  WHISPER_MODEL_READY: 'whisper:model-ready',  // Emitted when model is loaded at startup

  // FFmpeg
  FFMPEG_EXTRACT_AUDIO: 'ffmpeg:extract-audio',
  FFMPEG_GET_METADATA: 'ffmpeg:get-metadata',
  FFMPEG_EXPORT: 'ffmpeg:export',
  FFMPEG_CANCEL: 'ffmpeg:cancel',
  FFMPEG_PROGRESS: 'ffmpeg:progress',

  // File System
  FILE_SELECT_VIDEO: 'file:select-video',
  FILE_SELECT_OUTPUT: 'file:select-output',
  FILE_GET_APP_PATH: 'file:get-app-path',
  FILE_WRITE_TEMP: 'file:write-temp',
  FILE_GET_TEMP_DIR: 'file:get-temp-dir',
  FILE_DELETE_TEMP: 'file:delete-temp',

  // Subtitle Frame Rendering
  SUBTITLE_FRAMES_SAVE: 'subtitle:frames-save',
  SUBTITLE_FRAMES_CLEANUP: 'subtitle:frames-cleanup',

  // Style Profiles
  PROFILE_EXPORT: 'profile:export',
  PROFILE_IMPORT: 'profile:import',

  // Project Persistence
  PROJECT_SAVE: 'project:save',
  PROJECT_LOAD: 'project:load',
  PROJECT_DELETE: 'project:delete',
  PROJECT_RENAME: 'project:rename',
  PROJECT_LIST: 'project:list',
  PROJECT_GENERATE_THUMBNAIL: 'project:generate-thumbnail',

  // Window
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggleMaximize',

  // Fonts
  FONTS_GET_SYSTEM: 'fonts:get-system',

  // AI Analysis
  AI_ANALYZE: 'ai:analyze',
  AI_CANCEL: 'ai:cancel',
  AI_PROGRESS: 'ai:progress'
} as const

// ============================================
// Project Persistence Types
// ============================================

// Stored project metadata for the project browser
export interface StoredProjectMeta {
  id: string
  name: string
  videoPath: string
  thumbnailPath: string | null
  duration: number
  createdAt: number
  updatedAt: number
}

// Full stored project (includes all data)
export interface StoredProject extends StoredProjectMeta {
  data: Project
}
