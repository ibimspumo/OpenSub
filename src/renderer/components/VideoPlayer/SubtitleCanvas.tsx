import { useRef, useEffect, useCallback, RefObject, useState } from 'react'
import type { Subtitle, SubtitleStyle } from '../../../shared/types'
import { SNAP_POINTS, SNAP_THRESHOLD } from '../../../shared/types'
import {
  RENDERING_CONSTANTS,
  ANIMATION_CONSTANTS,
  UI_CONSTANTS
} from '../../../shared/styleConstants'
import { useProjectStore } from '../../store/projectStore'

interface SubtitleCanvasProps {
  currentTime: number
  subtitles: Subtitle[]
  style: SubtitleStyle
  videoWidth: number
  videoHeight: number
  videoRef: RefObject<HTMLVideoElement | null>
}

export default function SubtitleCanvas({
  currentTime,
  subtitles,
  style,
  videoWidth,
  videoHeight,
  videoRef
}: SubtitleCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number>()
  const offscreenCanvasRef = useRef<OffscreenCanvas | null>(null)
  const renderRef = useRef<() => void>()
  const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({})
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)
  // Local position during drag (to avoid triggering auto-save on every mouse move)
  const [localDragPosition, setLocalDragPosition] = useState<{ x: number; y: number } | null>(null)

  const { updateStyle } = useProjectStore()

  // Find current subtitle
  const getCurrentSubtitle = useCallback(() => {
    return subtitles.find(
      (sub) => currentTime >= sub.startTime && currentTime <= sub.endTime
    )
  }, [subtitles, currentTime])

  // Get current word index for karaoke animation
  const getCurrentWordIndex = useCallback(
    (subtitle: Subtitle) => {
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
    },
    [currentTime]
  )

  // Apply magnetic snap
  const applySnap = useCallback((x: number, y: number) => {
    let snappedX = x
    let snappedY = y

    // Check horizontal snap points
    for (const snapX of SNAP_POINTS.horizontal) {
      if (Math.abs(x - snapX) < SNAP_THRESHOLD) {
        snappedX = snapX
        break
      }
    }

    // Check vertical snap points
    for (const snapY of SNAP_POINTS.vertical) {
      if (Math.abs(y - snapY) < SNAP_THRESHOLD) {
        snappedY = snapY
        break
      }
    }

    return { x: snappedX, y: snappedY }
  }, [])

  // Wrap text into multiple lines based on maxWidth and maxLines
  // Note: Subtitles are pre-split at the store level, so truncation is no longer needed.
  // This function now simply wraps text without losing any content.
  const wrapText = useCallback((
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidthPx: number,
    maxLines: number
  ): string[] => {
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
          // Add remaining words to the last line (may overflow visually but won't be lost)
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
  }, [])

  // Apply text transform if configured
  const applyTextTransform = useCallback((text: string): string => {
    if (style.textTransform === 'uppercase') {
      return text.toUpperCase()
    }
    return text
  }, [style.textTransform])

  // Get wrapped lines for current subtitle
  const getWrappedLines = useCallback((
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    displayWidth: number
  ): string[] => {
    const text = applyTextTransform(subtitle.words.map((w) => w.text).join(' '))
    const maxWidthPx = displayWidth * style.maxWidth
    return wrapText(ctx, text, maxWidthPx, style.maxLines)
  }, [style.maxWidth, style.maxLines, wrapText, applyTextTransform])

  // Get subtitle bounds for hit testing (supports multi-line text boxes)
  const getSubtitleBounds = useCallback(() => {
    const currentSubtitle = getCurrentSubtitle()
    if (!currentSubtitle || currentSubtitle.words.length === 0) return null

    const canvas = canvasRef.current
    if (!canvas || canvasDimensions.width === 0) return null

    const ctx = canvas.getContext('2d')
    if (!ctx) return null

    const displayWidth = canvasDimensions.width
    const displayHeight = canvasDimensions.height

    const scaleX = displayWidth / videoWidth
    const scaleY = displayHeight / videoHeight
    const scale = Math.min(scaleX, scaleY)
    const fontSize = style.fontSize * scale

    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`

    // Get wrapped lines for multi-line support
    const lines = getWrappedLines(ctx, currentSubtitle, displayWidth)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
    const totalHeight = lines.length * lineHeight

    // Find the maximum line width
    const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width))

    const xCenter = displayWidth * style.positionX
    const yCenter = displayHeight * style.positionY

    const padding = UI_CONSTANTS.SUBTITLE_PADDING

    return {
      x: xCenter - maxLineWidth / 2 - padding,
      y: yCenter - totalHeight / 2 - padding,
      width: maxLineWidth + padding * 2,
      height: totalHeight + padding * 2
    }
  }, [getCurrentSubtitle, canvasDimensions, videoWidth, videoHeight, style, getWrappedLines])

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const bounds = getSubtitleBounds()
    if (!bounds) return

    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check if click is within subtitle bounds
    if (
      x >= bounds.x &&
      x <= bounds.x + bounds.width &&
      y >= bounds.y &&
      y <= bounds.y + bounds.height
    ) {
      setIsDragging(true)
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: style.positionX,
        posY: style.positionY
      }
      e.preventDefault()
    }
  }, [getSubtitleBounds, style.positionX, style.positionY])

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const bounds = getSubtitleBounds()
    const canvas = canvasRef.current
    if (!canvas) return

    const rect = canvas.getBoundingClientRect()
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top

    // Check hover state
    if (bounds) {
      const isOver =
        x >= bounds.x &&
        x <= bounds.x + bounds.width &&
        y >= bounds.y &&
        y <= bounds.y + bounds.height
      setIsHovering(isOver)
    }

    // Handle drag - only update local state during drag, not the store
    if (isDragging && dragStartRef.current) {
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      // Convert pixel delta to position percentage
      const newPosX = Math.max(RENDERING_CONSTANTS.POSITION_BOUNDARIES.MIN, Math.min(RENDERING_CONSTANTS.POSITION_BOUNDARIES.MAX,
        dragStartRef.current.posX + deltaX / canvasDimensions.width
      ))
      const newPosY = Math.max(RENDERING_CONSTANTS.POSITION_BOUNDARIES.MIN, Math.min(RENDERING_CONSTANTS.POSITION_BOUNDARIES.MAX,
        dragStartRef.current.posY + deltaY / canvasDimensions.height
      ))

      // Apply snap and store in local state (not in store yet)
      const snapped = applySnap(newPosX, newPosY)
      setLocalDragPosition({ x: snapped.x, y: snapped.y })
    }
  }, [isDragging, getSubtitleBounds, canvasDimensions, applySnap])

  const handleMouseUp = useCallback(() => {
    // Commit the position to the store only when drag ends
    if (localDragPosition) {
      updateStyle({
        position: 'custom',
        positionX: localDragPosition.x,
        positionY: localDragPosition.y
      })
      setLocalDragPosition(null)
    }
    setIsDragging(false)
    dragStartRef.current = null
  }, [localDragPosition, updateStyle])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    if (isDragging) {
      // Commit the position to the store when leaving canvas during drag
      if (localDragPosition) {
        updateStyle({
          position: 'custom',
          positionX: localDragPosition.x,
          positionY: localDragPosition.y
        })
        setLocalDragPosition(null)
      }
      setIsDragging(false)
      dragStartRef.current = null
    }
  }, [isDragging, localDragPosition, updateStyle])

  // Helper to wrap text for offscreen rendering (uses video width)
  // Note: Subtitles are pre-split at the store level, so truncation is no longer needed.
  const wrapTextOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    text: string,
    maxWidthPx: number,
    maxLines: number
  ): string[] => {
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
  }, [])

  const getWrappedLinesOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    subtitle: Subtitle,
    width: number
  ): string[] => {
    const text = applyTextTransform(subtitle.words.map((w) => w.text).join(' '))
    const maxWidthPx = width * style.maxWidth
    return wrapTextOffscreen(ctx, text, maxWidthPx, style.maxLines)
  }, [style.maxWidth, style.maxLines, wrapTextOffscreen, applyTextTransform])

  // Offscreen rendering functions (render at video resolution)
  const renderKaraokeOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number,
    width: number
  ) => {
    const lines = getWrappedLinesOffscreen(ctx, subtitle, width)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
    const totalHeight = lines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    let wordIndex = 0
    const wordLineMap: { line: number; wordInLine: number }[] = []

    lines.forEach((line, lineIndex) => {
      const lineWords = line.split(' ')
      lineWords.forEach(() => {
        wordLineMap.push({ line: lineIndex, wordInLine: wordIndex++ % lineWords.length })
      })
    })

    // Reset word index for proper mapping
    wordIndex = 0
    lines.forEach((line, lineIndex) => {
      const lineWords = line.split(' ')
      lineWords.forEach((_, wordInLineIndex) => {
        if (wordIndex < wordLineMap.length) {
          wordLineMap[wordIndex] = { line: lineIndex, wordInLine: wordInLineIndex }
        }
        wordIndex++
      })
    })

    const drawRoundedRect = (
      ctx: OffscreenCanvasRenderingContext2D,
      rx: number,
      ry: number,
      rwidth: number,
      rheight: number,
      radius: number
    ) => {
      ctx.beginPath()
      ctx.moveTo(rx + radius, ry)
      ctx.lineTo(rx + rwidth - radius, ry)
      ctx.quadraticCurveTo(rx + rwidth, ry, rx + rwidth, ry + radius)
      ctx.lineTo(rx + rwidth, ry + rheight - radius)
      ctx.quadraticCurveTo(rx + rwidth, ry + rheight, rx + rwidth - radius, ry + rheight)
      ctx.lineTo(rx + radius, ry + rheight)
      ctx.quadraticCurveTo(rx, ry + rheight, rx, ry + rheight - radius)
      ctx.lineTo(rx, ry + radius)
      ctx.quadraticCurveTo(rx, ry, rx + radius, ry)
      ctx.closePath()
    }

    let globalWordIdx = 0
    lines.forEach((line, lineIndex) => {
      const lineY = startY + lineIndex * lineHeight
      const lineWords = line.split(' ')
      const lineWidth = ctx.measureText(line).width
      let currentX = x - lineWidth / 2

      lineWords.forEach((wordText, wordInLineIndex) => {
        const wordWidth = ctx.measureText(wordText).width
        const spaceWidth = wordInLineIndex < lineWords.length - 1 ? ctx.measureText(' ').width : 0
        const wordX = currentX + wordWidth / 2

        const isPast = globalWordIdx < currentWordIndex
        const isCurrent = globalWordIdx === currentWordIndex

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
        ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
        ctx.lineJoin = 'round'

        if (isCurrent) {
          ctx.shadowColor = style.highlightColor
          ctx.shadowBlur = ANIMATION_CONSTANTS.KARAOKE_HIGHLIGHT_SHADOW_BLUR
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
        } else {
          ctx.shadowColor = style.shadowColor
          ctx.shadowBlur = style.shadowBlur
          ctx.shadowOffsetX = style.shadowOffsetX ?? 0
          ctx.shadowOffsetY = style.shadowOffsetY ?? 0
        }

        ctx.strokeText(wordText, wordX, lineY)

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
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        currentX += wordWidth + spaceWidth
        globalWordIdx++
      })
    })
  }, [style, getWrappedLinesOffscreen])

  const renderAppearOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number,
    width: number
  ) => {
    const visibleWords = subtitle.words.slice(0, currentWordIndex + 1)
    if (visibleWords.length === 0) return

    const visibleSubtitle = { ...subtitle, words: visibleWords }
    const lines = getWrappedLinesOffscreen(ctx, visibleSubtitle, width)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER

    const fullLines = getWrappedLinesOffscreen(ctx, subtitle, width)
    const totalHeight = fullLines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
    ctx.lineJoin = 'round'

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      ctx.strokeText(line, x, lineY)
      ctx.fillStyle = style.color
      ctx.fillText(line, x, lineY)
    })

    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }, [style, getWrappedLinesOffscreen])

  const renderFadeOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    subtitle: Subtitle,
    x: number,
    y: number,
    fontSize: number,
    width: number
  ) => {
    const lines = getWrappedLinesOffscreen(ctx, subtitle, width)
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
    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
    ctx.lineJoin = 'round'

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      ctx.strokeText(line, x, lineY)
      ctx.fillStyle = style.color
      ctx.fillText(line, x, lineY)
    })

    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }, [style, currentTime, getWrappedLinesOffscreen])

  const renderScaleOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number,
    width: number
  ) => {
    const lines = getWrappedLinesOffscreen(ctx, subtitle, width)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
    const totalHeight = lines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    let globalWordIdx = 0
    lines.forEach((line, lineIndex) => {
      const lineY = startY + lineIndex * lineHeight
      const lineWords = line.split(' ')
      const lineWidth = ctx.measureText(line).width
      let currentX = x - lineWidth / 2

      lineWords.forEach((wordText) => {
        const wordWidth = ctx.measureText(wordText).width
        const spaceWidth = ctx.measureText(' ').width
        const wordX = currentX + wordWidth / 2

        const isCurrent = globalWordIdx === currentWordIndex

        ctx.save()

        if (isCurrent) {
          const word = subtitle.words[globalWordIdx]
          if (word) {
            const scaleProgress = Math.min(1, (currentTime - word.startTime) / ANIMATION_CONSTANTS.SCALE_DURATION)
            const scale = 1 + ANIMATION_CONSTANTS.SCALE_AMPLITUDE * Math.sin(scaleProgress * Math.PI)

            ctx.translate(wordX, lineY)
            ctx.scale(scale, scale)
            ctx.translate(-wordX, -lineY)
          }
        }

        ctx.shadowColor = style.shadowColor
        ctx.shadowBlur = style.shadowBlur
        ctx.shadowOffsetX = style.shadowOffsetX ?? 0
        ctx.shadowOffsetY = style.shadowOffsetY ?? 0
        ctx.strokeStyle = style.outlineColor
        ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
        ctx.lineJoin = 'round'
        ctx.strokeText(wordText, wordX, lineY)

        ctx.fillStyle = isCurrent ? style.highlightColor : style.color
        ctx.fillText(wordText, wordX, lineY)

        ctx.restore()
        currentX += wordWidth + spaceWidth
        globalWordIdx++
      })
    })
  }, [style, currentTime, getWrappedLinesOffscreen])

  const renderStaticOffscreen = useCallback((
    ctx: OffscreenCanvasRenderingContext2D,
    subtitle: Subtitle,
    x: number,
    y: number,
    fontSize: number,
    width: number
  ) => {
    const lines = getWrappedLinesOffscreen(ctx, subtitle, width)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
    const totalHeight = lines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
    ctx.lineJoin = 'round'

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      ctx.strokeText(line, x, lineY)
      ctx.fillStyle = style.color
      ctx.fillText(line, x, lineY)
    })

    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }, [style, getWrappedLinesOffscreen])

  // Create/update offscreen canvas only when video dimensions change
  useEffect(() => {
    if (videoWidth > 0 && videoHeight > 0) {
      offscreenCanvasRef.current = new OffscreenCanvas(videoWidth, videoHeight)
    }
  }, [videoWidth, videoHeight])

  // Render subtitles at video resolution, then scale to display
  // This ensures the preview matches the export exactly
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasDimensions.width === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayWidth = canvasDimensions.width
    const displayHeight = canvasDimensions.height

    ctx.clearRect(0, 0, displayWidth, displayHeight)

    // Draw snap lines when dragging (at display resolution)
    if (isDragging) {
      ctx.save()
      ctx.setLineDash(UI_CONSTANTS.SNAP_LINE_DASH)
      ctx.strokeStyle = UI_CONSTANTS.SNAP_LINE_COLOR
      ctx.lineWidth = 1

      // Horizontal snap lines
      for (const snapX of SNAP_POINTS.horizontal) {
        const x = displayWidth * snapX
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, displayHeight)
        ctx.stroke()
      }

      // Vertical snap lines
      for (const snapY of SNAP_POINTS.vertical) {
        const y = displayHeight * snapY
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(displayWidth, y)
        ctx.stroke()
      }

      ctx.restore()
    }

    const currentSubtitle = getCurrentSubtitle()
    if (!currentSubtitle || currentSubtitle.words.length === 0) return

    const currentWordIndex = getCurrentWordIndex(currentSubtitle)

    // Use the cached offscreen canvas for pixel-perfect rendering
    // This ensures the preview matches the export exactly
    const offscreen = offscreenCanvasRef.current
    if (!offscreen) return
    const offCtx = offscreen.getContext('2d')
    if (!offCtx) return

    // Clear the offscreen canvas
    offCtx.clearRect(0, 0, videoWidth, videoHeight)

    // Render at video resolution (same as export)
    const fontSize = style.fontSize
    offCtx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
    offCtx.textAlign = 'center'
    offCtx.textBaseline = 'middle'

    // Use local drag position during drag, otherwise use style position
    const posX = localDragPosition?.x ?? style.positionX
    const posY = localDragPosition?.y ?? style.positionY

    const xCenter = videoWidth * posX
    const yPosition = videoHeight * posY

    // Render based on animation type (at video resolution)
    switch (style.animation) {
      case 'karaoke':
        renderKaraokeOffscreen(offCtx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, videoWidth)
        break
      case 'appear':
        renderAppearOffscreen(offCtx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, videoWidth)
        break
      case 'fade':
        renderFadeOffscreen(offCtx, currentSubtitle, xCenter, yPosition, fontSize, videoWidth)
        break
      case 'scale':
        renderScaleOffscreen(offCtx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize, videoWidth)
        break
      default:
        renderStaticOffscreen(offCtx, currentSubtitle, xCenter, yPosition, fontSize, videoWidth)
    }

    // Scale and draw the offscreen canvas to the display canvas
    ctx.drawImage(offscreen, 0, 0, videoWidth, videoHeight, 0, 0, displayWidth, displayHeight)

    // Draw hover/drag indicator (at display resolution, on top)
    if (isHovering || isDragging) {
      const scaleX = displayWidth / videoWidth
      const scaleY = displayHeight / videoHeight
      const scale = Math.min(scaleX, scaleY)

      const scaledFontSize = fontSize * scale
      ctx.font = `${style.fontWeight} ${scaledFontSize}px ${style.fontFamily}`

      const lines = getWrappedLines(ctx, currentSubtitle, displayWidth)
      const lineHeight = scaledFontSize * 1.4
      const totalHeight = lines.length * lineHeight
      const maxLineWidth = Math.max(...lines.map(line => ctx.measureText(line).width))
      const padding = UI_CONSTANTS.SUBTITLE_PADDING

      ctx.save()
      ctx.strokeStyle = isDragging ? UI_CONSTANTS.DRAG_INDICATOR_COLOR : UI_CONSTANTS.HOVER_INDICATOR_COLOR
      ctx.lineWidth = 2
      ctx.setLineDash(isDragging ? [] : UI_CONSTANTS.SNAP_LINE_DASH)
      ctx.strokeRect(
        displayWidth * posX - maxLineWidth / 2 - padding,
        displayHeight * posY - totalHeight / 2 - padding,
        maxLineWidth + padding * 2,
        totalHeight + padding * 2
      )
      ctx.restore()
    }
  }, [getCurrentSubtitle, getCurrentWordIndex, style, videoWidth, videoHeight, canvasDimensions, isDragging, isHovering, getWrappedLines, localDragPosition])

  // Karaoke animation - highlight current word with multi-line support
  const renderKaraoke = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number,
    displayWidth: number
  ) => {
    const lines = getWrappedLines(ctx, subtitle, displayWidth)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
    const totalHeight = lines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    // Build word-to-line mapping
    let wordIndex = 0
    const wordLineMap: { line: number; wordInLine: number }[] = []

    lines.forEach((line, lineIndex) => {
      const lineWords = line.split(' ')
      lineWords.forEach((_, wordInLineIndex) => {
        wordLineMap.push({ line: lineIndex, wordInLine: wordInLineIndex })
        wordIndex++
      })
    })

    // Helper function to draw rounded rectangle
    const drawRoundedRect = (
      ctx: CanvasRenderingContext2D,
      x: number,
      y: number,
      width: number,
      height: number,
      radius: number
    ) => {
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

    // Render each line
    lines.forEach((line, lineIndex) => {
      const lineY = startY + lineIndex * lineHeight
      const lineWords = line.split(' ')
      const lineWidth = ctx.measureText(line).width
      let currentX = x - lineWidth / 2

      lineWords.forEach((wordText, wordInLineIndex) => {
        // Find the global word index for this word
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
        ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
        ctx.lineJoin = 'round'

        if (isCurrent) {
          ctx.shadowColor = style.highlightColor
          ctx.shadowBlur = ANIMATION_CONSTANTS.KARAOKE_HIGHLIGHT_SHADOW_BLUR
          ctx.shadowOffsetX = 0
          ctx.shadowOffsetY = 0
        } else {
          ctx.shadowColor = style.shadowColor
          ctx.shadowBlur = style.shadowBlur
          ctx.shadowOffsetX = style.shadowOffsetX ?? 0
          ctx.shadowOffsetY = style.shadowOffsetY ?? 0
        }

        ctx.strokeText(wordText, wordX, lineY)

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
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        currentX += wordWidth + spaceWidth
      })
    })
  }

  // Appear animation - words appear one by one with multi-line support
  const renderAppear = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number,
    displayWidth: number
  ) => {
    const visibleWords = subtitle.words.slice(0, currentWordIndex + 1)
    if (visibleWords.length === 0) return

    // Create a temporary subtitle with only visible words
    const visibleSubtitle = {
      ...subtitle,
      words: visibleWords
    }

    const lines = getWrappedLines(ctx, visibleSubtitle, displayWidth)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER

    // Get full lines for consistent vertical positioning
    const fullLines = getWrappedLines(ctx, subtitle, displayWidth)
    const totalHeight = fullLines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
    ctx.lineJoin = 'round'

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      ctx.strokeText(line, x, lineY)
      ctx.fillStyle = style.color
      ctx.fillText(line, x, lineY)
    })

    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  // Fade animation with multi-line support
  const renderFade = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    x: number,
    y: number,
    fontSize: number,
    displayWidth: number
  ) => {
    const lines = getWrappedLines(ctx, subtitle, displayWidth)
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
    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
    ctx.lineJoin = 'round'

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      ctx.strokeText(line, x, lineY)
      ctx.fillStyle = style.color
      ctx.fillText(line, x, lineY)
    })

    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  // Scale animation with multi-line support
  const renderScale = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number,
    displayWidth: number
  ) => {
    const lines = getWrappedLines(ctx, subtitle, displayWidth)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER
    const totalHeight = lines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    // Build word-to-line mapping
    let wordIndex = 0
    const wordLineMap: { line: number; wordInLine: number }[] = []

    lines.forEach((line, lineIndex) => {
      const lineWords = line.split(' ')
      lineWords.forEach((_, wordInLineIndex) => {
        wordLineMap.push({ line: lineIndex, wordInLine: wordInLineIndex })
        wordIndex++
      })
    })

    // Render each line
    lines.forEach((line, lineIndex) => {
      const lineY = startY + lineIndex * lineHeight
      const lineWords = line.split(' ')
      const lineWidth = ctx.measureText(line).width
      let currentX = x - lineWidth / 2

      lineWords.forEach((wordText, wordInLineIndex) => {
        // Find the global word index for this word
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

        ctx.shadowColor = style.shadowColor
        ctx.shadowBlur = style.shadowBlur
        ctx.shadowOffsetX = style.shadowOffsetX ?? 0
        ctx.shadowOffsetY = style.shadowOffsetY ?? 0
        ctx.strokeStyle = style.outlineColor
        ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
        ctx.lineJoin = 'round'
        ctx.strokeText(wordText, wordX, lineY)

        ctx.fillStyle = isCurrent ? style.highlightColor : style.color
        ctx.fillText(wordText, wordX, lineY)

        ctx.restore()
        currentX += wordWidth + spaceWidth
      })
    })
  }

  // Static rendering (no animation) with text wrapping support
  const renderStatic = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    x: number,
    y: number,
    fontSize: number,
    displayWidth: number
  ) => {
    const lines = getWrappedLines(ctx, subtitle, displayWidth)
    const lineHeight = fontSize * RENDERING_CONSTANTS.LINE_HEIGHT_MULTIPLIER

    // Calculate starting Y position to center all lines around the target Y
    const totalHeight = lines.length * lineHeight
    const startY = y - (totalHeight - lineHeight) / 2

    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur
    ctx.shadowOffsetX = style.shadowOffsetX ?? 0
    ctx.shadowOffsetY = style.shadowOffsetY ?? 0
    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * RENDERING_CONSTANTS.OUTLINE_WIDTH_MULTIPLIER
    ctx.lineJoin = 'round'

    lines.forEach((line, index) => {
      const lineY = startY + index * lineHeight
      ctx.strokeText(line, x, lineY)
      ctx.fillStyle = style.color
      ctx.fillText(line, x, lineY)
    })

    ctx.shadowBlur = 0
    ctx.shadowOffsetX = 0
    ctx.shadowOffsetY = 0
  }

  // Keep renderRef in sync with the latest render function
  // This avoids restarting the animation loop when style changes
  useEffect(() => {
    renderRef.current = render
  }, [render])

  // Animation loop - stable, never restarts due to style changes
  useEffect(() => {
    const animate = () => {
      renderRef.current?.()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, []) // Empty deps - loop starts once and runs forever

  // Position canvas over video element
  const updateCanvasPosition = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    const videoRect = video.getBoundingClientRect()
    const parentRect = video.parentElement?.getBoundingClientRect()

    if (!parentRect) return

    const offsetLeft = videoRect.left - parentRect.left
    const offsetTop = videoRect.top - parentRect.top

    setCanvasStyle({
      position: 'absolute',
      left: `${offsetLeft}px`,
      top: `${offsetTop}px`,
      width: `${videoRect.width}px`,
      height: `${videoRect.height}px`,
      cursor: isHovering ? 'grab' : 'default'
    })

    setCanvasDimensions({ width: videoRect.width, height: videoRect.height })

    const dpr = window.devicePixelRatio || 1
    canvas.width = videoRect.width * dpr
    canvas.height = videoRect.height * dpr

    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
  }, [videoRef, isHovering])

  // Handle canvas resize - observe video element
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    updateCanvasPosition()

    video.addEventListener('loadedmetadata', updateCanvasPosition)

    const resizeObserver = new ResizeObserver(() => {
      updateCanvasPosition()
    })

    resizeObserver.observe(video)

    window.addEventListener('resize', updateCanvasPosition)

    return () => {
      video.removeEventListener('loadedmetadata', updateCanvasPosition)
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateCanvasPosition)
    }
  }, [videoRef, updateCanvasPosition])

  return (
    <canvas
      ref={canvasRef}
      style={{
        ...canvasStyle,
        cursor: isDragging ? 'grabbing' : isHovering ? 'grab' : 'default'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
    />
  )
}
