/**
 * Text Measurement Utility
 *
 * Provides consistent text measurement using OffscreenCanvas.
 * Can be used outside of React component rendering context.
 */

import type { SubtitleStyle, Subtitle } from '../../shared/types'

/**
 * TextMeasurer - Provides consistent text measurement using OffscreenCanvas
 */
export class TextMeasurer {
  private canvas: OffscreenCanvas
  private ctx: OffscreenCanvasRenderingContext2D

  constructor(width = 1920, height = 1080) {
    this.canvas = new OffscreenCanvas(width, height)
    const ctx = this.canvas.getContext('2d')
    if (!ctx) {
      throw new Error('Failed to get 2d context from OffscreenCanvas')
    }
    this.ctx = ctx
  }

  /**
   * Configure font settings before measurement
   */
  setFont(style: SubtitleStyle): void {
    this.ctx.font = `${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
  }

  /**
   * Measure text width in pixels
   */
  measureText(text: string): number {
    return this.ctx.measureText(text).width
  }

  /**
   * Apply text transform based on style
   */
  applyTextTransform(text: string, style: SubtitleStyle): string {
    if (style.textTransform === 'uppercase') {
      return text.toUpperCase()
    }
    return text
  }

  /**
   * Calculate how many lines text will occupy given max width
   */
  calculateLineCount(text: string, maxWidthPx: number): number {
    const words = text.split(' ')
    let lineCount = 1
    let currentLineText = ''

    for (const word of words) {
      const testLine = currentLineText ? `${currentLineText} ${word}` : word
      const testWidth = this.measureText(testLine)

      if (testWidth > maxWidthPx && currentLineText) {
        lineCount++
        currentLineText = word
      } else {
        currentLineText = testLine
      }
    }

    return lineCount
  }

  /**
   * Check if subtitle needs splitting given style constraints
   */
  needsSplitting(subtitle: Subtitle, style: SubtitleStyle, videoWidth: number): boolean {
    this.setFont(style)
    const text = this.applyTextTransform(
      subtitle.words.map((w) => w.text).join(' '),
      style
    )
    const maxWidthPx = videoWidth * style.maxWidth
    return this.calculateLineCount(text, maxWidthPx) > style.maxLines
  }
}

// Singleton instance for performance
let measurer: TextMeasurer | null = null

/**
 * Get the singleton TextMeasurer instance
 */
export function getTextMeasurer(): TextMeasurer {
  if (!measurer) {
    measurer = new TextMeasurer()
  }
  return measurer
}

/**
 * Reset the singleton (useful for testing or when video resolution changes)
 */
export function resetTextMeasurer(): void {
  measurer = null
}
