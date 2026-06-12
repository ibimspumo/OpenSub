import { useTranslation } from 'react-i18next'
import { Lightbulb, X, AlertCircle } from 'lucide-react'
import type { AnalysisProgress as AnalysisProgressType } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

interface AnalysisProgressProps {
  progress: AnalysisProgressType | null
  onCancel: () => void
}

export default function AnalysisProgress({ progress, onCancel }: AnalysisProgressProps) {
  const { t } = useTranslation()

  const stage = progress?.stage ?? 'extracting'
  const isError = stage === 'error'

  const stageLabel = {
    extracting: t('analysis.extractingAudio'),
    uploading: t('analysis.preparing'),
    analyzing: t('analysis.analyzing'),
    comparing: t('analysis.comparing'),
    complete: t('analysis.complete'),
    error: t('analysis.error')
  }[stage]

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in-scale">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div
            className={
              isError
                ? 'absolute inset-0 rounded-2xl bg-destructive/15'
                : 'absolute inset-0 rounded-2xl bg-violet-500/15 animate-pulse-soft'
            }
          />
          <div className="absolute inset-0 flex items-center justify-center">
            {isError ? (
              <AlertCircle className="w-7 h-7 text-destructive" />
            ) : (
              <Lightbulb className="w-7 h-7 text-violet-400" />
            )}
          </div>
        </div>

        <h2 className="text-base font-semibold text-foreground text-center mb-1">{stageLabel}</h2>
        <p className="text-sm text-muted-foreground text-center mb-6 min-h-[1.25rem]">
          {progress?.message ?? ''}
        </p>

        {!isError && (
          <>
            <Progress value={progress?.percent ?? 0} className="h-1.5 mb-2 [&>div]:bg-violet-500" />
            <p className="text-xs text-muted-foreground text-center tabular-nums mb-5">
              {Math.round(progress?.percent ?? 0)}%
            </p>
          </>
        )}

        <Button variant="outline" className="w-full" onClick={onCancel}>
          <X className="w-4 h-4" />
          {isError ? t('common.close') : t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}
