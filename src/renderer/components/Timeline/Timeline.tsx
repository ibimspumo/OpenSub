import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { usePlaybackController } from '../../hooks/usePlaybackController'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Clock, ZoomIn, ZoomOut, GripHorizontal } from 'lucide-react'

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const wasPlayingRef = useRef(false)

  const { project } = useProjectStore()
  const { timelineZoom, setTimelineZoom, selectedSubtitleId, setSelectedSubtitleId } = useUIStore()
  const controller = usePlaybackController()

  // Local state for hover effects and dragging
  const [hoveredSubtitleId, setHoveredSubtitleId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Pixels per second
  const pixelsPerSecond = 50 * timelineZoom

  // Calculate time from mouse position
  const getTimeFromMouseEvent = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!project || !containerRef.current) return null

      const rect = containerRef.current.getBoundingClientRect()
      const scrollLeft = containerRef.current.scrollLeft
      const x = e.clientX - rect.left + scrollLeft
      const time = x / pixelsPerSecond

      return Math.max(0, Math.min(time, project.duration))
    },
    [project, pixelsPerSecond]
  )

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      const time = getTimeFromMouseEvent(e)
      if (time !== null) {
        controller.seek(time)
      }
    },
    [getTimeFromMouseEvent, controller]
  )

  // Handle drag start
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!project || !containerRef.current) return

      // Store whether video was playing before scrub
      wasPlayingRef.current = controller.isPlaying

      setIsDragging(true)
      controller.startScrubbing()

      // Initial seek
      const time = getTimeFromMouseEvent(e)
      if (time !== null) {
        controller.seek(time)
      }
    },
    [project, controller, getTimeFromMouseEvent]
  )

  // Handle drag move
  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging) return

      const time = getTimeFromMouseEvent(e)
      if (time !== null) {
        controller.seek(time)
      }
    },
    [isDragging, getTimeFromMouseEvent, controller]
  )

  // Handle drag end
  const handleMouseUp = useCallback(() => {
    if (isDragging) {
      setIsDragging(false)
      controller.endScrubbing(wasPlayingRef.current)
    }
  }, [isDragging, controller])

  // Global mouse up handler for when mouse leaves timeline during drag
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (isDragging) {
        setIsDragging(false)
        controller.endScrubbing(wasPlayingRef.current)
      }
    }

    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDragging) return

      const time = getTimeFromMouseEvent(e)
      if (time !== null) {
        controller.seek(time)
      }
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    window.addEventListener('mousemove', handleGlobalMouseMove)

    return () => {
      window.removeEventListener('mouseup', handleGlobalMouseUp)
      window.removeEventListener('mousemove', handleGlobalMouseMove)
    }
  }, [isDragging, controller, getTimeFromMouseEvent])

  // Format time for markers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Generate time markers with minor tick marks
  const markers = useMemo(() => {
    if (!project) return { major: [], minor: [] }

    const major: { time: number; label: string }[] = []
    const minor: number[] = []
    const majorInterval = timelineZoom < 0.5 ? 10 : timelineZoom < 1 ? 5 : 2
    const minorInterval = majorInterval / 5

    for (let t = 0; t <= project.duration; t += majorInterval) {
      major.push({ time: t, label: formatTime(t) })
    }

    for (let t = 0; t <= project.duration; t += minorInterval) {
      if (t % majorInterval !== 0) {
        minor.push(t)
      }
    }

    return { major, minor }
  }, [project, timelineZoom])

  // Scroll to keep playhead visible
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

  return (
    <TooltipProvider delayDuration={300}>
      <div className={cn(
        'h-full flex flex-col rounded-t-lg overflow-hidden',
        'bg-card border border-border/50',
        'animate-fade-in'
      )}>
        {/* Header with Zoom Controls */}
        <div className={cn(
          'h-11 flex items-center justify-between px-3',
          'border-b border-border/50',
          'bg-gradient-to-r from-muted/30 to-muted/10'
        )}>
          <div className="flex items-center gap-2">
            <div className={cn(
              'flex items-center justify-center',
              'w-6 h-6 rounded-md',
              'bg-primary/10'
            )}>
              <Clock className="w-3.5 h-3.5 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
              Timeline
            </span>
            <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">
              {project.subtitles.length} Untertitel
            </Badge>
          </div>

          {/* Zoom Controls */}
          <div className={cn(
            'flex items-center gap-1',
            'bg-muted/50 rounded-lg p-0.5',
            'border border-border/50'
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setTimelineZoom(Math.max(0.25, timelineZoom - 0.25))}
                  disabled={timelineZoom <= 0.25}
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Verkleinern</p>
              </TooltipContent>
            </Tooltip>

            <div className="px-2 min-w-[3.5rem] text-center">
              <span className="text-xs font-medium text-muted-foreground tabular-nums">
                {Math.round(timelineZoom * 100)}%
              </span>
            </div>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.25))}
                  disabled={timelineZoom >= 4}
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>Vergrossern</p>
              </TooltipContent>
            </Tooltip>
          </div>
        </div>

        {/* Timeline Content */}
        <div
          ref={containerRef}
          className={cn(
            'flex-1 overflow-x-auto overflow-y-hidden relative',
            'scrollbar-thin cursor-crosshair select-none',
            'bg-background/50'
          )}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <div style={{ width: totalWidth, minWidth: '100%' }} className="h-full relative">
            {/* Time Markers - Major */}
            <div className={cn(
              'h-7 border-b border-border/30 relative',
              'bg-gradient-to-b from-muted/20 to-transparent'
            )}>
              {markers.major.map(({ time, label }) => (
                <div
                  key={time}
                  className="absolute top-0 h-full flex flex-col items-center"
                  style={{ left: time * pixelsPerSecond }}
                >
                  <span className="text-[10px] font-medium text-muted-foreground mt-1 tabular-nums">
                    {label}
                  </span>
                  <div className="flex-1 w-px bg-gradient-to-b from-border/60 to-border/20" />
                </div>
              ))}

              {/* Minor tick marks */}
              {markers.minor.map((time) => (
                <div
                  key={`minor-${time}`}
                  className="absolute bottom-0 h-2 w-px bg-border/30"
                  style={{ left: time * pixelsPerSecond }}
                />
              ))}
            </div>

            {/* Subtitle Track Background */}
            <div className="absolute left-0 right-0 top-7 bottom-0 bg-gradient-to-b from-transparent via-muted/5 to-muted/10" />

            {/* Subtitle Regions */}
            <div className="relative h-14 mt-1 px-0">
              {project.subtitles.map((subtitle, index) => {
                const isSelected = selectedSubtitleId === subtitle.id
                const isHovered = hoveredSubtitleId === subtitle.id

                return (
                  <div
                    key={subtitle.id}
                    className={cn(
                      'absolute h-11 rounded-md cursor-pointer',
                      'transition-all duration-150 ease-out',
                      'border border-transparent',
                      isSelected && 'z-20 border-primary/50',
                      !isSelected && isHovered && 'z-15',
                      !isSelected && !isHovered && 'z-10'
                    )}
                    style={{
                      left: subtitle.startTime * pixelsPerSecond,
                      width: Math.max((subtitle.endTime - subtitle.startTime) * pixelsPerSecond, 4),
                      background: isSelected
                        ? 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)'
                        : 'linear-gradient(135deg, hsl(var(--primary) / 0.7) 0%, hsl(var(--primary) / 0.5) 100%)',
                      boxShadow: isSelected
                        ? '0 0 0 2px hsl(var(--primary) / 0.3), 0 4px 12px hsl(var(--primary) / 0.25), 0 0 20px hsl(var(--primary) / 0.15)'
                        : isHovered
                          ? '0 4px 12px hsl(var(--primary) / 0.2), 0 0 8px hsl(var(--primary) / 0.1)'
                          : '0 2px 4px rgba(0, 0, 0, 0.2)',
                      transform: isSelected
                        ? 'translateY(-1px) scaleY(1.05)'
                        : isHovered
                          ? 'translateY(-1px)'
                          : 'translateY(0)',
                      animationDelay: `${index * 20}ms`
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedSubtitleId(subtitle.id)
                    }}
                    onMouseEnter={() => setHoveredSubtitleId(subtitle.id)}
                    onMouseLeave={() => setHoveredSubtitleId(null)}
                  >
                    {/* Gradient overlay for depth */}
                    <div className="absolute inset-0 rounded-md bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />

                    {/* Drag handle indicator */}
                    {(isSelected || isHovered) && (
                      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-50">
                        <GripHorizontal className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}

                    {/* Text content */}
                    <div className={cn(
                      'relative px-2 py-1.5 text-[11px] font-medium truncate leading-tight',
                      'text-primary-foreground drop-shadow-sm',
                      (isSelected || isHovered) && 'pl-5'
                    )}>
                      {subtitle.text}
                    </div>

                    {/* Selection indicator line */}
                    {isSelected && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-foreground/40 rounded-b-md" />
                    )}
                  </div>
                )
              })}
            </div>

            {/* Current Time Position Indicator Line (faint) */}
            <div
              className={cn(
                'absolute top-7 bottom-0 w-px pointer-events-none transition-opacity duration-200',
                'bg-primary/20'
              )}
              style={{
                left: controller.currentTime * pixelsPerSecond,
                opacity: isDragging ? 0.5 : 0.2
              }}
            />

            {/* Playhead */}
            <div
              className="absolute top-0 bottom-0 pointer-events-none z-30 transition-transform duration-75"
              style={{ left: controller.currentTime * pixelsPerSecond }}
            >
              {/* Main playhead line with glow */}
              <div
                className={cn(
                  'absolute top-0 bottom-0 w-0.5',
                  'bg-gradient-to-b from-destructive via-destructive to-destructive/80'
                )}
                style={{ boxShadow: '0 0 8px hsl(var(--destructive) / 0.5), 0 0 16px hsl(var(--destructive) / 0.3)' }}
              />

              {/* Playhead handle (triangle) */}
              <div className="absolute -top-0.5 left-1/2 -translate-x-1/2">
                <div
                  className={cn(
                    'w-0 h-0',
                    'border-l-[6px] border-r-[6px] border-t-[8px]',
                    'border-l-transparent border-r-transparent border-t-destructive'
                  )}
                  style={{ filter: 'drop-shadow(0 2px 4px hsl(var(--destructive) / 0.4))' }}
                />
              </div>

              {/* Time tooltip on drag */}
              {isDragging && (
                <div className={cn(
                  'absolute -top-8 left-1/2 -translate-x-1/2',
                  'px-2 py-1 rounded-md',
                  'bg-popover/95 backdrop-blur-sm',
                  'text-[10px] font-medium text-popover-foreground',
                  'border border-border shadow-lg',
                  'whitespace-nowrap animate-fade-in-scale'
                )}>
                  {formatTime(controller.currentTime)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
