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
import { Settings, Eye, EyeOff, Check, Info } from 'lucide-react'

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

  // Load settings when modal opens
  useEffect(() => {
    if (open) {
      loadSettings()
    }
  }, [open])

  const loadSettings = async () => {
    try {
      const [settings, envKeyExists] = await Promise.all([
        window.api.settings.get(),
        window.api.settings.hasEnvApiKey()
      ])
      setApiKey(settings.openRouterApiKey || '')
      setHasEnvApiKey(envKeyExists)
    } catch (error) {
      console.error('Failed to load settings:', error)
    }
  }

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    setSaveSuccess(false)

    try {
      await window.api.settings.set({ openRouterApiKey: apiKey })
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
    }
  }, [apiKey, onOpenChange])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isSaving) {
        handleSave()
      }
    },
    [handleSave, isSaving]
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/20">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center">Einstellungen</DialogTitle>
          <DialogDescription className="text-center">
            Konfiguriere deinen OpenRouter API-Key fuer die KI-Funktionen.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
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
                  Der API-Key wird aus der Umgebungsvariable gelesen. Der unten eingegebene Key wird
                  nur verwendet, wenn keine Umgebungsvariable gesetzt ist.
                </p>
              </div>
            </div>
          )}

          {/* API Key Input */}
          <div className="space-y-2">
            <label htmlFor="api-key" className="text-sm font-medium text-foreground">
              OpenRouter API-Key
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
              Der API-Key wird lokal auf deinem Computer gespeichert und niemals uebertragen.
            </p>
          </div>
        </div>

        <DialogFooter className="flex-row gap-3 sm:justify-end">
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="min-w-[100px]">
            {saveSuccess ? (
              <span className="flex items-center gap-2">
                <Check className="h-4 w-4" />
                Gespeichert
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
