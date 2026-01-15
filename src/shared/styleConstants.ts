/**
 * Centralized Style Constants for OpenSub
 *
 * This is the SINGLE SOURCE OF TRUTH for all style-related constants.
 * All rendering, UI, and export code should import from here.
 */

import type { SubtitlePosition, AnimationType } from './types'

// ============================================
// RENDERING CONSTANTS
// ============================================

export const RENDERING_CONSTANTS = {
  /** Multiplier for line height calculation: fontSize * LINE_HEIGHT_MULTIPLIER */
  LINE_HEIGHT_MULTIPLIER: 1.4,

  /** Multiplier for outline width in canvas stroke: outlineWidth * OUTLINE_WIDTH_MULTIPLIER */
  OUTLINE_WIDTH_MULTIPLIER: 2,

  /** Average character width estimate for text wrapping: fontSize * CHARACTER_WIDTH_ESTIMATE */
  CHARACTER_WIDTH_ESTIMATE: 0.55,

  /** Boundary limits for subtitle position (0-1 range) */
  POSITION_BOUNDARIES: {
    MIN: 0.1,
    MAX: 0.9
  },

  /** Font weight threshold for bold detection in ASS export */
  BOLD_WEIGHT_THRESHOLD: 600
} as const

// ============================================
// ANIMATION CONSTANTS
// ============================================

export const ANIMATION_CONSTANTS = {
  /** Duration of fade in/out animations in seconds */
  FADE_DURATION: 0.3,

  /** Duration of scale animation in seconds */
  SCALE_DURATION: 0.15,

  /** Maximum scale multiplier for scale animation (1 + SCALE_AMPLITUDE) */
  SCALE_AMPLITUDE: 0.2,

  /** Opacity of words not yet spoken in karaoke mode */
  UPCOMING_WORD_OPACITY: 0.6,

  /** Shadow blur for the currently highlighted karaoke word */
  KARAOKE_HIGHLIGHT_SHADOW_BLUR: 10,

  /** Fade duration in milliseconds for ASS export */
  FADE_MS: 300
} as const

// ============================================
// UI CONSTANTS
// ============================================

export const UI_CONSTANTS = {
  /** Padding around subtitle bounding box for hit testing */
  SUBTITLE_PADDING: 15,

  /** Color for snap guide lines during drag */
  SNAP_LINE_COLOR: 'rgba(59, 130, 246, 0.5)',

  /** Dash pattern for snap lines */
  SNAP_LINE_DASH: [5, 5] as number[],

  /** Color for drag indicator border */
  DRAG_INDICATOR_COLOR: 'rgba(59, 130, 246, 0.8)',

  /** Color for hover indicator border */
  HOVER_INDICATOR_COLOR: 'rgba(255, 255, 255, 0.3)',

  /** Default vertical margin for ASS export */
  DEFAULT_MARGIN_V: 30,

  /** Position percentages for position preview */
  POSITION_PREVIEW: {
    top: '12%',
    center: '50%',
    bottom: '85%'
  }
} as const

// ============================================
// SLIDER RANGES
// ============================================

export interface SliderRange {
  min: number
  max: number
  step: number
  unit?: string
}

export const SLIDER_RANGES: Record<string, SliderRange> = {
  fontSize: { min: 24, max: 144, step: 1, unit: 'px' },
  outlineWidth: { min: 0, max: 50, step: 1, unit: 'px' },
  shadowBlur: { min: 0, max: 100, step: 1, unit: 'px' },
  shadowOffsetX: { min: -50, max: 50, step: 1, unit: 'px' },
  shadowOffsetY: { min: -50, max: 50, step: 1, unit: 'px' },
  maxWidth: { min: 50, max: 100, step: 5, unit: '%' },
  karaokeBoxPadding: { min: 0, max: 100, step: 1, unit: 'px' },
  karaokeBoxBorderRadius: { min: 0, max: 300, step: 1, unit: 'px' }
} as const

// ============================================
// COLOR PRESETS
// ============================================

export const COLOR_PRESETS = {
  /** Grayscale palette for text colors */
  text: ['#FFFFFF', '#F8F8F8', '#E8E8E8', '#D0D0D0', '#A0A0A0', '#808080', '#404040', '#000000'],

  /** Vibrant colors for highlight */
  highlight: ['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00'],

  /** Dark grays for upcoming words */
  upcoming: ['#808080', '#A0A0A0', '#606060', '#505050', '#707070', '#909090', '#B0B0B0', '#404040'],

  /** Black/dark palette for outlines */
  outline: ['#000000', '#1A1A1A', '#333333', '#4A4A4A', '#666666', '#0A0A0A', '#2D2D2D', '#1F1F1F'],

  /** Black/dark palette for shadows */
  shadow: ['#000000', '#1A1A1A', '#333333', '#0A0A0A', '#2D2D2D', '#1F1F1F', '#4A4A4A', '#666666'],

  /** Bright/saturated colors for karaoke box */
  karaokeBox: ['#32CD32', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FF8C00', '#9B59B6', '#E74C3C']
} as const

// ============================================
// POSITION & ANIMATION OPTIONS (for UI dropdowns)
// ============================================

export const POSITION_OPTIONS: { value: SubtitlePosition; label: string }[] = [
  { value: 'top', label: 'Oben' },
  { value: 'center', label: 'Mitte' },
  { value: 'bottom', label: 'Unten' }
]

export const ANIMATION_OPTIONS: { value: AnimationType; label: string }[] = [
  { value: 'karaoke', label: 'Karaoke' },
  { value: 'appear', label: 'Erscheinen' },
  { value: 'fade', label: 'Einblenden' },
  { value: 'scale', label: 'Skalieren' },
  { value: 'none', label: 'Keine' }
]

// ============================================
// ASS (Advanced SubStation Alpha) CONSTANTS
// ============================================

export const ASS_CONSTANTS = {
  /** ASS alignment values for vertical position */
  ALIGNMENT: {
    top: 8,
    center: 5,
    bottom: 2
  } as Record<string, number>,

  /** Font name mapping from CSS to ASS (libass) format */
  FONT_NAME_MAP: {
    'Inter': 'Inter',
    'SF Pro': 'SF Pro',
    'SF Pro Display': 'SF Pro Display',
    'SF Pro Text': 'SF Pro Text',
    'system-ui': 'Helvetica Neue',
    'sans-serif': 'Helvetica Neue',
    '-apple-system': 'SF Pro Text',
    'BlinkMacSystemFont': 'SF Pro Text',
    'Segoe UI': 'Helvetica Neue',
    'Roboto': 'Roboto',
    'Arial': 'Arial',
    'Helvetica': 'Helvetica',
    'Helvetica Neue': 'Helvetica Neue'
  } as Record<string, string>
} as const

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get rendering constants as a plain object for passing to web workers.
 * Web workers cannot import modules, so we pass constants via message.
 */
export function getRenderingConstantsForWorker() {
  return {
    lineHeightMultiplier: RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER,
    outlineWidthMultiplier: RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER,
    characterWidthEstimate: RENDERING_CONSTANTS.CHARACTER_WIDTH_ESTIMATE,
    positionBoundaries: { ...RENDERING_CONSTANTS.POSITION_BOUNDARIES },
    fadeDuration: ANIMATION_CONSTANTS.FADE_DURATION,
    scaleDuration: ANIMATION_CONSTANTS.SCALE_DURATION,
    scaleAmplitude: ANIMATION_CONSTANTS.SCALE_AMPLITUDE,
    upcomingWordOpacity: ANIMATION_CONSTANTS.UPCOMING_WORD_OPACITY,
    karaokeHighlightShadowBlur: ANIMATION_CONSTANTS.KARAOKE_HIGHLIGHT_SHADOW_BLUR
  }
}

/** Type for rendering constants passed to web workers */
export type WorkerRenderingConstants = ReturnType<typeof getRenderingConstantsForWorker>

/**
 * Get the ASS font name for a CSS font family string.
 * @param fontFamily - CSS font family string (may include fallbacks)
 * @returns The ASS-compatible font name
 */
export function getFontNameForASS(fontFamily: string): string {
  const primaryFont = fontFamily.split(',')[0].trim().replace(/['"]/g, '')
  return ASS_CONSTANTS.FONT_NAME_MAP[primaryFont] || primaryFont
}

/**
 * Get ASS alignment value for a subtitle position.
 * @param position - Subtitle position ('top', 'center', 'bottom')
 * @returns ASS alignment number
 */
export function getASSAlignment(position: string): number {
  return ASS_CONSTANTS.ALIGNMENT[position] ?? ASS_CONSTANTS.ALIGNMENT.bottom
}
