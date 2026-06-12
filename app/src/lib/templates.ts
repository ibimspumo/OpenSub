/**
 * Curated style templates for the template gallery.
 * Each template is a complete SubtitleStyle so applying one is predictable.
 */

import type { StyleTemplate } from './types'
import { DEFAULT_SUBTITLE_STYLE } from './types'

export const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    id: 'agentz',
    nameKey: 'templates.agentz',
    name: 'Neon Pop',
    previewText: 'NEON POP',
    style: { ...DEFAULT_SUBTITLE_STYLE }
  },
  {
    id: 'hormozi',
    nameKey: 'templates.hormozi',
    name: 'Hormozi',
    previewText: 'BIG IMPACT',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Montserrat, sans-serif',
      fontWeight: 900,
      textTransform: 'uppercase',
      color: '#FFFFFF',
      highlightColor: '#FFD700',
      upcomingColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 3,
      shadowColor: '#000000',
      shadowOpacity: 55,
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      animation: 'karaoke',
      karaokeBoxEnabled: false,
      karaokeGlowEnabled: false
    }
  },
  {
    id: 'beast',
    nameKey: 'templates.beast',
    name: 'Comic Punch',
    previewText: 'WOW!',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Bangers, cursive',
      fontWeight: 400,
      textTransform: 'uppercase',
      color: '#FFFFFF',
      highlightColor: '#FF3131',
      upcomingColor: '#FFFFFF',
      outlineColor: '#000000',
      outlineWidth: 8,
      shadowOpacity: 80,
      shadowBlur: 0,
      shadowOffsetX: 4,
      shadowOffsetY: 4,
      animation: 'scale',
      karaokeBoxEnabled: false,
      karaokeGlowEnabled: false
    }
  },
  {
    id: 'clean',
    nameKey: 'templates.clean',
    name: 'Clean Minimal',
    previewText: 'Clean & easy',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Inter, system-ui, sans-serif',
      fontWeight: 600,
      textTransform: 'none',
      color: '#FFFFFF',
      highlightColor: '#FFFFFF',
      upcomingColor: 'rgba(255,255,255,0.65)' as unknown as string,
      outlineWidth: 0,
      shadowColor: '#000000',
      shadowOpacity: 70,
      shadowBlur: 24,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      animation: 'fade',
      karaokeBoxEnabled: false,
      karaokeGlowEnabled: false,
      maxWidth: 0.6
    }
  },
  {
    id: 'glow',
    nameKey: 'templates.glow',
    name: 'Neon Glow',
    previewText: 'GLOW UP',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Poppins, sans-serif',
      fontWeight: 800,
      textTransform: 'uppercase',
      color: '#FFFFFF',
      highlightColor: '#D6B4FF',
      upcomingColor: '#FFFFFF',
      outlineWidth: 0,
      shadowOpacity: 100,
      shadowBlur: 40,
      animation: 'karaoke',
      karaokeBoxEnabled: false,
      karaokeGlowEnabled: true,
      karaokeGlowColor: '#A855F7',
      karaokeGlowOpacity: 100,
      karaokeGlowBlur: 30
    }
  },
  {
    id: 'podcast',
    nameKey: 'templates.podcast',
    name: 'Podcast',
    previewText: 'Word for word',
    style: {
      ...DEFAULT_SUBTITLE_STYLE,
      fontFamily: 'Lexend, sans-serif',
      fontWeight: 500,
      textTransform: 'none',
      color: 'rgba(255,255,255,0.92)' as unknown as string,
      highlightColor: '#BDFF01',
      upcomingColor: 'rgba(255,255,255,0.45)' as unknown as string,
      outlineWidth: 0,
      shadowOpacity: 80,
      shadowBlur: 16,
      animation: 'karaoke',
      karaokeBoxEnabled: false,
      karaokeGlowEnabled: false,
      maxWidth: 0.6,
      maxLines: 2,
      position: 'bottom',
      positionX: 0.5,
      positionY: 0.85
    }
  }
]
