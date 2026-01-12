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
  speakers: Speaker[]
  style: SubtitleStyle
  createdAt: number
  updatedAt: number
}

export interface Resolution {
  width: number
  height: number
}

// Sprecher (aus Diarization)
export interface Speaker {
  id: string // z.B. "SPEAKER_00"
  name: string // Benutzer-definierter Name
  color: string // Farbe für diesen Sprecher
}

// Subtitle Segment
export interface Subtitle {
  id: string
  startTime: number
  endTime: number
  text: string
  words: Word[]
  speakerId?: string
}

// Wort mit präzisem Timing
export interface Word {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

// Styling Optionen
export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  fontWeight: 'normal' | 'bold'
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
  fontFamily: 'Inter, system-ui, sans-serif',
  fontSize: 48,
  fontWeight: 'bold',
  color: '#FFFFFF',
  highlightColor: '#FFD700',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  outlineColor: '#000000',
  outlineWidth: 2,
  shadowColor: 'rgba(0, 0, 0, 0.8)',
  shadowBlur: 4,
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
  karaokeBoxPadding: 4,          // 4px padding around the word
  karaokeBoxBorderRadius: 4     // 4px border radius for slightly rounded corners
}

// Default Speaker Colors
export const SPEAKER_COLORS = [
  '#3B82F6', // Blue
  '#EF4444', // Red
  '#10B981', // Green
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#F97316' // Orange
]

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
  diarize?: boolean
  minSpeakers?: number
  maxSpeakers?: number
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[]
  language: string
  duration: number
  speakers: string[]
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  speaker?: string
  words: TranscriptionWord[]
}

export interface TranscriptionWord {
  word: string
  start: number
  end: number
  score: number
  speaker?: string
}

export interface TranscriptionProgress {
  stage: 'loading' | 'transcribing' | 'aligning' | 'diarizing' | 'complete'
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
  FONTS_GET_SYSTEM: 'fonts:get-system'
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
