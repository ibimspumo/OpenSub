import { useTranslation } from 'react-i18next'
import { Mic, Loader2, Users, X } from 'lucide-react'
import type { TranscriptionProgress as TranscriptionProgressType } from '@/lib/types'
import { transcription } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface TranscriptionProgressProps {
  progress: TranscriptionProgressType | null
}

export default function TranscriptionProgress({ progress }: TranscriptionProgressProps) {
  const { t } = useTranslation()

  const stage = progress?.stage ?? 'loading'
  const percent = progress?.percent ?? 0

  const stageLabel = {
    initializing: t('common.initializing'),
    loading: t('transcription.loadingAudio'),
    transcribing: t('transcription.transcribing'),
    diarizing: t('transcription.diarizing'),
    complete: t('transcription.complete')
  }[stage] ?? t('transcription.transcribing')

  const StageIcon = stage === 'diarizing' ? Users : Mic

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in-scale">
        {/* Animated icon */}
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-2xl bg-primary/15 animate-pulse-soft" />
          <div className="absolute inset-0 flex items-center justify-center">
            <StageIcon className="w-7 h-7 text-primary" />
          </div>
          <Loader2 className="absolute -inset-2 w-20 h-20 text-primary/30 animate-spin [animation-duration:2.5s]" />
        </div>

        <h2 className="text-base font-semibold text-foreground text-center mb-1">
          {stageLabel}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6 min-h-[1.25rem]">
          {progress?.message ?? ''}
        </p>

        <Progress value={percent} className="h-1.5 mb-2" />
        <p className="text-xs text-muted-foreground text-center tabular-nums mb-5">
          {Math.round(percent)}%
        </p>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => transcription.cancel()}
        >
          <X className="w-4 h-4" />
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}
