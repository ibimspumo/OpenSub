import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, Music, AlignLeft, Mic } from 'lucide-react'
import type { TranscriptionProgress as Progress } from '../../../shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Progress as ProgressBar } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TranscriptionProgressProps {
  progress: Progress | null
}

// Stage configuration with icons and colors (labels/descriptions are i18n keys)
const STAGE_CONFIG = {
  loading: {
    labelKey: 'transcription.loadingAudio',
    descriptionKey: 'transcription.loadingAudioDescription',
    icon: Music,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
    progressColor: 'bg-blue-500',
  },
  transcribing: {
    labelKey: 'transcription.transcribing',
    descriptionKey: 'transcription.transcribingDescription',
    icon: Mic,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
    progressColor: 'bg-violet-500',
  },
  aligning: {
    labelKey: 'transcription.aligning',
    descriptionKey: 'transcription.aligningDescription',
    icon: AlignLeft,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
    progressColor: 'bg-amber-500',
  },
  complete: {
    labelKey: 'transcription.complete',
    descriptionKey: 'transcription.completeDescription',
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    progressColor: 'bg-emerald-500',
  },
} as const

// Stage progress indicator (dots)
function StageIndicator({ currentStage }: { currentStage: Progress['stage'] }) {
  const stages: Progress['stage'][] = ['loading', 'transcribing', 'aligning', 'complete']
  const currentIndex = stages.indexOf(currentStage)

  return (
    <div className="flex items-center justify-center gap-2">
      {stages.slice(0, -1).map((stage, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex

        return (
          <div key={stage} className="flex items-center gap-2">
            <div
              className={cn(
                'relative h-2 w-2 rounded-full transition-all duration-300',
                isCompleted && 'bg-emerald-400 scale-100',
                isCurrent && 'bg-primary scale-125',
                !isCompleted && !isCurrent && 'bg-muted scale-100'
              )}
            >
              {isCurrent && (
                <div className="absolute inset-0 animate-ping rounded-full bg-primary opacity-50" />
              )}
            </div>

            {index < stages.length - 2 && (
              <div
                className={cn(
                  'h-0.5 w-6 rounded-full transition-all duration-500',
                  isCompleted ? 'bg-emerald-400/50' : 'bg-muted'
                )}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

// Animated waveform component for visual interest
function AudioWaveform({ isAnimating }: { isAnimating: boolean }) {
  return (
    <div className="flex items-center justify-center gap-0.5 h-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'w-0.5 rounded-full bg-muted-foreground/40 transition-all duration-150',
            isAnimating && 'animate-pulse'
          )}
          style={{
            height: isAnimating ? `${8 + Math.random() * 8}px` : '4px',
            animationDelay: `${i * 100}ms`,
            animationDuration: `${600 + i * 100}ms`,
          }}
        />
      ))}
    </div>
  )
}

export default function TranscriptionProgress({ progress }: TranscriptionProgressProps) {
  const { t } = useTranslation()
  const stage = progress?.stage || 'loading'
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.loading
  const isAnimating = stage !== 'complete'
  const percent = progress?.percent ?? 0

  const progressWidth = useMemo(() => {
    if (!progress || percent === 0) return 0
    return Math.min(100, Math.max(0, percent))
  }, [progress, percent])

  const Icon = config.icon

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          {/* Icon container */}
          <div className="mb-2 flex justify-center">
            <div
              className={cn(
                'relative flex h-16 w-16 items-center justify-center rounded-2xl',
                config.bgColor
              )}
            >
              {isAnimating ? (
                <Loader2
                  className={cn('h-8 w-8 animate-spin', config.color)}
                />
              ) : (
                <Icon className={cn('h-8 w-8', config.color)} />
              )}
            </div>
          </div>

          <DialogTitle
            className={cn(
              'text-lg',
              stage === 'complete' && 'text-emerald-400'
            )}
          >
            {t(config.labelKey)}
          </DialogTitle>

          <DialogDescription className="text-center">
            {progress?.message || t(config.descriptionKey)}
          </DialogDescription>
        </DialogHeader>

        {/* Stage indicator dots */}
        <div className="py-2">
          <StageIndicator currentStage={stage} />
        </div>

        {/* Progress section */}
        <div className="space-y-3">
          <ProgressBar
            value={progressWidth}
            className={cn('h-2', config.bgColor)}
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              {progressWidth > 0 ? t('common.progress') : t('common.initializing')}
            </span>
            <span
              className={cn(
                'font-mono font-semibold transition-colors duration-300',
                stage === 'complete' ? 'text-emerald-400' : 'text-muted-foreground'
              )}
            >
              {progressWidth > 0 ? `${Math.round(progressWidth)}%` : '\u2014'}
            </span>
          </div>
        </div>

        {/* Audio waveform visualization */}
        {isAnimating && (
          <div className="flex justify-center">
            <AudioWaveform isAnimating={isAnimating} />
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={() => window.api.whisper.cancel()}
            className="w-full"
          >
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
