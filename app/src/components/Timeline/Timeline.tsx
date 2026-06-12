import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Clock, ZoomIn, ZoomOut } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { usePlaybackController } from '@/hooks/usePlaybackController'
import { ffmpeg } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { formatTime } from '@/utils/timeFormat'

/** Peaks per second requested from the backend */
const PEAKS_PER_SECOND = 50
const MIN_SUBTITLE_DURATION = 0.2

type DragMode =
  | { kind: 'seek' }
  | { kind: 'move'; subtitleId: string; grabOffset: number }
  | { kind: 'resize-start'; subtitleId: string }
  | { kind: 'resize-end'; subtitleId: string }

export default function Timeline() {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const waveformRef = useRef<HTMLCanvasElement>(null)
  const wasPlayingRef = useRef(false)
  const peaksRef = useRef<Float32Array | null>(null)
  const dragModeRef = useRef<DragMode | null>(null)

  const { project, updateSubtitleTiming } = useProjectStore()
  const { timelineZoom, setTimelineZoom, selectedSubtitleId, setSelectedSubtitleId } = useUIStore()
  const controller = usePlaybackController()

  const [hoveredSubtitleId, setHoveredSubtitleId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  // Local timing override while dragging a subtitle (committed on release)
  const [dragTiming, setDragTiming] = useState<{ id: string; start: number; end: number } | null>(null)
  const [peaksLoaded, setPeaksLoaded] = useState(false)

  const pixelsPerSecond = 50 * timelineZoom

  // ============================================
  // Waveform: load peaks once per audio file
  // ============================================
  useEffect(() => {
    let stale = false
    peaksRef.current = null
    setPeaksLoaded(false)

    if (!project?.audioPath) return
    ffmpeg
      .waveformPeaks(project.audioPath, PEAKS_PER_SECOND)
      .then((peaks) => {
        if (stale) return
        peaksRef.current = Float32Array.from(peaks)
        setPeaksLoaded(true)
      })
      .catch(() => {})

    return () => {
      stale = true
    }
  }, [project?.audioPath])

  // Draw the visible slice of the waveform (viewport-sized canvas, redrawn on scroll/zoom)
  const drawWaveform = useCallback(() => {
    const canvas = waveformRef.current
    const container = containerRef.current
    const peaks = peaksRef.current
    if (!canvas || !container) return

    const width = container.clientWidth
    const height = canvas.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
      canvas.width = width * dpr
      canvas.height = height * dpr
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)
    if (!peaks || peaks.length === 0) return

    const scrollLeft = container.scrollLeft
    const startTime = scrollLeft / pixelsPerSecond
    const secondsVisible = width / pixelsPerSecond

    const mid = height / 2
    const amp = height * 0.46

    ctx.fillStyle = 'rgba(189, 255, 1, 0.28)'
    ctx.beginPath()

    const bucketCount = peaks.length / 2
    for (let px = 0; px < width; px++) {
      const time = startTime + (px / width) * secondsVisible
      const bucket = Math.floor(time * PEAKS_PER_SECOND)
      if (bucket < 0 || bucket >= bucketCount) continue
      const min = peaks[bucket * 2]
      const max = peaks[bucket * 2 + 1]
      const top = mid - Math.max(Math.abs(max), 0.015) * amp
      const bottom = mid + Math.max(Math.abs(min), 0.015) * amp
      ctx.rect(px, top, 1, Math.max(bottom - top, 1))
    }
    ctx.fill()
  }, [pixelsPerSecond])

  // Redraw waveform on scroll, zoom, resize and when peaks load
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let raf = 0
    const scheduleDraw = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(drawWaveform)
    }

    scheduleDraw()
    container.addEventListener('scroll', scheduleDraw, { passive: true })
    const resizeObserver = new ResizeObserver(scheduleDraw)
    resizeObserver.observe(container)

    return () => {
      cancelAnimationFrame(raf)
      container.removeEventListener('scroll', scheduleDraw)
      resizeObserver.disconnect()
    }
  }, [drawWaveform, peaksLoaded])

  // ============================================
  // Mouse interaction
  // ============================================
  const getTimeFromMouseEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!project || !containerRef.current) return null
      const rect = containerRef.current.getBoundingClientRect()
      const x = e.clientX - rect.left + containerRef.current.scrollLeft
      return Math.max(0, Math.min(x / pixelsPerSecond, project.duration))
    },
    [project, pixelsPerSecond]
  )

  const handleTrackMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!project) return
      wasPlayingRef.current = controller.isPlaying
      dragModeRef.current = { kind: 'seek' }
      setIsDragging(true)
      controller.startScrubbing()
      const time = getTimeFromMouseEvent(e)
      if (time !== null) controller.seek(time)
    },
    [project, controller, getTimeFromMouseEvent]
  )

  const handleSubtitleMouseDown = useCallback(
    (e: React.MouseEvent, subtitleId: string, mode: 'move' | 'resize-start' | 'resize-end') => {
      e.stopPropagation()
      const subtitle = project?.subtitles.find((s) => s.id === subtitleId)
      if (!subtitle) return

      setSelectedSubtitleId(subtitleId)
      const time = getTimeFromMouseEvent(e) ?? subtitle.startTime

      if (mode === 'move') {
        dragModeRef.current = {
          kind: 'move',
          subtitleId,
          grabOffset: time - subtitle.startTime
        }
      } else {
        dragModeRef.current = { kind: mode, subtitleId }
      }
      setIsDragging(true)
    },
    [project, setSelectedSubtitleId, getTimeFromMouseEvent]
  )

  // Global mouse handling during any drag
  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const mode = dragModeRef.current
      const time = getTimeFromMouseEvent(e)
      if (!mode || time === null || !project) return

      if (mode.kind === 'seek') {
        controller.seek(time)
        return
      }

      const subtitle = project.subtitles.find((s) => s.id === mode.subtitleId)
      if (!subtitle) return
      const current = dragTiming?.id === subtitle.id
        ? dragTiming
        : { id: subtitle.id, start: subtitle.startTime, end: subtitle.endTime }

      if (mode.kind === 'move') {
        const duration = subtitle.endTime - subtitle.startTime
        const newStart = Math.max(0, Math.min(time - mode.grabOffset, project.duration - duration))
        setDragTiming({ id: subtitle.id, start: newStart, end: newStart + duration })
      } else if (mode.kind === 'resize-start') {
        const newStart = Math.max(0, Math.min(time, current.end - MIN_SUBTITLE_DURATION))
        setDragTiming({ id: subtitle.id, start: newStart, end: current.end })
      } else if (mode.kind === 'resize-end') {
        const newEnd = Math.min(project.duration, Math.max(time, current.start + MIN_SUBTITLE_DURATION))
        setDragTiming({ id: subtitle.id, start: current.start, end: newEnd })
      }
    }

    const handleMouseUp = () => {
      const mode = dragModeRef.current
      if (mode?.kind === 'seek') {
        controller.endScrubbing(wasPlayingRef.current)
      } else if (mode && dragTiming) {
        // Commit the new timing once on release (single undo step)
        updateSubtitleTiming(dragTiming.id, dragTiming.start, dragTiming.end)
      }
      dragModeRef.current = null
      setDragTiming(null)
      setIsDragging(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, getTimeFromMouseEvent, controller, project, dragTiming, updateSubtitleTiming])

  // ============================================
  // Time markers
  // ============================================
  const markers = useMemo(() => {
    if (!project) return { major: [] as { time: number; label: string }[], minor: [] as number[] }

    const major: { time: number; label: string }[] = []
    const minor: number[] = []
    const majorInterval = timelineZoom < 0.5 ? 10 : timelineZoom < 1 ? 5 : 2
    const minorInterval = majorInterval / 5

    for (let time = 0; time <= project.duration; time += majorInterval) {
      major.push({ time, label: formatTime(time) })
    }
    for (let time = 0; time <= project.duration; time += minorInterval) {
      if (time % majorInterval !== 0) minor.push(time)
    }
    return { major, minor }
  }, [project, timelineZoom])

  // Keep playhead visible
  useEffect(() => {
    if (!containerRef.current || !project) return
    const playheadX = controller.currentTime * pixelsPerSecond
    const containerWidth = containerRef.current.clientWidth
    const scrollLeft = containerRef.current.scrollLeft

    if (playheadX < scrollLeft + 100 || playheadX > scrollLeft + containerWidth - 100) {
      containerRef.current.scrollTo({
        left: playheadX - containerWidth / 2,
        behavior: isDragging ? 'auto' : 'smooth'
      })
    }
  }, [controller.currentTime, pixelsPerSecond, project, isDragging])

  if (!project) return null

  const totalWidth = project.duration * pixelsPerSecond
  const speakerColor = (speakerId?: string) =>
    project.speakers.find((s) => s.id === speakerId)?.color

  return (
    <TooltipProvider delayDuration={300}>
      <div className="h-full flex flex-col overflow-hidden bg-card/60 animate-fade-in">
        {/* Header */}
        <div className="h-10 flex items-center justify-between px-3 border-b border-border/50">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-6 h-6 rounded-md bg-primary/10">
              <Clock className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Timeline
            </span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {t('app.entriesCount', { count: project.subtitles.length })}
            </Badge>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-0.5 border border-border/50">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setTimelineZoom(Math.max(0.25, timelineZoom - 0.25))}
                  disabled={timelineZoom <= 0.25}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('timeline.zoomOut')}</TooltipContent>
            </Tooltip>
            <span className="px-1.5 min-w-[3rem] text-center text-xs font-medium text-muted-foreground tabular-nums">
              {Math.round(timelineZoom * 100)}%
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.25))}
                  disabled={timelineZoom >= 4}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">{t('timeline.zoomIn')}</TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Track area */}
        <div className="flex-1 relative overflow-hidden">
          {/* Waveform layer — fixed to viewport, redrawn on scroll */}
          <canvas
            ref={waveformRef}
            className="absolute left-0 right-0 top-6 bottom-0 w-full pointer-events-none opacity-80"
            style={{ height: 'calc(100% - 1.5rem)' }}
          />

          <div
            ref={containerRef}
            className="absolute inset-0 overflow-x-auto overflow-y-hidden scrollbar-thin cursor-crosshair select-none"
            onMouseDown={handleTrackMouseDown}
          >
            <div style={{ width: totalWidth, minWidth: '100%' }} className="h-full relative">
              {/* Time ruler */}
              <div className="h-6 border-b border-border/30 relative bg-gradient-to-b from-muted/20 to-transparent">
                {markers.major.map(({ time, label }) => (
                  <div
                    key={time}
                    className="absolute top-0 h-full flex flex-col items-center"
                    style={{ left: time * pixelsPerSecond }}
                  >
                    <span className="text-[9px] font-medium text-muted-foreground mt-0.5 tabular-nums">
                      {label}
                    </span>
                    <div className="flex-1 w-px bg-border/40" />
                  </div>
                ))}
                {markers.minor.map((time) => (
                  <div
                    key={`minor-${time}`}
                    className="absolute bottom-0 h-1.5 w-px bg-border/30"
                    style={{ left: time * pixelsPerSecond }}
                  />
                ))}
              </div>

              {/* Subtitle blocks */}
              <div className="absolute left-0 right-0 top-7 bottom-1">
                {project.subtitles.map((subtitle) => {
                  const isSelected = selectedSubtitleId === subtitle.id
                  const isHovered = hoveredSubtitleId === subtitle.id
                  const timing = dragTiming?.id === subtitle.id
                    ? dragTiming
                    : { start: subtitle.startTime, end: subtitle.endTime }
                  const left = timing.start * pixelsPerSecond
                  const width = Math.max((timing.end - timing.start) * pixelsPerSecond, 6)
                  const accentColor = project.style.colorBySpeaker
                    ? speakerColor(subtitle.speakerId)
                    : undefined

                  return (
                    <div
                      key={subtitle.id}
                      className={cn(
                        'absolute top-1 bottom-1 rounded-md cursor-grab active:cursor-grabbing',
                        'transition-shadow duration-150',
                        isSelected ? 'z-20' : isHovered ? 'z-10' : 'z-0'
                      )}
                      style={{
                        left,
                        width,
                        background: accentColor
                          ? `color-mix(in oklch, ${accentColor} ${isSelected ? 85 : 55}%, transparent)`
                          : isSelected
                            ? 'color-mix(in oklch, var(--primary) 90%, transparent)'
                            : 'color-mix(in oklch, var(--primary) 55%, transparent)',
                        boxShadow: isSelected
                          ? '0 0 0 1.5px color-mix(in oklch, var(--primary) 60%, transparent), 0 4px 14px rgba(0,0,0,0.4)'
                          : isHovered
                            ? '0 2px 10px rgba(0,0,0,0.35)'
                            : '0 1px 3px rgba(0,0,0,0.3)'
                      }}
                      onMouseDown={(e) => handleSubtitleMouseDown(e, subtitle.id, 'move')}
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={() => setHoveredSubtitleId(subtitle.id)}
                      onMouseLeave={() => setHoveredSubtitleId(null)}
                    >
                      {/* Inner highlight */}
                      <div className="absolute inset-0 rounded-md bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

                      {/* Text */}
                      <div className="relative h-full px-2 flex items-center text-[10px] font-medium truncate leading-tight text-primary-foreground/90 pointer-events-none">
                        {subtitle.text}
                      </div>

                      {/* Edge drag handles for retiming */}
                      {(isSelected || isHovered) && (
                        <>
                          <div
                            className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-l-md bg-white/25 hover:bg-white/50 transition-colors"
                            onMouseDown={(e) => handleSubtitleMouseDown(e, subtitle.id, 'resize-start')}
                          />
                          <div
                            className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize rounded-r-md bg-white/25 hover:bg-white/50 transition-colors"
                            onMouseDown={(e) => handleSubtitleMouseDown(e, subtitle.id, 'resize-end')}
                          />
                        </>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Playhead */}
              <div
                className="absolute top-0 bottom-0 pointer-events-none z-30"
                style={{ left: controller.currentTime * pixelsPerSecond }}
              >
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-playhead"
                  style={{ boxShadow: '0 0 8px color-mix(in oklch, var(--playhead) 55%, transparent)' }}
                />
                <div className="absolute -top-px left-1/2 -translate-x-1/2">
                  <div
                    className="w-0 h-0 border-l-[5px] border-r-[5px] border-t-[7px] border-l-transparent border-r-transparent"
                    style={{ borderTopColor: 'var(--playhead)' }}
                  />
                </div>
                {isDragging && dragModeRef.current?.kind === 'seek' && (
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-md bg-popover/95 backdrop-blur-sm text-[10px] font-medium text-popover-foreground border border-border shadow-lg whitespace-nowrap animate-fade-in-scale">
                    {formatTime(controller.currentTime)}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
