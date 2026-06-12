import { useTranslation } from 'react-i18next'
import { Clapperboard, X } from 'lucide-react'
import { useUIStore } from '@/store/uiStore'
import { ffmpeg } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'

export default function ExportProgress() {
  const { t } = useTranslation()
  const { exportProgress, setIsExporting } = useUIStore()

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center animate-fade-in">
      <div className="w-full max-w-sm mx-4 bg-card border border-border rounded-2xl p-8 shadow-2xl animate-fade-in-scale">
        <div className="relative w-16 h-16 mx-auto mb-6">
          <div className="absolute inset-0 rounded-2xl bg-primary/15 animate-pulse-soft" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Clapperboard className="w-7 h-7 text-primary" />
          </div>
        </div>

        <h2 className="text-base font-semibold text-foreground text-center mb-1">
          {t('export.exporting')}
        </h2>
        <p className="text-sm text-muted-foreground text-center mb-6">
          {t('export.exportingDescription')}
        </p>

        <Progress value={exportProgress} className="h-1.5 mb-2" />
        <p className="text-xs text-muted-foreground text-center tabular-nums mb-5">
          {Math.round(exportProgress)}%
        </p>

        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            ffmpeg.cancel()
            setIsExporting(false)
          }}
        >
          <X className="w-4 h-4" />
          {t('common.cancel')}
        </Button>
      </div>
    </div>
  )
}
