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
}

export type SubtitlePosition = 'top' | 'center' | 'bottom' | 'custom'
export type AnimationType = 'karaoke' | 'appear' | 'fade' | 'scale' | 'none'

// Magnetic snap points for positioning
export const SNAP_POINTS = {
  horizontal: [0.1, 0.5, 0.9], // left, center, right
  vertical: [0.15, 0.5, 0.85]   // top, center, bottom
}

export const SNAP_THRESHOLD = 0.05 // Distance to trigger snap

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
  positionY: 0.85, // Near bottom
  animation: 'karaoke'
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
}

export interface ExportProgress {
  percent: number
  fps: number
  time: number
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
  FILE_GET_APP_PATH: 'file:get-app-path'
} as const
