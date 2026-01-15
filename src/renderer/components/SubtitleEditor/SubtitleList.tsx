import { useCallback, useRef, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareText, ArrowDown, FileText, Clock } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import { usePlaybackController } from '../../hooks/usePlaybackController'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import SubtitleItem from './SubtitleItem'

export default function SubtitleList() {
  const { t } = useTranslation()
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

  // Export transcript as plain text (Markdown)
  const handleExportText = useCallback(async () => {
    if (!project || project.subtitles.length === 0) return
    try {
      await window.api.file.exportTranscriptText(project.subtitles, project.name)
    } catch (error) {
      console.error('Failed to export transcript:', error)
    }
  }, [project])

  // Export transcript with timecodes (SRT format)
  const handleExportTimecodes = useCallback(async () => {
    if (!project || project.subtitles.length === 0) return
    try {
      await window.api.file.exportTranscriptTimecodes(project.subtitles, project.name)
    } catch (error) {
      console.error('Failed to export transcript:', error)
    }
  }, [project])

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
      {/* Header with export buttons - only shown when subtitles exist */}
      {project.subtitles.length > 0 && (
        <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
          <span className="text-xs text-muted-foreground font-medium">
            {t('subtitleList.subtitleCount', { count: project.subtitles.length })}
          </span>
          <TooltipProvider delayDuration={300}>
            <div className="flex items-center gap-1">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleExportText}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <FileText className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('subtitleList.exportAsText')}</p>
                </TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleExportTimecodes}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Clock className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('subtitleList.exportWithTimecodes')}</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      )}

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
                {t('subtitleList.noSubtitles')}
              </h3>
              <p className="text-xs text-muted-foreground text-center max-w-[220px] leading-relaxed">
                {t('subtitleList.noSubtitlesHint')}
              </p>

              {/* Decorative hint arrow */}
              <div className="mt-8 flex flex-col items-center gap-1.5 text-muted-foreground/60 animate-pulse-soft">
                <ArrowDown className="w-4 h-4" />
                <span className="text-[10px] uppercase tracking-wider font-medium">
                  {t('subtitleList.transcribe')}
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
