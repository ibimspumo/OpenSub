import type { ResolutionPreset } from '../../../shared/types'

// ============================================
// Resolution Presets
// ============================================

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  { id: '720p', label: 'HD (1280 × 720)', width: 1280, height: 720 },
  { id: '1080p', label: 'Full HD (1920 × 1080)', width: 1920, height: 1080 },
  { id: '4k', label: '4K (3840 × 2160)', width: 3840, height: 2160 }
]

// ============================================
// Quality Options
// ============================================

export const QUALITY_OPTIONS = [
  {
    value: 'high' as const,
    label: 'Hoch',
    description: 'Beste Qualitaet, groessere Datei'
  },
  {
    value: 'medium' as const,
    label: 'Mittel',
    description: 'Ausgewogene Qualitaet und Groesse'
  },
  {
    value: 'low' as const,
    label: 'Niedrig',
    description: 'Kleinste Datei, reduzierte Qualitaet'
  }
]

// ============================================
// File Size Estimation
// ============================================

// Base bitrates in Mbps for 4K resolution (matching FFmpegService)
const BASE_VIDEO_BITRATES = {
  high: 50, // 50 Mbps for 4K at high quality
  medium: 32.5, // 65% of high
  low: 20 // 40% of high
}

const AUDIO_BITRATE = 0.256 // 256 kbps

// Reference resolution (4K)
const REFERENCE_PIXELS = 3840 * 2160 // 8,294,400 pixels

interface FileSizeEstimationParams {
  duration: number // in seconds
  targetWidth: number
  targetHeight: number
  quality: 'high' | 'medium' | 'low'
}

/**
 * Estimates the output file size based on resolution, quality, and duration.
 * Uses the same bitrate calculations as FFmpegService.
 */
export function estimateFileSize(params: FileSizeEstimationParams): number {
  const { duration, targetWidth, targetHeight, quality } = params

  // Calculate pixel ratio for resolution scaling
  const targetPixels = targetWidth * targetHeight
  const pixelRatio = targetPixels / REFERENCE_PIXELS

  // Scale video bitrate based on resolution
  const videoBitrateMbps = BASE_VIDEO_BITRATES[quality] * pixelRatio

  // Convert to bits per second
  const videoBps = videoBitrateMbps * 1_000_000
  const audioBps = AUDIO_BITRATE * 1_000_000

  // Total bits = (video + audio) * duration
  const totalBits = (videoBps + audioBps) * duration

  // Convert to bytes
  const totalBytes = totalBits / 8

  return Math.round(totalBytes)
}

/**
 * Formats bytes into a human-readable string (KB, MB, GB).
 */
export function formatFileSize(bytes: number): string {
  if (bytes >= 1_000_000_000) {
    return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  }
  if (bytes >= 1_000_000) {
    return `${(bytes / 1_000_000).toFixed(0)} MB`
  }
  return `${(bytes / 1_000).toFixed(0)} KB`
}

// ============================================
// Resolution Selection Helpers
// ============================================

/**
 * Gets the default resolution preset based on source video dimensions.
 * Returns the highest preset that doesn't exceed the source resolution.
 */
export function getDefaultResolution(
  sourceWidth: number,
  sourceHeight: number
): ResolutionPreset {
  const sourcePixels = sourceWidth * sourceHeight

  // Adjust presets for portrait orientation
  const adjustedPresets = getAdjustedPresetsForOrientation(sourceWidth, sourceHeight)

  // Find the highest resolution that doesn't exceed source
  const validPresets = adjustedPresets.filter((preset) => {
    const presetPixels = preset.width * preset.height
    return presetPixels <= sourcePixels * 1.1 // Allow 10% tolerance
  })

  // Return highest valid preset, or the source-matching one
  if (validPresets.length > 0) {
    return validPresets[validPresets.length - 1]
  }

  // If source is smaller than all presets, return the smallest preset adjusted
  return adjustedPresets[0]
}

/**
 * Returns resolution presets adjusted for portrait/landscape orientation.
 * For portrait videos, swaps width and height.
 */
export function getAdjustedPresetsForOrientation(
  sourceWidth: number,
  sourceHeight: number
): ResolutionPreset[] {
  const isPortrait = sourceHeight > sourceWidth

  if (!isPortrait) {
    return RESOLUTION_PRESETS
  }

  // For portrait videos, swap dimensions
  return RESOLUTION_PRESETS.map((preset) => ({
    ...preset,
    width: preset.height,
    height: preset.width,
    label: preset.label.replace(
      `${preset.width} × ${preset.height}`,
      `${preset.height} × ${preset.width}`
    )
  }))
}

/**
 * Formats duration in seconds to MM:SS format.
 */
export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Generates a default export filename based on project name.
 */
export function getDefaultFilename(projectName: string): string {
  // Remove file extension if present
  const baseName = projectName.replace(/\.[^/.]+$/, '')
  return `${baseName}_subtitled`
}
