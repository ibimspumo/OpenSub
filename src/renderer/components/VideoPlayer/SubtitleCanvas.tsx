import { useRef, useEffect, useCallback, RefObject, useState } from 'react'
import type { Subtitle, SubtitleStyle } from '../../../shared/types'
import { SNAP_POINTS, SNAP_THRESHOLD } from '../../../shared/types'
import { useProjectStore } from '../../store/projectStore'

interface SubtitleCanvasProps {
  currentTime: number
  subtitles: Subtitle[]
  style: SubtitleStyle
  videoWidth: number
  videoHeight: number
  videoRef: RefObject<HTMLVideoElement>
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
  const [canvasStyle, setCanvasStyle] = useState<React.CSSProperties>({})
  const [canvasDimensions, setCanvasDimensions] = useState({ width: 0, height: 0 })

  // Drag state
  const [isDragging, setIsDragging] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const dragStartRef = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null)

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

  // Get subtitle bounds for hit testing
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

    const text = currentSubtitle.words.map((w) => w.text).join(' ')
    const textWidth = ctx.measureText(text).width
    const textHeight = fontSize * 1.5

    const xCenter = displayWidth * style.positionX
    const yCenter = displayHeight * style.positionY

    return {
      x: xCenter - textWidth / 2 - 20,
      y: yCenter - textHeight / 2 - 10,
      width: textWidth + 40,
      height: textHeight + 20
    }
  }, [getCurrentSubtitle, canvasDimensions, videoWidth, videoHeight, style])

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

    // Handle drag
    if (isDragging && dragStartRef.current) {
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      // Convert pixel delta to position percentage
      const newPosX = Math.max(0.1, Math.min(0.9,
        dragStartRef.current.posX + deltaX / canvasDimensions.width
      ))
      const newPosY = Math.max(0.1, Math.min(0.9,
        dragStartRef.current.posY + deltaY / canvasDimensions.height
      ))

      // Apply snap
      const snapped = applySnap(newPosX, newPosY)

      updateStyle({
        position: 'custom',
        positionX: snapped.x,
        positionY: snapped.y
      })
    }
  }, [isDragging, getSubtitleBounds, canvasDimensions, applySnap, updateStyle])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    dragStartRef.current = null
  }, [])

  const handleMouseLeave = useCallback(() => {
    setIsHovering(false)
    if (isDragging) {
      setIsDragging(false)
      dragStartRef.current = null
    }
  }, [isDragging])

  // Render subtitles
  const render = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || canvasDimensions.width === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const displayWidth = canvasDimensions.width
    const displayHeight = canvasDimensions.height

    ctx.clearRect(0, 0, displayWidth, displayHeight)

    // Draw snap lines when dragging
    if (isDragging) {
      ctx.save()
      ctx.setLineDash([5, 5])
      ctx.strokeStyle = 'rgba(59, 130, 246, 0.5)'
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

    const scaleX = displayWidth / videoWidth
    const scaleY = displayHeight / videoHeight
    const scale = Math.min(scaleX, scaleY)

    const fontSize = style.fontSize * scale
    ctx.font = `${style.fontWeight} ${fontSize}px ${style.fontFamily}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    // Use custom position
    const xCenter = displayWidth * style.positionX
    const yPosition = displayHeight * style.positionY

    // Draw hover/drag indicator
    if (isHovering || isDragging) {
      const text = currentSubtitle.words.map((w) => w.text).join(' ')
      const textWidth = ctx.measureText(text).width
      const padding = 15

      ctx.save()
      ctx.strokeStyle = isDragging ? 'rgba(59, 130, 246, 0.8)' : 'rgba(255, 255, 255, 0.3)'
      ctx.lineWidth = 2
      ctx.setLineDash(isDragging ? [] : [5, 5])
      ctx.strokeRect(
        xCenter - textWidth / 2 - padding,
        yPosition - fontSize / 2 - padding,
        textWidth + padding * 2,
        fontSize + padding * 2
      )
      ctx.restore()
    }

    // Render based on animation type
    switch (style.animation) {
      case 'karaoke':
        renderKaraoke(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize)
        break
      case 'appear':
        renderAppear(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize)
        break
      case 'fade':
        renderFade(ctx, currentSubtitle, xCenter, yPosition, fontSize)
        break
      case 'scale':
        renderScale(ctx, currentSubtitle, currentWordIndex, xCenter, yPosition, fontSize)
        break
      default:
        renderStatic(ctx, currentSubtitle, xCenter, yPosition, fontSize)
    }
  }, [getCurrentSubtitle, getCurrentWordIndex, style, videoWidth, videoHeight, canvasDimensions, isDragging, isHovering])

  // Karaoke animation - highlight current word
  const renderKaraoke = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number
  ) => {
    const text = subtitle.words.map((w) => w.text).join(' ')
    const totalWidth = ctx.measureText(text).width

    let currentX = x - totalWidth / 2

    subtitle.words.forEach((word, index) => {
      const wordWidth = ctx.measureText(word.text + ' ').width
      const wordX = currentX + wordWidth / 2

      const isPast = index < currentWordIndex
      const isCurrent = index === currentWordIndex

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

      ctx.strokeText(word.text, wordX, y)

      ctx.fillStyle = isCurrent ? style.highlightColor : isPast ? style.color : style.color
      ctx.globalAlpha = isPast || isCurrent ? 1 : 0.6
      ctx.fillText(word.text, wordX, y)
      ctx.globalAlpha = 1

      ctx.shadowBlur = 0
      currentX += wordWidth
    })
  }

  // Appear animation - words appear one by one
  const renderAppear = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number
  ) => {
    const visibleWords = subtitle.words.slice(0, currentWordIndex + 1)
    const text = visibleWords.map((w) => w.text).join(' ')

    if (text.length === 0) return

    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur

    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * 2
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)

    ctx.fillStyle = style.color
    ctx.fillText(text, x, y)

    ctx.shadowBlur = 0
  }

  // Fade animation
  const renderFade = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    x: number,
    y: number,
    fontSize: number
  ) => {
    const text = subtitle.words.map((w) => w.text).join(' ')

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
    ctx.strokeText(text, x, y)

    ctx.fillStyle = style.color
    ctx.fillText(text, x, y)

    ctx.globalAlpha = 1
    ctx.shadowBlur = 0
  }

  // Scale animation
  const renderScale = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    currentWordIndex: number,
    x: number,
    y: number,
    fontSize: number
  ) => {
    const text = subtitle.words.map((w) => w.text).join(' ')
    const totalWidth = ctx.measureText(text).width

    let currentX = x - totalWidth / 2

    subtitle.words.forEach((word, index) => {
      const wordWidth = ctx.measureText(word.text + ' ').width
      const wordX = currentX + wordWidth / 2

      const isCurrent = index === currentWordIndex

      ctx.save()

      if (isCurrent) {
        const scaleProgress = Math.min(1, (currentTime - word.startTime) / 0.15)
        const scale = 1 + 0.2 * Math.sin(scaleProgress * Math.PI)

        ctx.translate(wordX, y)
        ctx.scale(scale, scale)
        ctx.translate(-wordX, -y)
      }

      ctx.shadowColor = style.shadowColor
      ctx.shadowBlur = style.shadowBlur

      ctx.strokeStyle = style.outlineColor
      ctx.lineWidth = style.outlineWidth * 2
      ctx.lineJoin = 'round'
      ctx.strokeText(word.text, wordX, y)

      ctx.fillStyle = isCurrent ? style.highlightColor : style.color
      ctx.fillText(word.text, wordX, y)

      ctx.restore()
      currentX += wordWidth
    })
  }

  // Static rendering (no animation)
  const renderStatic = (
    ctx: CanvasRenderingContext2D,
    subtitle: Subtitle,
    x: number,
    y: number,
    fontSize: number
  ) => {
    const text = subtitle.words.map((w) => w.text).join(' ')

    ctx.shadowColor = style.shadowColor
    ctx.shadowBlur = style.shadowBlur

    ctx.strokeStyle = style.outlineColor
    ctx.lineWidth = style.outlineWidth * 2
    ctx.lineJoin = 'round'
    ctx.strokeText(text, x, y)

    ctx.fillStyle = style.color
    ctx.fillText(text, x, y)

    ctx.shadowBlur = 0
  }

  // Animation loop
  useEffect(() => {
    const animate = () => {
      render()
      animationRef.current = requestAnimationFrame(animate)
    }

    animate()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [render])

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
