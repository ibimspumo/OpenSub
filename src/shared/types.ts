// ============================================
// OpenSub Shared Types
// ============================================

// Re-export all style constants for convenience
export * from './styleConstants'

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

// Box padding type - individual padding values for each side (CSS-like: top, right, bottom, left)
export interface BoxPadding {
  top: number
  right: number
  bottom: number
  left: number
}

// Default box padding (used for karaoke box)
export const DEFAULT_BOX_PADDING: BoxPadding = {
  top: 8,
  right: 24,
  bottom: 8,
  left: 24
}

// Helper to create uniform padding
export function createUniformPadding(value: number): BoxPadding {
  return { top: value, right: value, bottom: value, left: value }
}

// Helper to create symmetric padding (vertical, horizontal)
export function createSymmetricPadding(vertical: number, horizontal: number): BoxPadding {
  return { top: vertical, right: horizontal, bottom: vertical, left: horizontal }
}

// Styling Optionen
export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  fontWeight: FontWeight
  textTransform: 'none' | 'uppercase'  // Text transformation (uppercase = Versalien)
  color: string
  highlightColor: string
  upcomingColor: string  // Color for words not yet spoken (karaoke mode)
  backgroundColor: string
  outlineColor: string
  outlineWidth: number
  shadowColor: string
  shadowOpacity: number   // Shadow opacity (0-100, where 100 is fully opaque)
  shadowBlur: number
  shadowOffsetX: number   // Horizontal shadow offset in pixels
  shadowOffsetY: number   // Vertical shadow offset in pixels
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
  karaokeBoxPadding: BoxPadding   // Individual padding values (top, right, bottom, left)
  karaokeBoxBorderRadius: number  // Border radius of the box in pixels
  // Karaoke glow settings (glow effect around the current highlighted word)
  karaokeGlowEnabled: boolean     // Whether to show a glow around the current karaoke word
  karaokeGlowColor: string        // Color of the glow (e.g., highlight color or custom)
  karaokeGlowOpacity: number      // Glow opacity (0-100, where 100 is fully opaque)
  karaokeGlowBlur: number         // Blur radius of the glow in pixels
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
  upcomingColor: '#808080',  // Gray for upcoming words (not yet spoken)
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  outlineColor: '#000000',
  outlineWidth: 10,              // Erhöhter Standard für bessere Lesbarkeit
  shadowColor: '#000000',
  shadowOpacity: 80,             // 80% opacity (equivalent to old rgba 0.8)
  shadowBlur: 25,                // Erhöhter Standard für mehr Tiefe
  shadowOffsetX: 4,              // Leichter horizontaler Versatz
  shadowOffsetY: 4,              // Leichter vertikaler Versatz
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
  karaokeBoxPadding: DEFAULT_BOX_PADDING,  // Individual padding values
  karaokeBoxBorderRadius: 32,   // 32px border radius for rounded corners
  // Karaoke glow settings (enabled by default for visual emphasis)
  karaokeGlowEnabled: true,
  karaokeGlowColor: '#FFD700',   // Default to highlight color (gold)
  karaokeGlowOpacity: 100,       // Fully opaque by default
  karaokeGlowBlur: 10            // 10px blur radius
}

// List of all valid SubtitleStyle property names
export const SUBTITLE_STYLE_KEYS: (keyof SubtitleStyle)[] = [
  'fontFamily', 'fontSize', 'fontWeight', 'textTransform',
  'color', 'highlightColor', 'upcomingColor', 'backgroundColor',
  'outlineColor', 'outlineWidth', 'shadowColor', 'shadowOpacity', 'shadowBlur',
  'shadowOffsetX', 'shadowOffsetY', 'position', 'positionX', 'positionY',
  'animation', 'maxWidth', 'maxLines',
  'karaokeBoxEnabled', 'karaokeBoxColor', 'karaokeBoxPadding', 'karaokeBoxBorderRadius',
  'karaokeGlowEnabled', 'karaokeGlowColor', 'karaokeGlowOpacity', 'karaokeGlowBlur'
]

// Result of style validation
export interface StyleValidationResult {
  style: SubtitleStyle           // Normalized style (merged with defaults)
  missingProperties: string[]    // Properties that were missing and filled with defaults
  unknownProperties: string[]    // Properties that were removed (not in SubtitleStyle)
  hasIssues: boolean             // True if there were missing or unknown properties
}

/**
 * Validates and normalizes an imported style object.
 * - Fills missing properties with defaults from DEFAULT_SUBTITLE_STYLE
 * - Removes unknown properties that aren't part of SubtitleStyle
 * - Returns information about what was fixed
 *
 * @param importedStyle - The style object from an imported profile (may be incomplete)
 * @returns Validation result with normalized style and diagnostics
 */
export function validateAndNormalizeStyle(importedStyle: Record<string, unknown>): StyleValidationResult {
  const missingProperties: string[] = []
  const unknownProperties: string[] = []

  // Find unknown properties in imported style
  for (const key of Object.keys(importedStyle)) {
    if (!SUBTITLE_STYLE_KEYS.includes(key as keyof SubtitleStyle)) {
      unknownProperties.push(key)
    }
  }

  // Build normalized style by merging with defaults
  const normalizedStyle: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE }

  for (const key of SUBTITLE_STYLE_KEYS) {
    if (key in importedStyle && importedStyle[key] !== undefined) {
      // Use the imported value (with type assertion since we validated the key)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(normalizedStyle as any)[key] = importedStyle[key]
    } else {
      // Track missing properties
      missingProperties.push(key)
    }
  }

  return {
    style: normalizedStyle,
    missingProperties,
    unknownProperties,
    hasIssues: missingProperties.length > 0 || unknownProperties.length > 0
  }
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

// Forced alignment types (for AI correction timing)
export interface AlignmentSegment {
  text: string
  start: number
  end: number
}

export interface AlignmentRequest {
  audioPath: string
  segments: AlignmentSegment[]
}

// Gemini word timing (fallback for WhisperX)
export interface WordTimingRequest {
  audioPath: string
  text: string
  segmentStart: number
  segmentEnd: number
}

export interface GeminiWordTiming {
  word: string
  start: number
  end: number
}

export interface WordTimingResult {
  words: GeminiWordTiming[]
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

// Resolution preset for export dialog
export interface ResolutionPreset {
  id: string
  label: string
  width: number
  height: number
}

// Export settings selected by user in export dialog
export interface ExportSettings {
  filename: string
  resolution: ResolutionPreset
  quality: 'high' | 'medium' | 'low'
}

export interface ExportOptions {
  outputPath: string
  quality: 'high' | 'medium' | 'low'
  scale?: number
  // Target resolution (for rescaling video)
  targetWidth?: number
  targetHeight?: number
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
  WHISPER_ALIGN: 'whisper:align',  // Forced alignment for AI corrections
  WHISPER_CANCEL: 'whisper:cancel',
  WHISPER_STATUS: 'whisper:status',
  WHISPER_STOP: 'whisper:stop',
  WHISPER_PROGRESS: 'whisper:progress',
  WHISPER_ERROR: 'whisper:error',
  WHISPER_MODEL_READY: 'whisper:model-ready',  // Emitted when model is loaded at startup
  WHISPER_DEBUG_LOG: 'whisper:debug-log',  // Debug log output from Python service

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

  // Media Stream Cleanup (prevents memory leaks when switching videos)
  MEDIA_CLEANUP_STREAMS: 'media:cleanup-streams',

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
  AI_PROGRESS: 'ai:progress',
  AI_WORD_TIMING: 'ai:word-timing',

  // Transcript Export
  TRANSCRIPT_EXPORT_TEXT: 'transcript:export-text',
  TRANSCRIPT_EXPORT_TIMECODES: 'transcript:export-timecodes',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_HAS_ENV_API_KEY: 'settings:has-env-api-key',
  SETTINGS_GET_API_KEY: 'settings:get-api-key',

  // Model Management (for first-run setup and model status)
  MODELS_LIST: 'models:list',
  MODELS_CHECK: 'models:check',
  MODELS_IS_FIRST_RUN: 'models:is-first-run',
  MODELS_DOWNLOAD_PROGRESS: 'models:download-progress',
  MODELS_SELECT: 'models:select',
  MODELS_GET_SELECTED: 'models:get-selected',

  // Debug Logging (app-wide debug system)
  DEBUG_LOG: 'debug:log',
  DEBUG_GET_LOGS: 'debug:get-logs',
  DEBUG_CLEAR: 'debug:clear',
  DEBUG_GET_STATUS: 'debug:get-status'
} as const

// ============================================
// App Settings Types
// ============================================

/**
 * App-wide settings that persist between sessions
 */
export interface AppSettings {
  openRouterApiKey?: string
  selectedModelId?: string  // Whisper model ID (e.g., 'mlx-community/whisper-large-v3-mlx')
}

/**
 * Default model ID used when no model is selected
 */
export const DEFAULT_MODEL_ID = 'mlx-community/whisper-large-v3-mlx'

// ============================================
// Model Management Types
// ============================================

/**
 * Information about an available AI model
 */
export interface ModelInfo {
  id: string
  name: string
  size: string
  sizeBytes: number
  quality: 'high' | 'medium' | 'low'
  downloaded: boolean
}

/**
 * Model download progress information
 */
export interface ModelDownloadProgress {
  modelId: string
  percent: number
  downloadedBytes: number
  totalBytes: number
  status: 'downloading' | 'complete' | 'error'
  error?: string
}

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

// ============================================
// Debug System Types
// ============================================

/**
 * Debug log entry with timestamp and category
 */
export interface DebugLogEntry {
  timestamp: number
  level: 'info' | 'warn' | 'error' | 'debug'
  category: 'main' | 'renderer' | 'python' | 'ipc' | 'whisper' | 'ffmpeg'
  message: string
  data?: unknown
}

/**
 * App status information for debugging
 */
export interface DebugAppStatus {
  isPackaged: boolean
  appPath: string
  resourcesPath: string
  pythonPath: string
  pythonServicePath: string
  pythonExists: boolean
  serviceExists: boolean
  whisperServiceRunning: boolean
  whisperModelReady: boolean
  platform: string
  arch: string
  electronVersion: string
  nodeVersion: string
}
