import { useEffect, useMemo, useRef, useState } from 'react'
import type { Subtitle, SubtitleStyle } from '@/lib/types'
import { renderSubtitleFrameAsBlob } from '@/utils/subtitleFrameRenderer'

/**
 * Live style preview rendered with the SAME canvas code as the video preview
 * and the export pipeline — zero duplicated styling logic.
 *
 * It fakes a tiny "video": a virtual frame VIRTUAL_W wide, the preview text as
 * one subtitle with evenly timed words, and a ticking currentTime so karaoke /
 * fade / scale animations actually play.
 */

const VIRTUAL_W = 480
const WORD_DURATION = 0.6

/** Scale all absolute-pixel style values down to the virtual frame */
function scaleStyleForPreview(style: SubtitleStyle, scale: number): SubtitleStyle {
  return {
    ...style,
    fontSize: Math.max(8, style.fontSize * scale),
    outlineWidth: style.outlineWidth * scale,
    shadowBlur: style.shadowBlur * scale,
    shadowOffsetX: (style.shadowOffsetX ?? 0) * scale,
    shadowOffsetY: (style.shadowOffsetY ?? 0) * scale,
    karaokeBoxPadding: {
      top: style.karaokeBoxPadding.top * scale,
      right: style.karaokeBoxPadding.right * scale,
      bottom: style.karaokeBoxPadding.bottom * scale,
      left: style.karaokeBoxPadding.left * scale
    },
    karaokeBoxBorderRadius: style.karaokeBoxBorderRadius * scale,
    karaokeGlowBlur: style.karaokeGlowBlur * scale,
    // Center on the preview card regardless of the style's video position
    position: 'custom',
    positionX: 0.5,
    positionY: 0.5,
    maxWidth: 0.92,
    maxLines: 2
  }
}

interface StylePreviewProps {
  style: SubtitleStyle
  text: string
  /** Display size in CSS pixels */
  width: number
  height: number
  className?: string
  /** Shared tick so all cards animate in sync (parent increments it) */
  tick: number
}

export default function StylePreview({ style, text, width, height, className, tick }: StylePreviewProps) {
  const [url, setUrl] = useState<string | null>(null)
  const urlRef = useRef<string | null>(null)

  // Fake subtitle with evenly timed words
  const subtitle = useMemo<Subtitle>(() => {
    const parts = text.split(' ').filter(Boolean)
    return {
      id: 'style-preview',
      text,
      startTime: 0,
      endTime: parts.length * WORD_DURATION,
      words: parts.map((word, i) => ({
        text: word,
        startTime: i * WORD_DURATION,
        endTime: (i + 1) * WORD_DURATION,
        confidence: 1
      }))
    }
  }, [text])

  useEffect(() => {
    let cancelled = false
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const canvasWidth = Math.round(width * dpr)
    const canvasHeight = Math.round(height * dpr)
    const scale = canvasWidth / VIRTUAL_W

    const wordCount = subtitle.words.length
    const currentTime = (tick % wordCount) * WORD_DURATION + WORD_DURATION / 2

    renderSubtitleFrameAsBlob({
      width: canvasWidth,
      height: canvasHeight,
      currentTime,
      subtitles: [subtitle],
      style: scaleStyleForPreview(style, scale)
    })
      .then((blob) => {
        if (cancelled || !blob) return
        const next = URL.createObjectURL(blob)
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = next
        setUrl(next)
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [style, subtitle, tick, width, height])

  // Revoke the last object URL on unmount
  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  return url ? (
    <img
      src={url}
      width={width}
      height={height}
      className={className}
      style={{ width, height }}
      alt=""
      draggable={false}
    />
  ) : (
    <div style={{ width, height }} className={className} />
  )
}
