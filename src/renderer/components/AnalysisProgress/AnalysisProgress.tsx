import { useMemo } from 'react'
import {
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Music,
  Upload,
  Sparkles,
  ClipboardCheck,
  X
} from 'lucide-react'
import type { AnalysisProgress as Progress } from '../../../shared/types'
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

interface AnalysisProgressProps {
  progress: Progress | null
  onCancel: () => void
}

const STAGE_CONFIG = {
  extracting: {
    label: 'Audio extrahieren...',
    description: 'MP3 wird aus dem Video extrahiert',
    icon: Music,
    color: 'text-blue-400',
    bgColor: 'bg-blue-500/10',
  },
  uploading: {
    label: 'Vorbereiten...',
    description: 'Daten werden an die KI gesendet',
    icon: Upload,
    color: 'text-violet-400',
    bgColor: 'bg-violet-500/10',
  },
  analyzing: {
    label: 'KI analysiert...',
    description: 'Gemini vergleicht Audio mit Transkription',
    icon: Sparkles,
    color: 'text-amber-400',
    bgColor: 'bg-amber-500/10',
  },
  comparing: {
    label: 'Vergleiche...',
    description: 'Aenderungen werden ermittelt',
    icon: ClipboardCheck,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  complete: {
    label: 'Fertig!',
    description: 'Analyse abgeschlossen',
    icon: CheckCircle,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  error: {
    label: 'Fehler',
    description: 'Ein Fehler ist aufgetreten',
    icon: XCircle,
    color: 'text-red-400',
    bgColor: 'bg-red-500/10',
  },
} as const

function SparkleAnimation() {
  return (
    <div className="flex items-center justify-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="h-1 w-1 rounded-full bg-muted-foreground/60 animate-pulse"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  )
}

export default function AnalysisProgress({ progress, onCancel }: AnalysisProgressProps) {
  const stage = progress?.stage || 'extracting'
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.extracting
  const isAnimating = stage !== 'complete' && stage !== 'error'
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
                <Loader2 className={cn('h-8 w-8 animate-spin', config.color)} />
              ) : (
                <Icon className={cn('h-8 w-8', config.color)} />
              )}
            </div>
          </div>

          <DialogTitle
            className={cn(
              'text-lg',
              stage === 'complete' && 'text-emerald-400',
              stage === 'error' && 'text-red-400'
            )}
          >
            {config.label}
          </DialogTitle>

          <DialogDescription className="text-center">
            {progress?.message || config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Progress section */}
        <div className="space-y-3">
          <ProgressBar
            value={progressWidth}
            className={cn('h-2', config.bgColor)}
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground font-medium">
              {progressWidth > 0 ? 'Fortschritt' : 'Initialisiere...'}
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

        {/* Sparkle animation */}
        {isAnimating && (
          <div className="flex justify-center">
            <SparkleAnimation />
          </div>
        )}

        <DialogFooter className="sm:justify-center">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full"
          >
            <X className="h-4 w-4" />
            Abbrechen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
