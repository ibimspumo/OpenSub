import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, Download, Users, Check, Loader2, AlertCircle } from 'lucide-react'
import type { ModelDownloadProgress } from '@/lib/types'
import { models } from '@/lib/api'
import { setSettings } from '@/lib/settings'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface SetupWizardProps {
  onComplete: () => void
}

type Step = 'welcome' | 'downloading' | 'done'

function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(0)} MB`
  return `${(bytes / 1_000).toFixed(0)} KB`
}

/**
 * First-run setup: downloads the Parakeet ASR model (and optionally the
 * Sortformer diarization model) with live progress.
 */
export default function SetupWizard({ onComplete }: SetupWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<Step>('welcome')
  const [includeDiarization, setIncludeDiarization] = useState(true)
  const [progress, setProgress] = useState<ModelDownloadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = models.onProgress((p) => {
      setProgress(p)
      if (p.status === 'error' && p.error) {
        setError(p.error)
      }
    })
    return unsubscribe
  }, [])

  const handleStart = useCallback(async () => {
    setStep('downloading')
    setError(null)
    try {
      await models.download(includeDiarization)
      await setSettings({ autoDiarize: includeDiarization })
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setStep('welcome')
    }
  }, [includeDiarization])

  return (
    <div className="fixed inset-0 z-[80] bg-background flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-md mx-4">
        {step === 'welcome' && (
          <div className="animate-fade-in-up">
            {/* Logo */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center glow-primary">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>

            <h1 className="text-2xl font-semibold text-foreground text-center mb-2">
              {t('setupWizard.welcome')}
            </h1>
            <p className="text-sm text-muted-foreground text-center mb-8 leading-relaxed">
              {t('setupWizard.welcomeDescription')}
            </p>

            {/* Model card */}
            <div className="rounded-xl border border-border bg-card p-4 mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
                  <Download className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Parakeet TDT v3</p>
                  <p className="text-xs text-muted-foreground">
                    {t('setupWizard.parakeetDescription')}
                  </p>
                </div>
                <span className="text-xs font-mono text-muted-foreground">~670 MB</span>
              </div>
            </div>

            {/* Diarization opt-in */}
            <div className="rounded-xl border border-border bg-card p-4 mb-8">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center flex-shrink-0">
                  <Users className="w-5 h-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">
                    {t('setupWizard.diarizationTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('setupWizard.diarizationDescription')}
                  </p>
                </div>
                <Switch checked={includeDiarization} onCheckedChange={setIncludeDiarization} />
              </div>
            </div>

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 mb-4 rounded-lg bg-destructive/10 border border-destructive/20 animate-fade-in">
                <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                <p className="text-destructive text-sm">{error}</p>
              </div>
            )}

            <Button className="w-full h-11" onClick={handleStart}>
              <Download className="w-4 h-4" />
              {t('setupWizard.downloadAndInstall')}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-3">
              {t('setupWizard.firstTimeHint')}
            </p>
          </div>
        )}

        {step === 'downloading' && (
          <div className="animate-fade-in text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-2xl bg-primary/15 animate-pulse-soft" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Download className="w-7 h-7 text-primary" />
              </div>
              <Loader2 className="absolute -inset-2 w-20 h-20 text-primary/30 animate-spin [animation-duration:2.5s]" />
            </div>

            <h2 className="text-base font-semibold text-foreground mb-1">
              {t('setupWizard.installing')}
            </h2>
            <p className="text-sm text-muted-foreground mb-6 min-h-[1.25rem]">
              {progress
                ? `${progress.file} — ${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}`
                : t('setupWizard.modelLoading')}
            </p>

            <Progress value={progress?.percent ?? 0} className="h-1.5 mb-2" />
            <p className="text-xs text-muted-foreground tabular-nums">
              {Math.round(progress?.percent ?? 0)}%
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="animate-fade-in-scale text-center">
            <div className="w-16 h-16 mx-auto mb-6 rounded-full bg-primary/15 flex items-center justify-center">
              <Check className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              {t('setupWizard.setupComplete')}
            </h2>
            <p className="text-sm text-muted-foreground mb-8">
              {t('setupWizard.setupCompleteDescription')}
            </p>
            <Button className={cn('w-full h-11')} onClick={onComplete}>
              {t('setupWizard.startApp')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
