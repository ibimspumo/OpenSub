/**
 * Web Worker for parallel subtitle frame rendering
 * Uses OffscreenCanvas for hardware-accelerated rendering in worker threads
 */

import type { Subtitle, SubtitleStyle, Word } from '../../shared/types'

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

type WorkerResponse =
  | { type: 'ready'; workerIndex: number }
  | { type: 'results'; results: RenderResult[] }
  | { type: 'progress'; completed: number; total: number }

let workerIndex = 0

// Listen for messages from main thread
self.onmessage = async (e: MessageEvent<WorkerMessage>) => {
  const message = e.data

  if (message.type === 'init') {
    workerIndex = message.workerIndex
    self.postMessage({ type: 'ready', workerIndex } as WorkerResponse)
    return
  }

  if (message.type === 'render') {
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

  const currentWordIndex = getCurrentWordIndex(currentSubtitle, currentTime)

  const fontSize = style.fontSize
  ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

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

      const isPast = globalWordIndex < currentWordIndex
      const isCurrent = globalWordIndex === currentWordIndex

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
