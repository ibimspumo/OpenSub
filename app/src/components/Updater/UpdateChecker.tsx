import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'
import { Download, RefreshCw, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

type UpdateState =
  | { phase: 'idle' }
  | { phase: 'available'; update: Update }
  | { phase: 'downloading'; percent: number }
  | { phase: 'ready' }

/**
 * Checks GitHub releases for app updates on startup and shows a
 * non-intrusive toast offering to install.
 */
export default function UpdateChecker() {
  const { t } = useTranslation()
  const [state, setState] = useState<UpdateState>({ phase: 'idle' })
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    // Delay the check so it never competes with app startup
    const timer = setTimeout(async () => {
      try {
        const update = await check()
        if (update) {
          setState({ phase: 'available', update })
        }
      } catch {
        // Offline or no release yet — silently ignore
      }
    }, 5000)
    return () => clearTimeout(timer)
  }, [])

  const handleInstall = async (update: Update) => {
    let downloaded = 0
    let total = 0
    setState({ phase: 'downloading', percent: 0 })
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          setState({
            phase: 'downloading',
            percent: total > 0 ? (downloaded / total) * 100 : 0
          })
        } else if (event.event === 'Finished') {
          setState({ phase: 'ready' })
        }
      })
      setState({ phase: 'ready' })
    } catch (err) {
      console.error('Update failed:', err)
      setState({ phase: 'idle' })
    }
  }

  if (state.phase === 'idle' || dismissed) return null

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
          {state.phase === 'ready' ? (
            <RefreshCw className="w-4 h-4 text-primary" />
          ) : (
            <Download className="w-4 h-4 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          {state.phase === 'available' && (
            <>
              <p className="text-sm font-medium text-foreground">
                {t('updater.available', { version: state.update.version })}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                {state.update.body || ''}
              </p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" className="h-7 text-xs" onClick={() => handleInstall(state.update)}>
                  {t('updater.install')}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setDismissed(true)}
                >
                  {t('updater.later')}
                </Button>
              </div>
            </>
          )}
          {state.phase === 'downloading' && (
            <>
              <p className="text-sm font-medium text-foreground">{t('updater.downloading')}</p>
              <Progress value={state.percent} className="h-1 mt-2" />
            </>
          )}
          {state.phase === 'ready' && (
            <>
              <p className="text-sm font-medium text-foreground">{t('updater.ready')}</p>
              <Button size="sm" className="h-7 text-xs mt-3" onClick={() => relaunch()}>
                <RefreshCw className="w-3 h-3" />
                {t('updater.restart')}
              </Button>
            </>
          )}
        </div>
        {state.phase === 'available' && (
          <button
            onClick={() => setDismissed(true)}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
