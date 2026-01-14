import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { project } = useProjectStore()
  const { currentTime, setCurrentTime, timelineZoom, setTimelineZoom, selectedSubtitleId, setSelectedSubtitleId, setIsScrubbing } = useUIStore()

  // Local state for hover effects
  const [hoveredSubtitleId, setHoveredSubtitleId] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  // Pixels per second
  const pixelsPerSecond = 50 * timelineZoom

  // Handle click to seek
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      if (!project || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const scrollLeft = containerRef.current.scrollLeft
      const x = e.clientX - rect.left + scrollLeft
      const time = x / pixelsPerSecond

      setCurrentTime(Math.max(0, Math.min(time, project.duration)))
    },
    [project, pixelsPerSecond, setCurrentTime]
  )

  // Handle drag to scrub through timeline
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!project || !containerRef.current) return
      setIsDragging(true)
      setIsScrubbing(true)  // Notify store that scrubbing started
      handleClick(e)
    },
    [project, handleClick, setIsScrubbing]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!isDragging || !project || !containerRef.current) return
      handleClick(e)
    },
    [isDragging, project, handleClick]
  )

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
    setIsScrubbing(false)  // Notify store that scrubbing ended
  }, [setIsScrubbing])

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

  // Scroll to keep playhead visible with smooth behavior
  useEffect(() => {
    if (!containerRef.current || !project) return

    const playheadX = currentTime * pixelsPerSecond
    const containerWidth = containerRef.current.clientWidth
    const scrollLeft = containerRef.current.scrollLeft

    if (playheadX < scrollLeft + 100 || playheadX > scrollLeft + containerWidth - 100) {
      containerRef.current.scrollTo({
        left: playheadX - containerWidth / 2,
        behavior: isDragging ? 'auto' : 'smooth'
      })
    }
  }, [currentTime, pixelsPerSecond, project, isDragging])

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
      setIsScrubbing(false)  // Ensure scrubbing is also reset
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [setIsScrubbing])

  if (!project) return null

  const totalWidth = project.duration * pixelsPerSecond

  return (
    <div className="h-full flex flex-col timeline-container rounded-t-lg overflow-hidden animate-fade-in">
      {/* Premium Header with Zoom Controls */}
      <div className="h-10 flex items-center justify-between px-4 border-b border-white/[0.06] bg-gradient-to-r from-dark-800/50 to-dark-900/50">
        {/* Timeline Label with Icon */}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded flex items-center justify-center bg-primary-500/10">
            <svg className="w-3 h-3 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span className="text-xs font-medium text-dark-300 tracking-wide uppercase">Timeline</span>
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-1 bg-dark-800/50 rounded-lg p-1 border border-white/[0.04]">
          <button
            onClick={() => setTimelineZoom(Math.max(0.25, timelineZoom - 0.25))}
            className="p-1.5 rounded-md text-dark-400 hover:text-white hover:bg-white/[0.08]
                       transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={timelineZoom <= 0.25}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>

          <div className="px-2 min-w-[3.5rem] text-center">
            <span className="text-xs font-medium text-dark-300 tabular-nums">
              {Math.round(timelineZoom * 100)}%
            </span>
          </div>

          <button
            onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.25))}
            className="p-1.5 rounded-md text-dark-400 hover:text-white hover:bg-white/[0.08]
                       transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
            disabled={timelineZoom >= 4}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative scrollbar-thin cursor-crosshair select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div style={{ width: totalWidth, minWidth: '100%' }} className="h-full relative">
          {/* Time Markers - Major */}
          <div className="h-7 border-b border-white/[0.06] relative bg-gradient-to-b from-dark-800/30 to-transparent">
            {markers.major.map(({ time, label }) => (
              <div
                key={time}
                className="absolute top-0 h-full flex flex-col items-center"
                style={{ left: time * pixelsPerSecond }}
              >
                <span className="text-[10px] font-medium text-dark-400 mt-1 tabular-nums">{label}</span>
                <div className="flex-1 w-px bg-gradient-to-b from-dark-500/60 to-dark-600/30" />
              </div>
            ))}

            {/* Minor tick marks */}
            {markers.minor.map((time) => (
              <div
                key={`minor-${time}`}
                className="absolute bottom-0 h-2 w-px bg-dark-700/50"
                style={{ left: time * pixelsPerSecond }}
              />
            ))}
          </div>

          {/* Subtitle Track Background */}
          <div className="absolute left-0 right-0 top-7 bottom-0 bg-gradient-to-b from-transparent via-dark-900/20 to-dark-900/40" />

          {/* Subtitle Regions */}
          <div className="relative h-14 mt-1 px-0">
            {project.subtitles.map((subtitle, index) => {
              const speaker = project.speakers.find((s) => s.id === subtitle.speakerId)
              const isSelected = selectedSubtitleId === subtitle.id
              const isHovered = hoveredSubtitleId === subtitle.id
              const baseColor = speaker?.color || '#3B82F6'

              return (
                <div
                  key={subtitle.id}
                  className={`subtitle-region absolute h-11 rounded-md cursor-pointer
                             transition-all duration-150 ease-out
                             ${isSelected ? 'selected z-20' : 'z-10'}
                             ${isHovered && !isSelected ? 'z-15' : ''}`}
                  style={{
                    left: subtitle.startTime * pixelsPerSecond,
                    width: Math.max((subtitle.endTime - subtitle.startTime) * pixelsPerSecond, 4),
                    background: isSelected
                      ? `linear-gradient(135deg, ${baseColor} 0%, ${baseColor}dd 100%)`
                      : `linear-gradient(135deg, ${baseColor}cc 0%, ${baseColor}99 100%)`,
                    boxShadow: isSelected
                      ? `0 0 0 2px rgba(59, 130, 246, 0.6), 0 4px 12px ${baseColor}40, 0 0 20px ${baseColor}30`
                      : isHovered
                        ? `0 4px 12px ${baseColor}30, 0 0 8px ${baseColor}20`
                        : `0 2px 4px rgba(0, 0, 0, 0.2)`,
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
                  <div className="absolute inset-0 rounded-md bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />

                  {/* Text content */}
                  <div className="relative px-2 py-1.5 text-[11px] font-medium text-white truncate leading-tight drop-shadow-sm">
                    {subtitle.text}
                  </div>

                  {/* Selection indicator line */}
                  {isSelected && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/40 rounded-b-md" />
                  )}
                </div>
              )
            })}
          </div>

          {/* Current Time Position Indicator Line (faint) */}
          <div
            className="absolute top-7 bottom-0 w-px bg-primary-500/20 pointer-events-none transition-opacity duration-200"
            style={{
              left: currentTime * pixelsPerSecond,
              opacity: isDragging ? 0.5 : 0.2
            }}
          />

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 pointer-events-none z-30 transition-transform duration-75"
            style={{ left: currentTime * pixelsPerSecond }}
          >
            {/* Main playhead line with glow */}
            <div className="absolute top-0 bottom-0 w-0.5 bg-gradient-to-b from-red-400 via-red-500 to-red-600 shadow-lg"
                 style={{ boxShadow: '0 0 8px rgba(239, 68, 68, 0.5), 0 0 16px rgba(239, 68, 68, 0.3)' }} />

            {/* Playhead handle (triangle) */}
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2">
              <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[8px]
                             border-l-transparent border-r-transparent border-t-red-500
                             drop-shadow-md"
                   style={{ filter: 'drop-shadow(0 2px 4px rgba(239, 68, 68, 0.4))' }} />
            </div>

            {/* Time tooltip on drag */}
            {isDragging && (
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1
                             bg-dark-800/95 backdrop-blur-sm rounded text-[10px] font-medium text-white
                             border border-white/10 shadow-lg whitespace-nowrap animate-fade-in-scale">
                {formatTime(currentTime)}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
