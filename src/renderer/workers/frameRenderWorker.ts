/**
 * Web Worker for parallel subtitle frame rendering
 * Uses OffscreenCanvas for hardware-accelerated rendering in worker threads
 */

import type { Subtitle, SubtitleStyle, Word } from '../../shared/types'
import {
  RENDERING_CONSTANTS,
  ANIMATION_CONSTANTS
} from '../../shared/styleConstants'

interface RenderTask {
  id: number
  width: number
  height: number
  currentTime: number
  subtitles: Subtitle[]
  style: SubtitleStyle
  startTime: number
  endTime: number
}

interface RenderResult {
  id: number
  success: boolean
  data?: string // Base64 PNG data
  startTime: number
  endTime: number
  error?: string
}

// Message types
type WorkerMessage =
  | { type: 'render'; tasks: RenderTask[] }
  | { type: 'init'; workerIndex: number }
  | { type: 'loadFont'; family: string; weight: number }

type WorkerResponse =
  | { type: 'ready'; workerIndex: number }
  | { type: 'results'; results: RenderResult[] }
  | { type: 'progress'; completed: number; total: number }
  | { type: 'fontLoaded'; family: string; weight: number; success: boolean }

let workerIndex = 0

// Cache of loaded fonts in this worker
const loadedFontsInWorker = new Set<string>()

/**
 * Load a Google Font directly in the worker using FontFace API
 * Workers don't have access to the main thread's document.fonts,
 * so we need to fetch and load fonts ourselves
 *
 * IMPORTANT: Google Fonts CSS contains multiple @font-face rules for different
 * unicode ranges (latin, latin-ext, devanagari, etc.). We need to load ALL of them
 * to ensure all characters render correctly.
 */
async function loadFontInWorker(family: string, weight: number): Promise<boolean> {
  const cacheKey = `${family}:${weight}`
  if (loadedFontsInWorker.has(cacheKey)) {
    console.log(`[Worker] Font already loaded: ${family} ${weight}`)
    return true
  }

  try {
    console.log(`[Worker] Starting font load: ${family} ${weight}`)

    // Fetch the Google Fonts CSS to get all woff2 URLs
    const cssUrl = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${weight}&display=swap`
    const response = await fetch(cssUrl)
    const css = await response.text()

    // Parse CSS to find ALL woff2 URLs (for different unicode ranges)
    // Google Fonts returns multiple @font-face rules for latin, latin-ext, etc.
    const woff2Regex = /url\((https:\/\/fonts\.gstatic\.com[^)]+\.woff2)\)/g
    const woff2Urls: string[] = []
    let match
    while ((match = woff2Regex.exec(css)) !== null) {
      woff2Urls.push(match[1])
    }

    if (woff2Urls.length === 0) {
      console.warn(`[Worker] Could not find any woff2 URLs for ${family} ${weight}`)
      return false
    }

    console.log(`[Worker] Found ${woff2Urls.length} font subsets to load`)

    // Load ALL font subsets in parallel
    const loadPromises = woff2Urls.map(async (fontUrl, index) => {
      try {
        const fontResponse = await fetch(fontUrl)
        const fontData = await fontResponse.arrayBuffer()
        console.log(`[Worker] Font subset ${index + 1}/${woff2Urls.length} downloaded: ${fontData.byteLength} bytes`)

        // Create FontFace with the actual font data
        const font = new FontFace(family, fontData, {
          weight: String(weight),
          style: 'normal'
        })

        await font.load()

        // Add to worker's font set
        // @ts-expect-error - Workers have fonts property in modern browsers
        self.fonts.add(font)

        return true
      } catch (err) {
        console.warn(`[Worker] Failed to load font subset from ${fontUrl}:`, err)
        return false
      }
    })

    const results = await Promise.all(loadPromises)
    const successCount = results.filter(Boolean).length

    console.log(`[Worker] Loaded ${successCount}/${woff2Urls.length} font subsets for ${family} ${weight}`)

    if (successCount === 0) {
      console.error(`[Worker] Failed to load any font subsets for ${family} ${weight}`)
      return false
    }

    // Verify the font was added successfully
    // @ts-expect-error - Workers have fonts property in modern browsers
    const fontsInWorker = Array.from(self.fonts).map((f: FontFace) => `${f.family}:${f.weight}`)
    console.log(`[Worker] Fonts now available in worker:`, fontsInWorker)

    loadedFontsInWorker.add(cacheKey)
    console.log(`[Worker] Font fully loaded and ready: ${family} ${weight}`)
    return true
  } catch (error) {
    console.error(`[Worker] Failed to load font ${family} ${weight}:`, error)
    return false
  }
}

// Listen for messages from main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data

  if (message.type === 'init') {
    workerIndex = message.workerIndex
    self.postMessage({ type: 'ready', workerIndex } as WorkerResponse)
    return
  }

  if (message.type === 'loadFont') {
    const success = await loadFontInWorker(message.family, message.weight)
    self.postMessage({
      type: 'fontLoaded',
      family: message.family,
      weight: message.weight,
      success
    } as WorkerResponse)
    return
  }

  if (message.type === 'render') {
    // Ensure font is loaded before rendering
    const firstTask = message.tasks[0]
    if (firstTask) {
      const weight = typeof firstTask.style.fontWeight === 'number'
        ? firstTask.style.fontWeight
        : firstTask.style.fontWeight === 'bold' ? 700 : 400
      // Extract font family and strip quotes (value is like '"Poppins", sans-serif')
      const family = firstTask.style.fontFamily.split(',')[0].trim().replace(/['"]/g, '')
      console.log(`[Worker] Render request - Loading font: ${family} weight ${weight}`)
      const fontLoaded = await loadFontInWorker(family, weight)
      console.log(`[Worker] Font load result: ${fontLoaded}, starting render of ${message.tasks.length} frames`)
    }
    const results: RenderResult[] = []
    const tasks = message.tasks

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i]
      try {
        const data = await renderFrame(task)
        results.push({
          id: task.id,
          success: data !== null,
          data: data ?? undefined,
          startTime: task.startTime,
          endTime: task.endTime
        })
      } catch (error) {
        results.push({
          id: task.id,
          success: false,
          startTime: task.startTime,
          endTime: task.endTime,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }

      // Report progress every 10 frames
      if ((i + 1) % 10 === 0 || i === tasks.length - 1) {
        self.postMessage({
          type: 'progress',
          completed: i + 1,
          total: tasks.length
        } as WorkerResponse)
      }
    }

    self.postMessage({ type: 'results', results } as WorkerResponse)
  }
}

/**
 * Render a single frame and return base64 PNG data
 * Renders at video resolution using the same style values as the editor preview
 */
async function renderFrame(task: RenderTask): Promise<string | null> {
  const { width, height, currentTime, subtitles, style } = task

  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  ctx.clearRect(0, 0, width, height)

  const currentSubtitle = getCurrentSubtitle(subtitles, currentTime)
  if (!currentSubtitle || currentSubtitle.words.length === 0) {
    return null
  }

  // IMPORTANT: Extract just the font family name (without fallbacks like ", sans-serif")
  // and strip quotes because the FontFace was registered with just the family name
  const fontFamily = style.fontFamily.split(',')[0].trim().replace(/['"]/g, '')

  const currentWordIndex = getCurrentWordIndex(currentSubtitle, currentTime)

  const fontSize = style.fontSize
  const fontString = `${style.fontWeight} ${fontSize}px "${fontFamily}"`
  ctx.font = fontString
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Debug: Log on first frame to verify font is correct
  if (currentTime < 1) {
    console.log(`[Worker] Setting font: ${fontString}, Canvas reports: ${ctx.font}`)
  }

  const xCenter = width * style.positionX
  const yPosition = height * style.positionY

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

  // Convert to base64
  const blob = await canvas.convertToBlob({ type: 'image/png' })
  return blobToBase64(blob)
}

/**
 * Convert Blob to base64 string
 */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result)
      } else {
        reject(new Error('Failed to convert blob to base64'))
      }
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Convert hex color + opacity to rgba string for Canvas API
 */
function getShadowColorWithOpacity(style: SubtitleStyle): string {
  const hex = style.shadowColor || '#000000'
  const opacity = (style.shadowOpacity ?? 80) / 100
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

/**
 * Convert karaoke glow color + opacity to rgba string for Canvas API
 */
function getKaraokeGlowColorWithOpacity(style: SubtitleStyle): string {
  const hex = style.karaokeGlowColor || '#FFD700'
  const opacity = (style.karaokeGlowOpacity ?? 100) / 100
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${opacity})`
}

// ============================================
// Rendering functions (copied from subtitleFrameRenderer.ts)
// ============================================

function getCurrentSubtitle(subtitles: Subtitle[], currentTime: number): Subtitle | undefined {
  return subtitles.find(
    (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
  )
}

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
 * Wrap text into multiple lines based on maxWidth and maxLines.
 * Note: Subtitles are pre-split at the store level, so truncation is no longer needed.
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

      // Since subtitles are pre-split, we should rarely exceed maxLines.
      // But if we do, continue wrapping to avoid losing text.
      if (lines.length >= maxLines) {
        const remainingWords = words.slice(words.indexOf(word))
        lines.push(remainingWords.join(' '))
        return lines
      }
    } else {
      currentLine = testLine
    }
  }

  if (currentLine) {
    lines.push(currentLine)
  }

  return lines
}

/**
 * Apply text transform (uppercase) if configured
 */
function applyTextTransform(text: string, style: SubtitleStyle): string {
  if (style.textTransform === 'uppercase') {
    return text.toUpperCase()
  }
  return text
}

function getWrappedLines(
  ctx: OffscreenCanvasRenderingContext2D,
  subtitle: Subtitle,
  displayWidth: number,
  style: SubtitleStyle
): string[] {
  const text = applyTextTransform(subtitle.words.map((w) => w.text).join(' '), style)
  const maxWidthPx = displayWidth * style.maxWidth
  return wrapText(ctx, text, maxWidthPx, style.maxLines)
}

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
 * Uses two-pass rendering: boxes first, then text (ensures boxes are always behind text)
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
  const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  const wordLineMap: { line: number; wordInLine: number }[] = []

  lines.forEach((line, lineIndex) => {
    const lineWords = line.split(' ')
    lineWords.forEach((_, wordInLineIndex) => {
      wordLineMap.push({ line: lineIndex, wordInLine: wordInLineIndex })
    })
  })

  // PASS 1: Draw all karaoke boxes first (so they're behind all text)
  if (style.karaokeBoxEnabled) {
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
        const isCurrent = globalWordIndex === currentWordIndex

        if (isCurrent) {
          ctx.save()
          const padding = style.karaokeBoxPadding
          const boxX = currentX - padding.left
          const boxY = lineY - fontSize / 2 - padding.top
          const boxWidth = wordWidth + padding.left + padding.right
          const boxHeight = fontSize + padding.top + padding.bottom
          const borderRadius = Math.min(style.karaokeBoxBorderRadius, boxHeight / 2, boxWidth / 2)

          ctx.fillStyle = style.karaokeBoxColor
          // Apply shadow to karaoke box if shadow is enabled
          if (style.shadowBlur > 0) {
            ctx.shadowColor = getShadowColorWithOpacity(style)
            ctx.shadowBlur = style.shadowBlur
            ctx.shadowOffsetX = style.shadowOffsetX ?? 0
            ctx.shadowOffsetY = style.shadowOffsetY ?? 0
          } else {
            ctx.shadowColor = 'transparent'
            ctx.shadowBlur = 0
          }

          drawRoundedRect(ctx, boxX, boxY, boxWidth, boxHeight, borderRadius)
          ctx.fill()
          ctx.restore()
        }

        currentX += wordWidth + spaceWidth
      })
    })
  }

  // PASS 2: Draw all text on top of boxes
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

      ctx.strokeStyle = style.outlineColor
      ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
      ctx.lineJoin = 'round'

      if (isCurrent && style.karaokeGlowEnabled) {
        ctx.shadowColor = getKaraokeGlowColorWithOpacity(style)
        ctx.shadowBlur = style.karaokeGlowBlur
      } else if (!isCurrent) {
        ctx.shadowColor = getShadowColorWithOpacity(style)
        ctx.shadowBlur = style.shadowBlur
      } else {
        // isCurrent but glow disabled
        ctx.shadowColor = 'transparent'
        ctx.shadowBlur = 0
      }

      if (style.outlineWidth > 0) {
        ctx.strokeText(wordText, wordX, lineY)
      }

      // Use different colors for past, current, and upcoming words
      if (isCurrent) {
        ctx.fillStyle = style.highlightColor
      } else if (isPast) {
        ctx.fillStyle = style.color
      } else {
        ctx.fillStyle = style.upcomingColor
      }
      ctx.fillText(wordText, wordX, lineY)

      ctx.shadowBlur = 0
      currentX += wordWidth + spaceWidth
    })
  })
}

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
  const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER

  const fullLines = getWrappedLines(ctx, subtitle, displayWidth, style)
  const totalHeight = fullLines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  ctx.shadowColor = getShadowColorWithOpacity(style)
  ctx.shadowBlur = style.shadowBlur
  ctx.strokeStyle = style.outlineColor
  ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
  ctx.lineJoin = 'round'

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    if (style.outlineWidth > 0) {
      ctx.strokeText(line, x, lineY)
    }
    ctx.fillStyle = style.color
    ctx.fillText(line, x, lineY)
  })

  ctx.shadowBlur = 0
}

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
  const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  const fadeInDuration = ANIMATION_CONSTANTS.FADE_DURATION
  const fadeOutDuration = ANIMATION_CONSTANTS.FADE_DURATION

  let alpha = 1
  const elapsed = currentTime - subtitle.startTime
  const remaining = subtitle.endTime - currentTime

  if (elapsed < fadeInDuration) {
    alpha = elapsed / fadeInDuration
  } else if (remaining < fadeOutDuration) {
    alpha = remaining / fadeOutDuration
  }

  ctx.globalAlpha = alpha
  ctx.shadowColor = getShadowColorWithOpacity(style)
  ctx.shadowBlur = style.shadowBlur
  ctx.strokeStyle = style.outlineColor
  ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
  ctx.lineJoin = 'round'

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    if (style.outlineWidth > 0) {
      ctx.strokeText(line, x, lineY)
    }
    ctx.fillStyle = style.color
    ctx.fillText(line, x, lineY)
  })

  ctx.globalAlpha = 1
  ctx.shadowBlur = 0
}

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
  const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
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
          const scaleProgress = Math.min(1, (currentTime - word.startTime) / ANIMATION_CONSTANTS.SCALE_DURATION)
          const scale = 1 + ANIMATION_CONSTANTS.SCALE_AMPLITUDE * Math.sin(scaleProgress * Math.PI)

          ctx.translate(wordX, lineY)
          ctx.scale(scale, scale)
          ctx.translate(-wordX, -lineY)
        }
      }

      ctx.shadowColor = getShadowColorWithOpacity(style)
      ctx.shadowBlur = style.shadowBlur
      ctx.strokeStyle = style.outlineColor
      ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
      ctx.lineJoin = 'round'
      if (style.outlineWidth > 0) {
        ctx.strokeText(wordText, wordX, lineY)
      }

      ctx.fillStyle = isCurrent ? style.highlightColor : style.color
      ctx.fillText(wordText, wordX, lineY)

      ctx.restore()
      currentX += wordWidth + spaceWidth
    })
  })
}

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
  const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
  const totalHeight = lines.length * lineHeight
  const startY = y - (totalHeight - lineHeight) / 2

  ctx.shadowColor = getShadowColorWithOpacity(style)
  ctx.shadowBlur = style.shadowBlur
  ctx.strokeStyle = style.outlineColor
  ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
  ctx.lineJoin = 'round'

  lines.forEach((line, index) => {
    const lineY = startY + index * lineHeight
    if (style.outlineWidth > 0) {
      ctx.strokeText(line, x, lineY)
    }
    ctx.fillStyle = style.color
    ctx.fillText(line, x, lineY)
  })

  ctx.shadowBlur = 0
}
