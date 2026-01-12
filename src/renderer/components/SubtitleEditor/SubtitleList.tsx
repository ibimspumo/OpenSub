import { useCallback, useRef, useEffect, useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import SubtitleItem from './SubtitleItem'

export default function SubtitleList() {
  const { project } = useProjectStore()
  const { selectedSubtitleId, setSelectedSubtitleId, setCurrentTime } = useUIStore()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const handleSelect = useCallback(
    (id: string, startTime: number) => {
      setSelectedSubtitleId(id)
      setCurrentTime(startTime)
    },
    [setSelectedSubtitleId, setCurrentTime]
  )

  // Handle scroll to show/hide fade indicators
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return

    const { scrollTop, scrollHeight, clientHeight } = container
    const threshold = 20

    setShowTopFade(scrollTop > threshold)
    setShowBottomFade(scrollTop < scrollHeight - clientHeight - threshold)
  }, [])

  // Initial check for scroll position and set up observer
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container) return

    // Initial check
    handleScroll()

    // Set up resize observer to recheck on size changes
    const resizeObserver = new ResizeObserver(handleScroll)
    resizeObserver.observe(container)

    // Trigger initial render animation
    const timer = setTimeout(() => setIsInitialRender(false), 100)

    return () => {
      resizeObserver.disconnect()
      clearTimeout(timer)
    }
  }, [handleScroll, project?.subtitles.length])

  // Auto-scroll to selected subtitle with smooth behavior
  useEffect(() => {
    if (!selectedSubtitleId || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const selectedElement = container.querySelector(`[data-subtitle-id="${selectedSubtitleId}"]`)

    if (selectedElement) {
      const containerRect = container.getBoundingClientRect()
      const elementRect = selectedElement.getBoundingClientRect()

      // Check if element is outside visible area
      const isAbove = elementRect.top < containerRect.top + 60
      const isBelow = elementRect.bottom > containerRect.bottom - 60

      if (isAbove || isBelow) {
        selectedElement.scrollIntoView({
          behavior: 'smooth',
          block: 'center'
        })
      }
    }
  }, [selectedSubtitleId])

  if (!project) return null

  return (
    <div className="relative h-full flex flex-col">
      {/* Scroll Container with refined styling */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-3 py-3"
      >
        {project.subtitles.length === 0 ? (
          // Premium Empty State
          <div className="flex flex-col items-center justify-center py-12 px-4 animate-fade-in">
            {/* Decorative icon with glow */}
            <div className="relative mb-4">
              <div className="absolute inset-0 bg-primary-500/20 blur-xl rounded-full animate-breathe" />
              <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-dark-700/80 to-dark-800/80
                            border border-white/[0.08] flex items-center justify-center
                            shadow-lg">
                <svg
                  className="w-8 h-8 text-dark-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                  />
                </svg>
              </div>
            </div>

            {/* Empty state text */}
            <h3 className="text-sm font-medium text-dark-300 mb-1">
              Keine Untertitel vorhanden
            </h3>
            <p className="text-xs text-dark-500 text-center max-w-[200px] leading-relaxed">
              Starte eine Transkription, um automatisch Untertitel zu erstellen
            </p>

            {/* Decorative hint arrow */}
            <div className="mt-6 flex flex-col items-center gap-1 text-dark-600 animate-pulse-soft">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
              <span className="text-[10px] uppercase tracking-wider">Transkribieren</span>
            </div>
          </div>
        ) : (
          // Subtitle List with staggered animations
          <div className="space-y-2">
            {project.subtitles.map((subtitle, index) => {
              const speaker = project.speakers.find((s) => s.id === subtitle.speakerId)

              return (
                <div
                  key={subtitle.id}
                  data-subtitle-id={subtitle.id}
                  className={`
                    transition-all duration-300 ease-smooth
                    ${isInitialRender ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'}
                  `}
                  style={{
                    transitionDelay: isInitialRender ? `${Math.min(index * 30, 300)}ms` : '0ms'
                  }}
                >
                  <SubtitleItem
                    subtitle={subtitle}
                    speaker={speaker}
                    isSelected={selectedSubtitleId === subtitle.id}
                    onSelect={() => handleSelect(subtitle.id, subtitle.startTime)}
                  />
                </div>
              )
            })}

            {/* Bottom spacer for better scroll experience */}
            <div className="h-4" aria-hidden="true" />
          </div>
        )}
      </div>

      {/* Top fade indicator for scroll position */}
      <div
        className={`
          absolute top-0 left-0 right-2 h-8 pointer-events-none z-10
          bg-gradient-to-b from-dark-900/90 via-dark-900/50 to-transparent
          transition-opacity duration-200 ease-smooth
          ${showTopFade ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
      />

      {/* Bottom fade indicator for scroll position */}
      <div
        className={`
          absolute bottom-0 left-0 right-2 h-12 pointer-events-none z-10
          bg-gradient-to-t from-dark-900/90 via-dark-900/50 to-transparent
          transition-opacity duration-200 ease-smooth
          ${showBottomFade ? 'opacity-100' : 'opacity-0'}
        `}
        aria-hidden="true"
      />

      {/* Subtle side border glow when scrollable */}
      {project.subtitles.length > 5 && (
        <div
          className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary-500/10 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
