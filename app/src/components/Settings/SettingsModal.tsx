import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Settings as SettingsIcon, Key, Globe, Users, Check, Download, Loader2 } from 'lucide-react'
import type { AppLanguage, ModelStatus } from '@/lib/types'
import { SUPPORTED_LANGUAGES } from '@/lib/types'
import { getSettings, setSettings } from '@/lib/settings'
import { changeLanguage } from '@/i18n'
import { models } from '@/lib/api'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

interface SettingsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Languages Parakeet TDT v3 supports (subset shown; 'auto' detects automatically) */
const TRANSCRIPTION_LANGUAGES = [
  'auto', 'de', 'en', 'fr', 'es', 'it', 'pt', 'nl', 'pl', 'sv', 'da', 'no', 'fi', 'cs', 'uk', 'ru'
] as const

export default function SettingsModal({ open, onOpenChange }: SettingsModalProps) {
  const { t, i18n } = useTranslation()
  const [apiKey, setApiKey] = useState('')
  const [transcriptionLanguage, setTranscriptionLanguage] = useState('auto')
  const [autoDiarize, setAutoDiarize] = useState(false)
  const [modelStatus, setModelStatus] = useState<ModelStatus | null>(null)
  const [isDownloadingDiarization, setIsDownloadingDiarization] = useState(false)
  const [saved, setSaved] = useState(false)

  // Load current settings when opening
  useEffect(() => {
    if (!open) return
    getSettings().then((settings) => {
      setApiKey(settings.openRouterApiKey ?? '')
      setTranscriptionLanguage(settings.transcriptionLanguage ?? 'auto')
      setAutoDiarize(settings.autoDiarize ?? false)
    })
    models.status().then(setModelStatus).catch(() => {})
  }, [open])

  const persist = useCallback(
    async (updates: Parameters<typeof setSettings>[0]) => {
      await setSettings(updates)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
    []
  )

  const handleDownloadDiarization = useCallback(async () => {
    setIsDownloadingDiarization(true)
    try {
      await models.download(true)
      setModelStatus(await models.status())
    } finally {
      setIsDownloadingDiarization(false)
    }
  }, [])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="w-5 h-5 text-primary" />
            {t('settings.title')}
            {saved && (
              <span className="ml-auto flex items-center gap-1 text-xs font-normal text-primary animate-fade-in">
                <Check className="w-3.5 h-3.5" />
                {t('settings.saved')}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>{t('settings.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* UI language */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Globe className="w-3.5 h-3.5" />
              {t('settings.language')}
            </Label>
            <Select
              value={i18n.language.split('-')[0]}
              onValueChange={async (value) => {
                await changeLanguage(value as AppLanguage)
                await persist({ language: value as AppLanguage })
              }}
            >
              <SelectTrigger className="h-9 bg-muted/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.flag} {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Transcription language */}
          <div className="space-y-2">
            <Label className="text-xs font-medium text-muted-foreground">
              {t('settings.transcriptionLanguage')}
            </Label>
            <Select
              value={transcriptionLanguage}
              onValueChange={async (value) => {
                setTranscriptionLanguage(value)
                await persist({ transcriptionLanguage: value })
              }}
            >
              <SelectTrigger className="h-9 bg-muted/60">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRANSCRIPTION_LANGUAGES.map((code) => (
                  <SelectItem key={code} value={code}>
                    {code === 'auto'
                      ? t('settings.autoDetect')
                      : new Intl.DisplayNames([i18n.language], { type: 'language' }).of(code) ?? code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">{t('settings.transcriptionLanguageHint')}</p>
          </div>

          <Separator />

          {/* Speaker diarization */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Users className="w-3.5 h-3.5" />
                {t('settings.autoDiarize')}
              </Label>
              <Switch
                checked={autoDiarize}
                disabled={!modelStatus?.diarizationReady}
                onCheckedChange={async (checked) => {
                  setAutoDiarize(checked)
                  await persist({ autoDiarize: checked })
                }}
              />
            </div>
            {modelStatus && !modelStatus.diarizationReady && (
              <Button
                variant="outline"
                size="sm"
                className="w-full h-8"
                disabled={isDownloadingDiarization}
                onClick={handleDownloadDiarization}
              >
                {isDownloadingDiarization ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Download className="w-3.5 h-3.5" />
                )}
                {t('settings.downloadDiarization')}
              </Button>
            )}
            <p className="text-[11px] text-muted-foreground">{t('settings.autoDiarizeHint')}</p>
          </div>

          <Separator />

          {/* OpenRouter API key */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <Key className="w-3.5 h-3.5" />
              {t('settings.apiKeyLabel')}
            </Label>
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              onBlur={() => persist({ openRouterApiKey: apiKey || undefined })}
              placeholder="sk-or-..."
              className="h-9 bg-muted/60 font-mono text-xs"
            />
            <p className="text-[11px] text-muted-foreground">{t('settings.apiKeyHint')}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
