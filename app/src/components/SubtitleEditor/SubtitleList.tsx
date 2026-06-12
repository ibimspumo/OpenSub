import { useCallback, useRef, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { MessageSquareText, Sparkles, Download, FileText, Clock } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { usePlaybackController } from '@/hooks/usePlaybackController'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import SubtitleItem from './SubtitleItem'
import { transcript, analysis } from '@/lib/api'

export default function SubtitleList() {
  const { t } = useTranslation()
  const { project } = useProjectStore()
  const {
    selectedSubtitleId,
    setSelectedSubtitleId,
    isAnalyzing,
    setIsAnalyzing,
    setAnalysisProgress,
    setPendingChanges,
    setShowDiffPreview
  } = useUIStore()
  const controller = usePlaybackController()
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  const subtitles = project?.subtitles ?? []

  // The line currently being spoken — follows playback
  const activeSubtitleId = useMemo(() => {
    const time = controller.currentTime
    return subtitles.find((s) => time >= s.startTime && time < s.endTime)?.id ?? null
  }, [subtitles, controller.currentTime])

  const handleSelect = useCallback(
    (id: string, startTime: number) => {
      setSelectedSubtitleId(id)
      controller.seek(startTime)
    },
    [setSelectedSubtitleId, controller]
  )

  const handleExportText = useCallback(async () => {
    if (!project || project.subtitles.length === 0) return
    try {
      await transcript.exportText(project.subtitles, project.name)
    } catch (error) {
      console.error('Failed to export transcript:', error)
    }
  }, [project])

  const handleExportTimecodes = useCallback(async () => {
    if (!project || project.subtitles.length === 0) return
    try {
      await transcript.exportTimecodes(project.subtitles, project.name)
    } catch (error) {
      console.error('Failed to export transcript:', error)
    }
  }, [project])

  // AI correction (lives with the text it corrects)
  const handleStartAnalysis = useCallback(async () => {
    if (!project || project.subtitles.length === 0 || isAnalyzing) return

    setIsAnalyzing(true)
    setAnalysisProgress({ stage: 'extracting', percent: 0, message: t('analysis.startAnalysis') })

    try {
      const result = await analysis.analyze({
        audioPath: project.audioPath,
        subtitles: project.subtitles,
        config: {
          model: 'google/gemini-3-flash-preview',
          language: 'de'
        }
      })

      setPendingChanges(result.changes)
      setIsAnalyzing(false)
      setAnalysisProgress(null)

      if (result.changes.length > 0) {
        setShowDiffPreview(true)
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setIsAnalyzing(false)
      setAnalysisProgress({
        stage: 'error',
        percent: 0,
        message: error instanceof Error ? error.message : t('analysis.analysisFailed')
      })
    }
  }, [project, isAnalyzing, setIsAnalyzing, setAnalysisProgress, setPendingChanges, setShowDiffPreview, t])

  // Keep the active/selected line in view
  const scrollTargetId = selectedSubtitleId ?? (controller.isPlaying ? activeSubtitleId : null)
  useEffect(() => {
    if (!scrollTargetId || !scrollContainerRef.current) return

    const container = scrollContainerRef.current
    const element = container.querySelector(`[data-subtitle-id="${scrollTargetId}"]`)
    if (!element) return

    const containerRect = container.getBoundingClientRect()
    const elementRect = element.getBoundingClientRect()
    const isAbove = elementRect.top < containerRect.top + 48
    const isBelow = elementRect.bottom > containerRect.bottom - 48

    if (isAbove || isBelow) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [scrollTargetId])

  if (!project) return null

  return (
    <div className="relative h-full flex flex-col">
      {/* Single panel header: title + count + actions */}
      <div className="h-10 flex items-center gap-2 px-3 shrink-0">
        <h2 className="text-xs font-semibold text-foreground/80">
          {t('app.transcript')}
        </h2>
        {subtitles.length > 0 && (
          <span className="text-[10px] text-muted-foreground/70 tabular-nums px-1.5 py-px rounded-full bg-white/[0.05]">
            {subtitles.length}
          </span>
        )}

        <div className="ml-auto flex items-center gap-0.5">
          {subtitles.length > 0 && (
            <>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleStartAnalysis}
                    disabled={isAnalyzing}
                    className={cn(
                      'pressable w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                      isAnalyzing
                        ? 'text-primary animate-pulse-soft'
                        : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
                    )}
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">{t('styleEditor.aiCorrection')}</TooltipContent>
              </Tooltip>

              <DropdownMenu>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger asChild>
                      <button className="pressable w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors">
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">{t('subtitleList.exportTranscript')}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="end" sideOffset={6}>
                  <DropdownMenuItem onClick={handleExportText}>
                    <FileText className="w-3.5 h-3.5" />
                    {t('subtitleList.exportAsText')}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={handleExportTimecodes}>
                    <Clock className="w-3.5 h-3.5" />
                    {t('subtitleList.exportWithTimecodes')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
        </div>
      </div>

      {/* List */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin px-1.5 pb-3"
      >
        {subtitles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-4">
              <MessageSquareText className="w-5 h-5 text-muted-foreground" />
            </div>
            <h3 className="text-[13px] font-medium text-foreground mb-1">
              {t('subtitleList.noSubtitles')}
            </h3>
            <p className="text-xs text-muted-foreground text-center max-w-[200px] leading-relaxed">
              {t('subtitleList.noSubtitlesHint')}
            </p>
          </div>
        ) : (
          <div className="space-y-px">
            {subtitles.map((subtitle) => (
              <SubtitleItem
                key={subtitle.id}
                subtitle={subtitle}
                isSelected={selectedSubtitleId === subtitle.id}
                isActive={activeSubtitleId === subtitle.id}
                onSelect={() => handleSelect(subtitle.id, subtitle.startTime)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
