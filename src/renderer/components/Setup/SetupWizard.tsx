import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Download, Check, ChevronRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import type { ModelInfo, TranscriptionProgress } from '../../../shared/types'

interface SetupWizardProps {
  onComplete: () => void
  progress: TranscriptionProgress | null
}

type SetupStep = 'welcome' | 'model' | 'downloading' | 'complete'

export default function SetupWizard({ onComplete, progress }: SetupWizardProps) {
  const { t } = useTranslation()
  const [step, setStep] = useState<SetupStep>('welcome')
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModel, setSelectedModel] = useState<string>('mlx-community/whisper-large-v3-mlx')
  const [isLoading, setIsLoading] = useState(false)

  // Load available models
  useEffect(() => {
    window.api.models.list().then(setModels).catch(console.error)
  }, [])

  // Watch for model ready event during download
  useEffect(() => {
    const unsubscribe = window.api.whisper.onModelReady(({ ready }) => {
      if (ready && step === 'downloading') {
        setStep('complete')
      }
    })
    return () => unsubscribe()
  }, [step])

  // Handle model selection and start download
  const handleSelectModel = async () => {
    setIsLoading(true)
    setStep('downloading')

    try {
      // Save selection and trigger model loading
      const result = await window.api.models.select(selectedModel)
      if (!result.success) {
        console.error('Failed to select model:', result.error)
      }
    } catch (error) {
      console.error('Error selecting model:', error)
    } finally {
      setIsLoading(false)
    }
  }

  // Handle complete button
  const handleComplete = () => {
    onComplete()
  }

  const percent = progress?.percent ?? 0
  const message = progress?.message || t('setupWizard.modelLoading')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4">
        {/* Welcome Step */}
        {step === 'welcome' && (
          <div className="text-center space-y-6 animate-fade-in">
            {/* Animated Logo */}
            <div className="flex justify-center mb-8">
              <div className="relative">
                <div className="absolute inset-[-12px] rounded-3xl bg-violet-500/20 blur-xl animate-pulse" />
                <div
                  className={cn(
                    'relative flex h-24 w-24 items-center justify-center rounded-3xl',
                    'bg-gradient-to-br from-violet-600 to-purple-600',
                    'shadow-xl shadow-violet-500/30'
                  )}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/20 to-transparent" />
                  <Brain className="h-12 w-12 text-white relative z-10" />
                </div>
              </div>
            </div>

            <div>
              <h1 className="text-3xl font-bold tracking-tight mb-2">
                {t('setupWizard.welcome')}
              </h1>
              <p className="text-muted-foreground max-w-sm mx-auto">
                {t('setupWizard.welcomeDescription')}
              </p>
            </div>

            <Button
              size="lg"
              onClick={() => setStep('model')}
              className="gap-2"
            >
              {t('setupWizard.startSetup')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Model Selection Step */}
        {step === 'model' && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                {t('setupWizard.selectModel')}
              </h2>
              <p className="text-sm text-muted-foreground">
                {t('setupWizard.modelSizeHint')}
              </p>
            </div>

            <div className="space-y-3">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModel(model.id)}
                  className={cn(
                    'w-full p-4 rounded-xl border-2 text-left transition-all',
                    'hover:border-violet-500/50 hover:bg-violet-500/5',
                    selectedModel === model.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-border bg-card/50'
                  )}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{model.name}</span>
                        {model.quality === 'high' && (
                          <span className="flex items-center gap-1 text-xs bg-violet-600 text-white px-2 py-0.5 rounded-full">
                            <Sparkles className="h-3 w-3" />
                            {t('settings.recommended')}
                          </span>
                        )}
                        {model.downloaded && (
                          <span className="flex items-center gap-1 text-xs bg-green-600/20 text-green-500 px-2 py-0.5 rounded-full">
                            <Check className="h-3 w-3" />
                            {t('settings.installed')}
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mt-1">
                        {model.quality === 'high' && t('setupWizard.qualityHigh')}
                        {model.quality === 'medium' && t('setupWizard.qualityMedium')}
                        {model.quality === 'low' && t('setupWizard.qualityLow')}
                      </div>
                    </div>
                    <div className="text-sm text-muted-foreground tabular-nums">
                      {model.size}
                    </div>
                  </div>
                </button>
              ))}
            </div>

            <Button
              size="lg"
              onClick={handleSelectModel}
              disabled={isLoading}
              className="w-full gap-2"
            >
              <Download className="h-4 w-4" />
              {t('setupWizard.downloadAndInstall')}
            </Button>
          </div>
        )}

        {/* Downloading Step */}
        {step === 'downloading' && (
          <div className="text-center space-y-6 animate-fade-in">
            {/* Animated Icon */}
            <div className="flex justify-center mb-4">
              <div className="relative">
                <div className="absolute inset-[-8px] rounded-3xl bg-violet-500/20 blur-xl animate-pulse" />
                <div
                  className={cn(
                    'relative flex h-20 w-20 items-center justify-center rounded-3xl',
                    'bg-gradient-to-br from-violet-600 to-purple-600',
                    'shadow-lg shadow-violet-500/30'
                  )}
                >
                  <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/20 to-transparent" />
                  <Brain className="h-10 w-10 text-white relative z-10" />
                  <div
                    className="absolute inset-[-4px] rounded-3xl border-2 border-violet-400/30 border-t-violet-400/80 animate-spin"
                    style={{ animationDuration: '3s' }}
                  />
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                {t('setupWizard.installing')}
              </h2>
              <p className="text-muted-foreground">
                {message}
              </p>
            </div>

            {/* Progress */}
            <div className="space-y-3 px-8">
              <Progress value={percent} className="h-2 bg-violet-500/10" />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{t('common.progress')}</span>
                <span className="font-mono">{Math.round(percent)}%</span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground/60">
              {t('setupWizard.firstTimeHint')}
            </p>
          </div>
        )}

        {/* Complete Step */}
        {step === 'complete' && (
          <div className="text-center space-y-6 animate-fade-in">
            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div
                className={cn(
                  'flex h-20 w-20 items-center justify-center rounded-full',
                  'bg-gradient-to-br from-green-500 to-emerald-600',
                  'shadow-lg shadow-green-500/30'
                )}
              >
                <Check className="h-10 w-10 text-white" />
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-bold tracking-tight mb-2">
                {t('setupWizard.setupComplete')}
              </h2>
              <p className="text-muted-foreground">
                {t('setupWizard.setupCompleteDescription')}
              </p>
            </div>

            <Button
              size="lg"
              onClick={handleComplete}
              className="gap-2"
            >
              {t('setupWizard.startApp')}
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
