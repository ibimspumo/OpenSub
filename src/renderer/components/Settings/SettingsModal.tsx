import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Settings, Eye, EyeOff, Check, Info, Brain, Sparkles, Loader2 } from 'lucide-react'
import type { ModelInfo } from '../../../shared/types'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const [apiKey, setApiKey] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [hasEnvApiKey, setHasEnvApiKey] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Model selection state
  const [models, setModels] = useState<ModelInfo[]>([])
  const [selectedModelId, setSelectedModelId] = useState<string>('')
  const [originalModelId, setOriginalModelId] = useState<string>('')
  const [isChangingModel, setIsChangingModel] = useState(false)

  // Load settings when modal opens
  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    try {
      const [settings, envKeyExists, modelList, currentModel] = await Promise.all([
        window.api.settings.get(),
        window.api.settings.hasEnvApiKey(),
        window.api.models.list(),
        window.api.models.getSelected()
      ])
      setApiKey(settings.openRouterApiKey || '')
      setHasEnvApiKey(envKeyExists)
      setModels(modelList)
      setSelectedModelId(currentModel)
      setOriginalModelId(currentModel)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // Save API key
      await window.api.settings.set({ openRouterApiKey: apiKey })

      // Change model if different from original
      if (selectedModelId !== originalModelId) {
        setIsChangingModel(true)
        const result = await window.api.models.select(selectedModelId)
        if (!result.success) {
          console.error('Failed to change model:', result.error)
        }
        setIsChangingModel(false)
      }

      setSaveSuccess(true)
      // Show success state for 1.5 seconds, then close
      setTimeout(() => {
        setSaveSuccess(false)
        onOpenChange(false)
      }, 1500)
    } catch (error) {
      console.error('Failed to save settings:', error)
    } finally {
      setIsSaving(false)
      setIsChangingModel(false)
    }
  }, [apiKey, selectedModelId, originalModelId, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isSaving) {
        handleSave()
      }
    },
    [handleSave, isSaving]
  )

  const modelHasChanged = selectedModelId !== originalModelId

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Einstellungen</DialogTitle>
          <DialogDescription className="text-center">
            Konfiguriere KI-Modell und API-Key.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Model Selection */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-violet-500" />
              <label className="text-sm font-medium text-foreground">
                KI-Modell fuer Transkription
              </label>
            </div>
            <div className="space-y-2">
              {models.map((model) => (
                <button
                  key={model.id}
                  onClick={() => setSelectedModelId(model.id)}
                  disabled={isSaving || isChangingModel}
                  className={cn(
                    'w-full p-3 rounded-lg border text-left transition-all',
                    'hover:border-violet-500/50 hover:bg-violet-500/5',
                    'disabled:opacity-50 disabled:cursor-not-allowed',
                    selectedModelId === model.id
                      ? 'border-violet-500 bg-violet-500/10'
                      : 'border-border bg-card/50'
                  )}
                >
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">{model.name}</span>
                      {model.quality === 'high' && (
                        <span className="flex items-center gap-1 text-xs bg-violet-600 text-white px-1.5 py-0.5 rounded">
                          <Sparkles className="h-3 w-3" />
                          Empfohlen
                        </span>
                      )}
                      {model.downloaded && (
                        <span className="flex items-center gap-1 text-xs bg-green-600/20 text-green-500 px-1.5 py-0.5 rounded">
                          <Check className="h-3 w-3" />
                          Installiert
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {model.size}
                    </span>
                  </div>
                </button>
              ))}
            </div>
            {modelHasChanged && (
              <p className="text-xs text-amber-500">
                Das Modell wird beim Speichern neu geladen. Dies kann einige Minuten dauern.
              </p>
            )}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Environment Variable Info */}
          {hasEnvApiKey && (
            <div
              className={cn(
                'flex items-start gap-3 p-3 rounded-lg',
                'bg-primary/10 border border-primary/20'
              )}
            >
              <Info className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-primary">Umgebungsvariable aktiv</p>
                <p className="text-muted-foreground mt-0.5">
                  Der API-Key wird aus der Umgebungsvariable gelesen.
                </p>
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium text-foreground">
              OpenRouter API-Key (fuer KI-Korrektur)
            </label>
            <div className="relative">
              <Input
                id="api-key"
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="sk-or-v1-..."
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className={cn(
                  'absolute right-3 top-1/2 -translate-y-1/2',
                  'text-muted-foreground hover:text-foreground',
                  'transition-colors duration-150'
                )}
              >
                {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Optional. Wird nur fuer die KI-Korrektur-Funktion benoetigt.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-3 sm:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving || isChangingModel}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving || isChangingModel} className="min-w-[120px]">
            {saveSuccess ? (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Gespeichert
              </span>
            ) : isChangingModel ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Modell laden...
              </span>
            ) : isSaving ? (
              'Speichern...'
            ) : (
              'Speichern'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
