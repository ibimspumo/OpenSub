import { useCallback, useRef, useEffect, useState } from 'react'
import { MessageSquareText, ArrowDown } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { usePlaybackController } from '../../hooks/usePlaybackController'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import SubtitleItem from './SubtitleItem'

export default function SubtitleList() {
  const { project } = useProjectStore()
  const { selectedSubtitleId, setSelectedSubtitleId } = useUIStore()
  const controller = usePlaybackController()
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showTopFade, setShowTopFade] = useState(false)
  const [showBottomFade, setShowBottomFade] = useState(false)
  const [isInitialRender, setIsInitialRender] = useState(true)

  const handleSelect = useCallback(
    (id: string, startTime: number) => {
      setSelectedSubtitleId(id)
      controller.seek(startTime)
    },
    [setSelectedSubtitleId, controller]
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
      <ScrollArea className="flex-1">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto overflow-x-hidden px-3 py-3"
        >
          {project.subtitles.length === 0 ? (
            // Empty State with ShadCN styling
            <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
              {/* Decorative icon with glow */}
              <div className="relative mb-5">
                <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-breathe" />
                <div
                  className={cn(
                    'relative w-16 h-16 rounded-2xl flex items-center justify-center',
                    'bg-gradient-to-br from-card to-muted',
                    'border border-border shadow-lg'
                  )}
                >
                  <MessageSquareText className="w-8 h-8 text-muted-foreground" />
                </div>
              </div>

              {/* Empty state text */}
              <h3 className="text-sm font-medium text-foreground mb-1.5">
                Keine Untertitel vorhanden
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-[220px] leading-relaxed">
                Starte eine Transkription, um automatisch Untertitel zu erstellen
              </p>

              {/* Decorative hint arrow */}
              <div className="mt-8 flex flex-col items-center gap-1.5 text-muted-foreground/60 animate-pulse-soft">
                <ArrowDown className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider font-medium">
                  Transkribieren
                </span>
              </div>
            </div>
          ) : (
            // Subtitle List with staggered animations
            <div className="space-y-2">
              {project.subtitles.map((subtitle, index) => (
                <div
                  key={subtitle.id}
                  data-subtitle-id={subtitle.id}
                  className={cn(
                    'transition-all duration-300 ease-smooth',
                    isInitialRender
                      ? 'opacity-0 translate-y-2'
                      : 'opacity-100 translate-y-0'
                  )}
                  style={{
                    transitionDelay: isInitialRender ? `${Math.min(index * 30, 300)}ms` : '0ms'
                  }}
                >
                  <SubtitleItem
                    subtitle={subtitle}
                    isSelected={selectedSubtitleId === subtitle.id}
                    onSelect={() => handleSelect(subtitle.id, subtitle.startTime)}
                  />
                </div>
              ))}

              {/* Bottom spacer for better scroll experience */}
              <div className="h-4" aria-hidden="true" />
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Top fade indicator for scroll position */}
      <div
        className={cn(
          'absolute top-0 left-0 right-2 h-8 pointer-events-none z-10',
          'bg-gradient-to-b from-background/90 via-background/50 to-transparent',
          'transition-opacity duration-200 ease-smooth',
          showTopFade ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />

      {/* Bottom fade indicator for scroll position */}
      <div
        className={cn(
          'absolute bottom-0 left-0 right-2 h-12 pointer-events-none z-10',
          'bg-gradient-to-t from-background/90 via-background/50 to-transparent',
          'transition-opacity duration-200 ease-smooth',
          showBottomFade ? 'opacity-100' : 'opacity-0'
        )}
        aria-hidden="true"
      />

      {/* Subtle side border glow when scrollable */}
      {project.subtitles.length > 5 && (
        <div
          className="absolute top-0 right-0 w-px h-full bg-gradient-to-b from-transparent via-primary/10 to-transparent pointer-events-none"
          aria-hidden="true"
        />
      )}
    </div>
  )
}
