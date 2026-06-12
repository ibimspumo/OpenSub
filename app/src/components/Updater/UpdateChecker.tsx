import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Download, RefreshCw, X } from 'lucide-react'
import { useUpdateStore } from '@/store/updateStore'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

/** How often to check GitHub releases for updates in the background */
const CHECK_INTERVAL_MS = 60 * 60 * 1000

/**
 * Background update polling (on startup + hourly) and a
 * non-intrusive toast offering to install when one is found.
 */
export default function UpdateChecker() {
  const { t } = useTranslation()
  const { status, availableVersion, releaseNotes, downloadPercent, toastDismissed } =
    useUpdateStore()
  const { checkForUpdates, install, restart, dismissToast } = useUpdateStore()

  useEffect(() => {
    // Delay the first check so it never competes with app startup
    const timer = setTimeout(() => checkForUpdates(), 5000)
    const interval = setInterval(() => checkForUpdates(), CHECK_INTERVAL_MS)
    return () => {
      clearTimeout(timer)
      clearInterval(interval)
    }
  }, [checkForUpdates])

  const visible =
    !toastDismissed && (status === 'available' || status === 'downloading' || status === 'ready')
  if (!visible) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 left-4 z-50 w-80',
        'bg-card border border-border rounded-xl p-4 shadow-2xl',
        'animate-slide-in-up'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center flex-shrink-0">
          {status === 'ready' ? (
            <RefreshCw className="w-4 h-4 text-primary" />
          ) : (
            <Download className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {status === 'available' && (
            <>
              <p className="text-sm font-medium text-foreground">
                {t('updater.available', { version: availableVersion })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {releaseNotes || ''}
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-7 text-xs" onClick={() => install()}>
                  {t('updater.install')}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={dismissToast}>
                  {t('updater.later')}
                </Button>
              </div>
            </>
          )}
          {status === 'downloading' && (
            <>
              <p className="text-sm font-medium text-foreground">{t('updater.downloading')}</p>
              <Progress value={downloadPercent} className="h-1 mt-2" />
            </>
          )}
          {status === 'ready' && (
            <>
              <p className="text-sm font-medium text-foreground">{t('updater.ready')}</p>
              <Button size="sm" className="h-7 text-xs mt-3" onClick={() => restart()}>
                <RefreshCw className="w-3 h-3" />
                {t('updater.restart')}
              </Button>
            </>
          )}
        </div>
        {status === 'available' && (
          <button
            onClick={dismissToast}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
