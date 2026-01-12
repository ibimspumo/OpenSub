/**
 * SubtitleFrameRenderer - Renders subtitle frames to PNG for video export
 *
 * This replicates the exact rendering logic from SubtitleCanvas to ensure
 * pixel-perfect matching between preview and export.
 *
 * Uses Web Workers for parallel rendering on multi-core systems.
 * M2 Max with 10+ cores can achieve ~8-10x speedup.
 */

import type { Subtitle, SubtitleStyle, Word } from '../../shared/types'
import { getWorkerPool, terminateWorkerPool as _terminateWorkerPool, type FrameResult } from './workerPool'

// Re-export for cleanup
export const cleanupWorkerPool = _terminateWorkerPool

/**
 * Scale factor for style values to match editor preview appearance.
 * The editor uses DPR (Device Pixel Ratio) scaling via canvas transform,
 * which makes outlines and shadows appear thicker. We apply the same
 * scaling to style values here to ensure export matches the preview.
 * Default: 2 for Retina displays (standard on modern Macs)
 */
const STYLE_SCALE = 2

/**
 * Create a scaled copy of the style for export rendering
 * This scales outline width, shadow blur, and karaoke box padding
 * to match the visual appearance in the editor (which uses DPR scaling)
 */
function scaleStyleForExport(style: SubtitleStyle): SubtitleStyle {
  return {
    ...style,
    outlineWidth: style.outlineWidth * STYLE_SCALE,
    shadowBlur: style.shadowBlur * STYLE_SCALE,
    karaokeBoxPadding: style.karaokeBoxPadding * STYLE_SCALE,
    karaokeBoxBorderRadius: style.karaokeBoxBorderRadius * STYLE_SCALE
  }
}

interface RenderOptions {
  width: number
  height: number
  currentTime: number
  subtitles: Subtitle[]
  style: SubtitleStyle
}

interface FrameInfo {
  startTime: number
  endTime: number
  dataUrl: string
}

/**
 * Create an OffscreenCanvas for rendering subtitle frames
 */
function createCanvas(width: number, height: number): OffscreenCanvas {
  return new OffscreenCanvas(width, height)
}

/**
 * Find the current subtitle at a given time
 */
function getCurrentSubtitle(subtitles: Subtitle[], currentTime: number): Subtitle | undefined {
  return subtitles.find(
    (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
  )
}

/**
 * Get current word index for karaoke animation
 */
function getCurrentWordIndex(subtitle: Subtitle, currentTime: number): number {
  for (let i = 0; i < subtitle.words.length; i++) {
    const word = subtitle.words[i]
    if (currentTime >= word.startTime && currentTime <= word.endTime) {
      return i
    }
    if (i < subtitle.words.length - 1) {
      const nextWord = subtitle.words[i + 1]
      if (currentTime > word.endTime && currentTime < nextWord.startTime) {
        return i
      }
    }
  }
  if (
    subtitle.words.length > 0 &&
    currentTime > subtitle.words[subtitle.words.length - 1].endTime
  ) {
    return subtitle.words.length - 1
  }
  return -1
}

/**
 * Wrap text into multiple lines based on maxWidth and maxLines
 */
function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidthPx: number,
  maxLines: number
): string[] {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word
    const metrics = ctx.measureText(testLine)

    if (metrics.width > maxWidthPx && currentLine) {
      lines.push(currentLine)
      currentLine = word

      if (lines.length >= maxLines) {
        const remainingWords = words.slice(words.indexOf(word))
        const lastLine = remainingWords.join(' ')
        if (ctx.measureText(lastLine).width > maxWidthPx) {
          let truncated = lines[lines.length - 1]
          for (const remaining of remainingWords) {
            const testTruncated = `${truncated} ${remaining}`
            if (ctx.measureText(testTruncated + '...').width <= maxWidthPx) {
              truncated = testTruncated
            } else {
              break
            }
          }
          lines[lines.length - 1] = truncated
        } else {
          lines[lines.length - 1] = lastLine
        }
        return lines.slice(0, maxLines)
      }
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines.slice(0, maxLines)
}

/**
 * Get wrapped lines for a subtitle
 */
function getWrappedLines(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  displayWidth: number,
  style: SubtitleStyle
): string[] {
  const text = subtitle.words.map((w) => w.text).join(' ')
  const maxWidthPx = displayWidth * style.maxWidth
  return wrapText(ctx, text, maxWidthPx, style.maxLines)
}

/**
 * Draw a rounded rectangle
 */
function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
): void {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + width - radius, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius)
  ctx.lineTo(x + width, y + height - radius)
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  ctx.lineTo(x + radius, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius)
  ctx.lineTo(x, y + radius)
  ctx.quadraticCurveTo(x, y, x + radius, y)
  ctx.closePath()
}

/**
 * Render karaoke animation
 */
function renderKaraoke(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  currentWordIndex: number,
  x: number,
  y: number,
  fontSize: number,
  displayWidth: number,
  style: SubtitleStyle
): void {
  const lines = getWrappedLines(ctx, subtitle, displayWidth, style)
  const lineHeight = fontSize * 1.4
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  // Build word-to-line mapping
  const wordLineMap: { line: number; wordInLine: number }[] = []

  lines.forEach((line, lineIndex) => {
    const lineWords = line.split(' ')
    lineWords.forEach((_, wordInLineIndex) => {
      wordLineMap.push({ line: lineIndex, wordInLine: wordInLineIndex })
    })
  })

  // Render each line
  lines.forEach((line, lineIndex) => {
    const lineY = startY + lineIndex * lineHeight
    const lineWords = line.split(' ')
    const lineWidth = ctx.measureText(line).width
    let currentX = x - lineWidth / 2

    lineWords.forEach((wordText, wordInLineIndex) => {
      const globalWordIndex = wordLineMap.findIndex(
        (w) => w.line === lineIndex && w.wordInLine === wordInLineIndex
      )

      const wordWidth = ctx.measureText(wordText).width
      const spaceWidth = wordInLineIndex < lineWords.length - 1 ? ctx.measureText(' ').width : 0
      const wordX = currentX + wordWidth / 2

      const isPast = globalWordIndex < currentWordIndex
      const isCurrent = globalWordIndex === currentWordIndex

      // Draw karaoke box behind the current word if enabled
      if (isCurrent && style.karaokeBoxEnabled) {
        ctx.save()
        const padding = style.karaokeBoxPadding
        const boxX = currentX - padding
        const boxY = lineY - fontSize / 2 - padding
        const boxWidth = wordWidth + padding * 2
        const boxHeight = fontSize + padding * 2
        const borderRadius = Math.min(style.karaokeBoxBorderRadius, boxHeight / 2, boxWidth / 2)

        ctx.fillStyle = style.karaokeBoxColor
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0

        drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, borderRadius)
        ctx.fill()
        ctx.restore()
      }

      ctx.strokeStyle = style.outlineColor
      ctx.lineWidth = style.outlineWidth * 2
      ctx.lineJoin = 'round'

      if (isCurrent) {
        ctx.shadowColor = style.highlightColor
        ctx.shadowBlur = 10
      } else {
        ctx.shadowColor = style.shadowColor
        ctx.shadowBlur = style.shadowBlur
      }

      ctx.strokeText(wordText, wordX, lineY)

      ctx.fillStyle = isCurrent ? style.highlightColor : isPast ? style.color : style.color
      ctx.globalAlpha = isPast || isCurrent ? 1 : 0.6
      ctx.fillText(wordText, wordX, lineY)
      ctx.globalAlpha = 1

      ctx.shadowBlur = 0
      currentX += wordWidth + spaceWidth
    })
  })
}

/**
 * Render appear animation (words appear one by one)
 */
function renderAppear(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  currentWordIndex: number,
  x: number,
  y: number,
  fontSize: number,
  displayWidth: number,
  style: SubtitleStyle
): void {
  const visibleWords = subtitle.words.slice(0, currentWordIndex + 1)
  if (visibleWords.length === 0) return

  const visibleSubtitle = { ...subtitle, words: visibleWords }

  const lines = getWrappedLines(ctx, visibleSubtitle, displayWidth, style)
  const lineHeight = fontSize * 1.4

  const fullLines = getWrappedLines(ctx, subtitle, displayWidth, style)
  const totalHeight = fullLines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  ctx.shadowColor = style.shadowColor
  ctx.shadowBlur = style.shadowBlur
  ctx.strokeStyle = style.outlineColor
  ctx.lineWidth = style.outlineWidth * 2
  ctx.lineJoin = 'round'

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    ctx.strokeText(line, x, lineY)
    ctx.fillStyle = style.color
    ctx.fillText(line, x, lineY)
  })

  ctx.shadowBlur = 0
}

/**
 * Render fade animation
 */
function renderFade(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  currentTime: number,
  x: number,
  y: number,
  fontSize: number,
  displayWidth: number,
  style: SubtitleStyle
): void {
  const lines = getWrappedLines(ctx, subtitle, displayWidth, style)
  const lineHeight = fontSize * 1.4
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  const fadeInDuration = 0.3
  const fadeOutDuration = 0.3

  let alpha = 1
  const elapsed = currentTime - subtitle.startTime
  const remaining = subtitle.endTime - currentTime

  if (elapsed < fadeInDuration) {
    alpha = elapsed / fadeInDuration
  } else if (remaining < fadeOutDuration) {
    alpha = remaining / fadeOutDuration
  }

  ctx.globalAlpha = alpha
  ctx.shadowColor = style.shadowColor
  ctx.shadowBlur = style.shadowBlur
  ctx.strokeStyle = style.outlineColor
  ctx.lineWidth = style.outlineWidth * 2
  ctx.lineJoin = 'round'

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    ctx.strokeText(line, x, lineY)
    ctx.fillStyle = style.color
    ctx.fillText(line, x, lineY)
  })

  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

/**
 * Render scale animation
 */
function renderScale(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  currentWordIndex: number,
  currentTime: number,
  x: number,
  y: number,
  fontSize: number,
  displayWidth: number,
  style: SubtitleStyle
): void {
  const lines = getWrappedLines(ctx, subtitle, displayWidth, style)
  const lineHeight = fontSize * 1.4
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  const wordLineMap: { line: number; wordInLine: number }[] = []

  lines.forEach((line, lineIndex) => {
    const lineWords = line.split(' ')
    lineWords.forEach((_, wordInLineIndex) => {
      wordLineMap.push({ line: lineIndex, wordInLine: wordInLineIndex })
    })
  })

  lines.forEach((line, lineIndex) => {
    const lineY = startY + lineIndex * lineHeight
    const lineWords = line.split(' ')
    const lineWidth = ctx.measureText(line).width
    let currentX = x - lineWidth / 2

    lineWords.forEach((wordText, wordInLineIndex) => {
      const globalWordIndex = wordLineMap.findIndex(
        (w) => w.line === lineIndex && w.wordInLine === wordInLineIndex
      )

      const wordWidth = ctx.measureText(wordText).width
      const spaceWidth = wordInLineIndex < lineWords.length - 1 ? ctx.measureText(' ').width : 0
      const wordX = currentX + wordWidth / 2

      const isCurrent = globalWordIndex === currentWordIndex

      ctx.save()

      if (isCurrent) {
        const word = subtitle.words[globalWordIndex]
        if (word) {
          const scaleProgress = Math.min(1, (currentTime - word.startTime) / 0.15)
          const scale = 1 + 0.2 * Math.sin(scaleProgress * Math.PI)

          ctx.translate(wordX, lineY)
          ctx.scale(scale, scale)
          ctx.translate(-wordX, -lineY)
        }
      }

      ctx.shadowColor = style.shadowColor
      ctx.shadowBlur = style.shadowBlur
      ctx.strokeStyle = style.outlineColor
      ctx.lineWidth = style.outlineWidth * 2
      ctx.lineJoin = 'round'
      ctx.strokeText(wordText, wordX, lineY)

      ctx.fillStyle = isCurrent ? style.highlightColor : style.color
      ctx.fillText(wordText, wordX, lineY)

      ctx.restore()
      currentX += wordWidth + spaceWidth
    })
  })
}

/**
 * Render static text (no animation)
 */
function renderStatic(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  x: number,
  y: number,
  fontSize: number,
  displayWidth: number,
  style: SubtitleStyle
): void {
  const lines = getWrappedLines(ctx, subtitle, displayWidth, style)
  const lineHeight = fontSize * 1.4
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  ctx.shadowColor = style.shadowColor
  ctx.shadowBlur = style.shadowBlur
  ctx.strokeStyle = style.outlineColor
  ctx.lineWidth = style.outlineWidth * 2
  ctx.lineJoin = 'round'

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    ctx.strokeText(line, x, lineY)
    ctx.fillStyle = style.color
    ctx.fillText(line, x, lineY)
  })

  ctx.shadowBlur = 0
}

/**
 * Render a single subtitle frame at a specific time
 */
export function renderSubtitleFrame(options: RenderOptions): string | null {
  const { width, height, currentTime, subtitles, style } = options

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  // Clear canvas (transparent background)
  ctx.clearRect(0, 0, width, height)

  const currentSubtitle = getCurrentSubtitle(subtitles, currentTime)
  if (!currentSubtitle || currentSubtitle.words.length === 0) {
    return null
  }

  const currentWordIndex = getCurrentWordIndex(currentSubtitle, currentTime)

  // Set up font
  const fontSize = style.fontSize
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Calculate position
  const xCenter = width * style.positionX
  const yPosition = height * style.positionY

  // Render based on animation type
  switch (style.animation) {
    case 'karaoke':
      renderKaraoke(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, width, style)
      break
    case 'appear':
      renderAppear(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, width, style)
      break
    case 'fade':
      renderFade(ctx, currentSubtitle, currentTime, xCenter, yPosition, fontSize, width, style)
      break
    case 'scale':
      renderScale(ctx, currentSubtitle, currentWordIndex, currentTime, xCenter, yPosition, fontSize, width, style)
      break
    default:
      renderStatic(ctx, currentSubtitle, xCenter, yPosition, fontSize, width, style)
  }

  // Convert to data URL
  return canvas.convertToBlob({ type: 'image/png' }).then(blob => {
    return new Promise<string>((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve(reader.result as string)
      reader.readAsDataURL(blob)
    })
  }) as unknown as string
}

/**
 * Render a subtitle frame and return as Blob
 */
export async function renderSubtitleFrameAsBlob(options: RenderOptions): Promise<Blob | null> {
  const { width, height, currentTime, subtitles, style } = options

  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, width, height)

  const currentSubtitle = getCurrentSubtitle(subtitles, currentTime)
  if (!currentSubtitle || currentSubtitle.words.length === 0) {
    return null
  }

  const currentWordIndex = getCurrentWordIndex(currentSubtitle, currentTime)

  // Scale style values to match editor DPR behavior
  const scaledStyle = scaleStyleForExport(style)

  const fontSize = scaledStyle.fontSize
  ctx.font = `${scaledStyle.fontWeight} ${fontSize}px ${scaledStyle.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const xCenter = width * scaledStyle.positionX
  const yPosition = height * scaledStyle.positionY

  switch (scaledStyle.animation) {
    case 'karaoke':
      renderKaraoke(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, width, scaledStyle)
      break
    case 'appear':
      renderAppear(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, width, scaledStyle)
      break
    case 'fade':
      renderFade(ctx, currentSubtitle, currentTime, xCenter, yPosition, fontSize, width, scaledStyle)
      break
    case 'scale':
      renderScale(ctx, currentSubtitle, currentWordIndex, currentTime, xCenter, yPosition, fontSize, width, scaledStyle)
      break
    default:
      renderStatic(ctx, currentSubtitle, xCenter, yPosition, fontSize, width, scaledStyle)
  }

  return canvas.convertToBlob({ type: 'image/png' })
}

/**
 * Calculate all unique frames needed for export
 * This generates frames at key moments (word changes, subtitle changes)
 */
export function calculateFrameTimes(
  subtitles: Subtitle[],
  fps: number,
  animation: string
): number[] {
  const frameTimes: Set<number> = new Set()
  const frameInterval = 1 / fps

  for (const subtitle of subtitles) {
    // Add frame at subtitle start
    frameTimes.add(subtitle.startTime)

    if (animation === 'karaoke' || animation === 'appear' || animation === 'scale') {
      // For word-based animations, add frame at each word change
      for (const word of subtitle.words) {
        frameTimes.add(word.startTime)
        // Add a few frames during word transition for smooth animation
        const wordDuration = word.endTime - word.startTime
        const steps = Math.min(5, Math.ceil(wordDuration / frameInterval))
        for (let i = 1; i <= steps; i++) {
          frameTimes.add(word.startTime + (wordDuration * i) / steps)
        }
      }
    } else if (animation === 'fade') {
      // For fade animation, add frames during fade in/out
      const fadeDuration = 0.3
      const fadeSteps = Math.ceil(fadeDuration / frameInterval)

      // Fade in frames
      for (let i = 0; i <= fadeSteps; i++) {
        frameTimes.add(subtitle.startTime + (fadeDuration * i) / fadeSteps)
      }

      // Fade out frames
      for (let i = 0; i <= fadeSteps; i++) {
        frameTimes.add(subtitle.endTime - fadeDuration + (fadeDuration * i) / fadeSteps)
      }
    }

    // Add frame at subtitle end
    frameTimes.add(subtitle.endTime)
  }

  return Array.from(frameTimes).sort((a, b) => a - b)
}

/**
 * Generate all subtitle frames for export using parallel Web Workers
 * Returns an array of frame info with timing and image data
 *
 * This uses a worker pool to render frames in parallel, achieving
 * significant speedup on multi-core systems (8-10x on M2 Max).
 */
export async function generateExportFrames(
  subtitles: Subtitle[],
  style: SubtitleStyle,
  width: number,
  height: number,
  fps: number,
  onProgress?: (percent: number) => void
): Promise<FrameInfo[]> {
  const frameTimes = calculateFrameTimes(subtitles, fps, style.animation)

  if (frameTimes.length === 0) {
    return []
  }

  // Build render tasks for workers
  const tasks = frameTimes.map((time, index) => {
    // Determine end time (next frame time or end of current subtitle)
    const currentSubtitle = getCurrentSubtitle(subtitles, time)
    const endTime = index < frameTimes.length - 1
      ? frameTimes[index + 1]
      : (currentSubtitle?.endTime ?? time + 0.1)

    return {
      width,
      height,
      currentTime: time,
      subtitles,
      style,
      startTime: time,
      endTime
    }
  })

  // Get worker pool and render in parallel
  const pool = getWorkerPool()
  console.log(`Rendering ${tasks.length} frames using ${pool.size} workers...`)
  const startTime = performance.now()

  const results = await pool.renderFrames(tasks, (completed, total) => {
    if (onProgress) {
      onProgress((completed / total) * 100)
    }
  })

  const elapsed = ((performance.now() - startTime) / 1000).toFixed(2)
  console.log(`Frame rendering completed in ${elapsed}s (${(tasks.length / parseFloat(elapsed)).toFixed(1)} frames/sec)`)

  // Convert to FrameInfo format
  const frames: FrameInfo[] = results.map((result) => ({
    startTime: result.startTime,
    endTime: result.endTime,
    dataUrl: result.dataUrl
  }))

  return frames
}

/**
 * Generate frames sequentially (fallback if workers fail)
 */
export async function generateExportFramesSequential(
  subtitles: Subtitle[],
  style: SubtitleStyle,
  width: number,
  height: number,
  fps: number,
  onProgress?: (percent: number) => void
): Promise<FrameInfo[]> {
  const frames: FrameInfo[] = []
  const frameTimes = calculateFrameTimes(subtitles, fps, style.animation)

  for (let i = 0; i < frameTimes.length; i++) {
    const time = frameTimes[i]
    const blob = await renderSubtitleFrameAsBlob({
      width,
      height,
      currentTime: time,
      subtitles,
      style
    })

    if (blob) {
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })

      // Determine end time (next frame time or end of current subtitle)
      const currentSubtitle = getCurrentSubtitle(subtitles, time)
      const endTime = i < frameTimes.length - 1
        ? frameTimes[i + 1]
        : (currentSubtitle?.endTime ?? time + 0.1)

      frames.push({
        startTime: time,
        endTime,
        dataUrl
      })
    }

    if (onProgress) {
      onProgress(((i + 1) / frameTimes.length) * 100)
    }
  }

  return frames
}

/**
 * Convert data URL to Buffer for saving to file
 */
export function dataUrlToBuffer(dataUrl: string): Buffer {
  const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '')
  return Buffer.from(base64Data, 'base64')
}
