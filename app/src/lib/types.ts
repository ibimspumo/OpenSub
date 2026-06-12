// ============================================
// OpenSub Shared Types
// ============================================

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
  speakers: Speaker[]
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
  /** Speaker assignment from diarization (references Speaker.id) */
  speakerId?: string
  // Auto-split metadata (for tracking and re-merging split subtitles)
  splitGroupId?: string
  splitIndex?: number
  isAutoSplit?: boolean
}

// Wort mit präzisem Timing
export interface Word {
  text: string
  startTime: number
  endTime: number
  confidence: number
}

// Speaker from diarization
export interface Speaker {
  id: string
  name: string
  color: string
}

export const SPEAKER_COLORS = [
  '#BDFF01', // brand green
  '#45B7D1', // sky
  '#FF6B6B', // coral
  '#FFD700', // gold
  '#DDA0DD', // plum
  '#4ECDC4', // teal
  '#FF8C00', // orange
  '#96CEB4'  // sage
] as const

// Font weight type - supports CSS keywords and numeric values (100-900)
export type FontWeight = 'normal' | 'bold' | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900

// Box padding type - individual padding values for each side
export interface BoxPadding {
  top: number
  right: number
  bottom: number
  left: number
}

export const DEFAULT_BOX_PADDING: BoxPadding = {
  top: 16,
  right: 12,
  bottom: 0,
  left: 12
}

export function createUniformPadding(value: number): BoxPadding {
  return { top: value, right: value, bottom: value, left: value }
}

export function createSymmetricPadding(vertical: number, horizontal: number): BoxPadding {
  return { top: vertical, right: horizontal, bottom: vertical, left: horizontal }
}

// Styling Optionen
export interface SubtitleStyle {
  fontFamily: string
  fontSize: number
  fontWeight: FontWeight
  textTransform: 'none' | 'uppercase'
  color: string
  highlightColor: string
  upcomingColor: string
  backgroundColor: string
  outlineColor: string
  outlineWidth: number
  shadowColor: string
  shadowOpacity: number
  shadowBlur: number
  shadowOffsetX: number
  shadowOffsetY: number
  position: SubtitlePosition
  positionX: number
  positionY: number
  animation: AnimationType
  maxWidth: number
  maxLines: number
  // Karaoke box settings
  karaokeBoxEnabled: boolean
  karaokeBoxColor: string
  karaokeBoxPadding: BoxPadding
  karaokeBoxBorderRadius: number
  // Karaoke glow settings
  karaokeGlowEnabled: boolean
  karaokeGlowColor: string
  karaokeGlowOpacity: number
  karaokeGlowBlur: number
  /** Color subtitles by speaker (diarization) */
  colorBySpeaker: boolean
}

export type SubtitlePosition = 'top' | 'center' | 'bottom' | 'custom'
export type AnimationType = 'karaoke' | 'appear' | 'fade' | 'scale' | 'none'

// Magnetic snap points for positioning
export const SNAP_POINTS = {
  horizontal: [0.1, 0.5, 0.9],
  vertical: [0.15, 0.5, 0.65, 0.85]
}

export const SNAP_THRESHOLD = 0.05

// ============================================
// Resolution-Based Font Size Calculation
// ============================================

/**
 * Calculate the default font size based on video resolution.
 * Anchored at 50px for FHD (1920px max dimension) and scaled
 * proportionally — e.g. 4K → 100px, 720p → 33px.
 */
export function getDefaultFontSizeForResolution(width: number, height: number): number {
  const REFERENCE_DIMENSION = 1920
  const REFERENCE_FONT_SIZE = 50
  const MIN_FONT_SIZE = 16

  const maxDimension = Math.max(width, height)
  const calculatedSize = Math.round((maxDimension / REFERENCE_DIMENSION) * REFERENCE_FONT_SIZE)

  return Math.max(calculatedSize, MIN_FONT_SIZE)
}

// Default Style (AgentZ style preset)
export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  fontFamily: 'Poppins, sans-serif',
  fontSize: 50,
  fontWeight: 800,
  textTransform: 'uppercase',
  color: '#FFFFFF',
  highlightColor: '#000000',
  upcomingColor: '#FFFFFF',
  backgroundColor: 'rgba(0, 0, 0, 0.5)',
  outlineColor: '#000000',
  outlineWidth: 0,
  shadowColor: '#000000',
  shadowOpacity: 100,
  shadowBlur: 52,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  position: 'custom',
  positionX: 0.5,
  positionY: 0.7374730021598273,
  animation: 'karaoke',
  maxWidth: 0.6,
  maxLines: 2,
  karaokeBoxEnabled: true,
  karaokeBoxColor: '#BDFF01',
  karaokeBoxPadding: DEFAULT_BOX_PADDING,
  karaokeBoxBorderRadius: 16,
  karaokeGlowEnabled: false,
  karaokeGlowColor: '#BDFF01',
  karaokeGlowOpacity: 100,
  karaokeGlowBlur: 37,
  colorBySpeaker: false
}

// List of all valid SubtitleStyle property names
export const SUBTITLE_STYLE_KEYS: (keyof SubtitleStyle)[] = [
  'fontFamily', 'fontSize', 'fontWeight', 'textTransform',
  'color', 'highlightColor', 'upcomingColor', 'backgroundColor',
  'outlineColor', 'outlineWidth', 'shadowColor', 'shadowOpacity', 'shadowBlur',
  'shadowOffsetX', 'shadowOffsetY', 'position', 'positionX', 'positionY',
  'animation', 'maxWidth', 'maxLines',
  'karaokeBoxEnabled', 'karaokeBoxColor', 'karaokeBoxPadding', 'karaokeBoxBorderRadius',
  'karaokeGlowEnabled', 'karaokeGlowColor', 'karaokeGlowOpacity', 'karaokeGlowBlur',
  'colorBySpeaker'
]

// Result of style validation
export interface StyleValidationResult {
  style: SubtitleStyle
  missingProperties: string[]
  unknownProperties: string[]
  hasIssues: boolean
}

/**
 * Validates and normalizes an imported style object.
 * - Fills missing properties with defaults from DEFAULT_SUBTITLE_STYLE
 * - Removes unknown properties that aren't part of SubtitleStyle
 */
export function validateAndNormalizeStyle(importedStyle: Record<string, unknown>): StyleValidationResult {
  const missingProperties: string[] = []
  const unknownProperties: string[] = []

  for (const key of Object.keys(importedStyle)) {
    if (!SUBTITLE_STYLE_KEYS.includes(key as keyof SubtitleStyle)) {
      unknownProperties.push(key)
    }
  }

  const normalizedStyle: SubtitleStyle = { ...DEFAULT_SUBTITLE_STYLE }

  for (const key of SUBTITLE_STYLE_KEYS) {
    if (key in importedStyle && importedStyle[key] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(normalizedStyle as any)[key] = importedStyle[key]
    } else {
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

export interface StyleProfile {
  id: string
  name: string
  style: SubtitleStyle
  createdAt: number
  updatedAt: number
}

export interface StyleProfileExport {
  version: 1
  profile: StyleProfile
}

// A curated style template shown in the template gallery
export interface StyleTemplate {
  id: string
  /** i18n key for the display name */
  nameKey: string
  name: string
  /** Words shown in the animated preview */
  previewText: string
  style: SubtitleStyle
}

// ============================================
// AI Analysis Types
// ============================================

export interface AnalysisConfig {
  model: string
  language: string
}

export interface SubtitleChange {
  subtitleId: string
  subtitleIndex: number
  originalText: string
  correctedText: string
  changeType: 'spelling' | 'grammar' | 'context' | 'punctuation' | 'name'
  confidence: number
  reason?: string
  status: 'pending' | 'accepted' | 'rejected'
}

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

export interface AnalysisProgress {
  stage: 'extracting' | 'uploading' | 'analyzing' | 'comparing' | 'complete' | 'error'
  percent: number
  message: string
}

// ============================================
// Transcription Types (Parakeet)
// ============================================

export interface TranscriptionOptions {
  /** ISO language code or undefined for auto-detection */
  language?: string
  /** Run speaker diarization after transcription */
  diarize?: boolean
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[]
  language: string
  duration: number
  speakers?: SpeakerSegment[]
}

export interface TranscriptionSegment {
  start: number
  end: number
  text: string
  words: TranscriptionWord[]
  speaker?: number
}

export interface TranscriptionWord {
  word: string
  start: number
  end: number
  score: number
}

export interface SpeakerSegment {
  speaker: number
  start: number
  end: number
}

export interface TranscriptionProgress {
  stage: 'initializing' | 'loading' | 'transcribing' | 'diarizing' | 'complete'
  percent: number
  message: string
}

// ============================================
// Model Management Types
// ============================================

export interface ModelStatus {
  /** Main ASR model (Parakeet TDT v3) fully downloaded */
  asrReady: boolean
  /** Diarization model (Sortformer) downloaded */
  diarizationReady: boolean
  /** Total bytes required for the ASR model */
  asrSizeBytes: number
}

export interface ModelDownloadProgress {
  model: 'asr' | 'diarization'
  file: string
  percent: number
  downloadedBytes: number
  totalBytes: number
  status: 'downloading' | 'complete' | 'error'
  error?: string
}

// ============================================
// FFmpeg / Export Types
// ============================================

export interface VideoMetadata {
  duration: number
  width: number
  height: number
  fps: number
  codec: string
  audioCodec: string
}

export interface ResolutionPreset {
  id: string
  label: string
  width: number
  height: number
}

export interface ExportSettings {
  filename: string
  resolution: ResolutionPreset
  quality: 'high' | 'medium' | 'low'
}

export interface ExportOptions {
  outputPath: string
  quality: 'high' | 'medium' | 'low'
  targetWidth: number
  targetHeight: number
  frameDir: string
  fps: number
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
  /** Base64 PNG data (without data URL prefix) */
  data: string
}

// ============================================
// Internationalization (i18n) Types
// ============================================

export type AppLanguage = 'de' | 'en'

export interface LanguageInfo {
  code: AppLanguage
  name: string
  flag: string
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'en', name: 'English', flag: '🇬🇧' }
]

export const DEFAULT_LANGUAGE: AppLanguage = 'de'

// ============================================
// App Settings Types
// ============================================

export interface AppSettings {
  openRouterApiKey?: string
  language?: AppLanguage
  /** Transcription language: ISO code or 'auto' */
  transcriptionLanguage?: string
  /** Run diarization automatically after transcription */
  autoDiarize?: boolean
}

// ============================================
// Project Persistence Types
// ============================================

export interface StoredProjectMeta {
  id: string
  name: string
  videoPath: string
  thumbnailPath: string | null
  duration: number
  createdAt: number
  updatedAt: number
}

export interface StoredProject extends StoredProjectMeta {
  data: Project
}
