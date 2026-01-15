import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, CheckCircle, Film, X } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

// Export progress configuration (labels/descriptions are i18n keys)
const EXPORT_CONFIG = {
  labelKey: 'export.exporting',
  descriptionKey: 'export.exportingDescription',
  color: 'text-blue-400',
  bgColor: 'bg-blue-500/10',
}

const COMPLETE_CONFIG = {
  labelKey: 'export.exportComplete',
  descriptionKey: 'export.exportCompleteDescription',
  color: 'text-emerald-400',
  bgColor: 'bg-emerald-500/10',
}

// Animated film frames for visual interest
function FilmFrames({ isAnimating }: { isAnimating: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'h-3 w-2 rounded-sm bg-muted-foreground/30 transition-all duration-200',
            isAnimating && 'animate-pulse'
          )}
          style={{
            animationDelay: `${i * 150}ms`,
            opacity: isAnimating ? 0.4 + Math.random() * 0.4 : 0.3,
          }}
        />
      ))}
    </div>
  )
}

export default function ExportProgress() {
  const { t } = useTranslation()
  const { exportProgress } = useUIStore()

  const isComplete = exportProgress >= 100
  const isAnimating = !isComplete
  const config = isComplete ? COMPLETE_CONFIG : EXPORT_CONFIG

  // Memoize the progress bar width to prevent unnecessary re-renders
  const progressWidth = useMemo(() => {
    return Math.min(100, Math.max(0, exportProgress))
  }, [exportProgress])

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
                <Loader2 className={cn('h-8 w-8 animate-spin', config.color)} />
              ) : (
                <CheckCircle className={cn('h-8 w-8', config.color)} />
              )}
            </div>
          </div>

          <DialogTitle
            className={cn(
              'text-lg',
              isComplete && 'text-emerald-400'
            )}
          >
            {t(config.labelKey)}
          </DialogTitle>

          <DialogDescription className="text-center">
            {t(config.descriptionKey)}
          </DialogDescription>
        </DialogHeader>

        {/* Progress section */}
        <div className="space-y-3">
          <Progress
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
                isComplete ? 'text-emerald-400' : 'text-muted-foreground'
              )}
            >
              {progressWidth > 0 ? `${Math.round(progressWidth)}%` : '\u2014'}
            </span>
          </div>
        </div>

        {/* Film frames visualization */}
        {isAnimating && (
          <div className="flex justify-center">
            <FilmFrames isAnimating={isAnimating} />
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={() => window.api.ffmpeg.cancel()}
            className="w-full"
          >
            <X className="h-4 w-4" />
            {t('common.cancel')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
