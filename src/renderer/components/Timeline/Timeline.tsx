import { useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'

export default function Timeline() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { project } = useProjectStore()
  const { currentTime, setCurrentTime, timelineZoom, setTimelineZoom, selectedSubtitleId, setSelectedSubtitleId } = useUIStore()

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

  // Format time for markers
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Generate time markers
  const generateMarkers = () => {
    if (!project) return []

    const markers: { time: number; label: string }[] = []
    const interval = timelineZoom < 0.5 ? 10 : timelineZoom < 1 ? 5 : 2

    for (let t = 0; t <= project.duration; t += interval) {
      markers.push({ time: t, label: formatTime(t) })
    }

    return markers
  }

  // Scroll to keep playhead visible
  useEffect(() => {
    if (!containerRef.current || !project) return

    const playheadX = currentTime * pixelsPerSecond
    const containerWidth = containerRef.current.clientWidth
    const scrollLeft = containerRef.current.scrollLeft

    if (playheadX < scrollLeft + 100 || playheadX > scrollLeft + containerWidth - 100) {
      containerRef.current.scrollLeft = playheadX - containerWidth / 2
    }
  }, [currentTime, pixelsPerSecond, project])

  if (!project) return null

  const markers = generateMarkers()
  const totalWidth = project.duration * pixelsPerSecond

  return (
    <div className="h-full flex flex-col bg-dark-900">
      {/* Zoom Controls */}
      <div className="h-8 flex items-center justify-between px-4 border-b border-dark-700">
        <span className="text-xs text-dark-400">Timeline</span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTimelineZoom(Math.max(0.25, timelineZoom - 0.25))}
            className="p-1 hover:bg-dark-700 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <span className="text-xs text-dark-400 w-12 text-center">{Math.round(timelineZoom * 100)}%</span>
          <button
            onClick={() => setTimelineZoom(Math.min(4, timelineZoom + 0.25))}
            className="p-1 hover:bg-dark-700 rounded"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Timeline Content */}
      <div
        ref={containerRef}
        className="flex-1 overflow-x-auto overflow-y-hidden relative"
        onClick={handleClick}
      >
        <div style={{ width: totalWidth, minWidth: '100%' }} className="h-full relative">
          {/* Time Markers */}
          <div className="h-6 border-b border-dark-700 relative">
            {markers.map(({ time, label }) => (
              <div
                key={time}
                className="absolute top-0 h-full flex flex-col items-center"
                style={{ left: time * pixelsPerSecond }}
              >
                <span className="text-xs text-dark-500">{label}</span>
                <div className="flex-1 w-px bg-dark-700" />
              </div>
            ))}
          </div>

          {/* Subtitle Regions */}
          <div className="relative h-12 mt-2">
            {project.subtitles.map((subtitle) => {
              const speaker = project.speakers.find((s) => s.id === subtitle.speakerId)
              const isSelected = selectedSubtitleId === subtitle.id

              return (
                <div
                  key={subtitle.id}
                  className={`absolute h-10 rounded cursor-pointer transition-all ${
                    isSelected ? 'ring-2 ring-primary-500' : ''
                  }`}
                  style={{
                    left: subtitle.startTime * pixelsPerSecond,
                    width: (subtitle.endTime - subtitle.startTime) * pixelsPerSecond,
                    backgroundColor: speaker?.color || '#3B82F6',
                    opacity: isSelected ? 1 : 0.7
                  }}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedSubtitleId(subtitle.id)
                  }}
                >
                  <div className="px-2 py-1 text-xs text-white truncate">
                    {subtitle.text}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Playhead */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-red-500 z-10 pointer-events-none"
            style={{ left: currentTime * pixelsPerSecond }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-red-500 rotate-45" />
          </div>
        </div>
      </div>
    </div>
  )
}
