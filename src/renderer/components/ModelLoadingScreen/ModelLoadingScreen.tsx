import { useMemo } from 'react'
import { Loader2, Brain } from 'lucide-react'
import type { TranscriptionProgress } from '../../../shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

interface ModelLoadingScreenProps {
  progress: TranscriptionProgress | null
}

export default function ModelLoadingScreen({ progress }: ModelLoadingScreenProps) {
  const percent = progress?.percent ?? 0
  const message = progress?.message || 'KI-Modell wird geladen...'

  // Memoize the progress bar width to prevent unnecessary re-renders
  const progressWidth = useMemo(() => {
    if (percent === 0) return 0
    return Math.min(100, Math.max(0, percent))
  }, [percent])

  return (
    <Dialog open={true}>
      <DialogContent
        className="sm:max-w-md border-violet-500/20"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          {/* Animated AI Icon */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              {/* Outer glow effect */}
              <div className="absolute inset-[-8px] rounded-3xl bg-violet-500/20 blur-xl animate-pulse" />

              {/* Main icon container */}
              <div
                className={cn(
                  'relative flex h-20 w-20 items-center justify-center rounded-3xl',
                  'bg-gradient-to-br from-violet-600 to-purple-600',
                  'shadow-lg shadow-violet-500/30'
                )}
              >
                {/* Inner highlight */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/20 to-transparent" />

                {/* Brain icon with spinner */}
                <Brain className="h-10 w-10 text-white relative z-10" />

                {/* Spinning ring */}
                <div
                  className="absolute inset-[-4px] rounded-3xl border-2 border-violet-400/30 border-t-violet-400/80 animate-spin"
                  style={{ animationDuration: '3s' }}
                />
              </div>
            </div>
          </div>

          {/* App Name */}
          <DialogTitle className="text-2xl font-bold tracking-tight">
            OpenSub
          </DialogTitle>

          {/* Loading message */}
          <DialogDescription className="text-center max-w-xs">
            {message}
          </DialogDescription>
        </DialogHeader>

        {/* Progress section */}
        <div className="space-y-3 px-4">
          <Progress
            value={progressWidth}
            className="h-1.5 bg-violet-500/10"
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {progressWidth > 0 ? 'Fortschritt' : 'Initialisiere...'}
            </span>
            <span className="font-mono text-muted-foreground">
              {progressWidth > 0 ? `${Math.round(progressWidth)}%` : ''}
            </span>
          </div>
        </div>

        {/* Subtle hint text */}
        <p className="text-center text-xs text-muted-foreground/60 mt-2">
          Dieser Vorgang kann beim ersten Start einige Minuten dauern.
        </p>
      </DialogContent>
    </Dialog>
  )
}
