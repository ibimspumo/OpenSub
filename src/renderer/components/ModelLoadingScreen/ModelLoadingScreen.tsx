import { useMemo, useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Brain, Download, Terminal, ChevronDown, ChevronUp } from 'lucide-react'
import type { TranscriptionProgress } from '../../../shared/types'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ModelLoadingScreenProps {
  progress: TranscriptionProgress | null
  isFirstRun?: boolean
}

export default function ModelLoadingScreen({ progress, isFirstRun = false }: ModelLoadingScreenProps) {
  const { t } = useTranslation()
  const percent = progress?.percent ?? 0
  const [showDebug, setShowDebug] = useState(false)
  const [debugLogs, setDebugLogs] = useState<string[]>([])
  const [elapsedTime, setElapsedTime] = useState(0)
  const logContainerRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(Date.now())

  // Timer for elapsed time
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Listen for debug logs from Python service
  useEffect(() => {
    const unsubscribe = window.api.whisper.onDebugLog(({ log }) => {
      setDebugLogs(prev => {
        // Keep last 100 lines to prevent memory issues
        const newLogs = [...prev, log]
        return newLogs.slice(-100)
      })
    })
    return () => unsubscribe()
  }, [])

  // Auto-scroll to bottom of log container
  useEffect(() => {
    if (logContainerRef.current && showDebug) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [debugLogs, showDebug])

  // Customize message based on first-run status
  const message = useMemo(() => {
    if (progress?.message) return progress.message
    if (isFirstRun) return t('modelLoading.downloading')
    return t('modelLoading.loading')
  }, [progress?.message, isFirstRun, t])

  // Memoize the progress bar width to prevent unnecessary re-renders
  const progressWidth = useMemo(() => {
    if (percent === 0) return 0
    return Math.min(100, Math.max(0, percent))
  }, [percent])

  // Format elapsed time as mm:ss
  const formattedTime = useMemo(() => {
    const minutes = Math.floor(elapsedTime / 60)
    const seconds = elapsedTime % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }, [elapsedTime])

  return (
    <Dialog open={true}>
      <DialogContent
        className={cn(
          'border-violet-500/20 transition-all duration-300',
          showDebug ? 'sm:max-w-2xl' : 'sm:max-w-md'
        )}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="items-center text-center">
          {/* Animated AI Icon */}
          <div className="mb-4 flex justify-center">
            <div className="relative">
              {/* Outer glow effect */}
              <div className="absolute inset-[-8px] rounded-3xl bg-violet-500/20 blur-xl animate-pulse" />

              {/* Main icon container */}
              <div
                className={cn(
                  'relative flex h-20 w-20 items-center justify-center rounded-3xl',
                  'bg-gradient-to-br from-violet-600 to-purple-600',
                  'shadow-lg shadow-violet-500/30'
                )}
              >
                {/* Inner highlight */}
                <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/20 to-transparent" />

                {/* Brain icon with spinner */}
                <Brain className="h-10 w-10 text-white relative z-10" />

                {/* Spinning ring */}
                <div
                  className="absolute inset-[-4px] rounded-3xl border-2 border-violet-400/30 border-t-violet-400/80 animate-spin"
                  style={{ animationDuration: '3s' }}
                />
              </div>
            </div>
          </div>

          {/* App Name */}
          <DialogTitle className="text-2xl font-bold tracking-tight">
            OpenSub
          </DialogTitle>

          {/* Loading message */}
          <DialogDescription className="text-center max-w-xs">
            {message}
          </DialogDescription>
        </DialogHeader>

        {/* Progress section */}
        <div className="space-y-3 px-4">
          <Progress
            value={progressWidth}
            className="h-1.5 bg-violet-500/10"
          />

          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {progressWidth > 0 ? t('common.progress') : t('common.initializing')}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-muted-foreground/70">
                {formattedTime}
              </span>
              <span className="font-mono text-muted-foreground">
                {progressWidth > 0 ? `${Math.round(progressWidth)}%` : ''}
              </span>
            </div>
          </div>
        </div>

        {/* Subtle hint text - different for first run */}
        {isFirstRun ? (
          <div className="space-y-2 mt-2">
            <div className="flex items-center justify-center gap-2 text-xs text-violet-400">
              <Download className="h-3 w-3" />
              <span>{t('modelLoading.firstRun')}</span>
            </div>
            <p className="text-center text-xs text-muted-foreground/60">
              {t('modelLoading.firstRunHint')}
            </p>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground/60 mt-2">
            {t('modelLoading.startupHint')}
          </p>
        )}

        {/* Debug toggle button */}
        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className="text-xs text-muted-foreground/60 hover:text-muted-foreground gap-1"
          >
            <Terminal className="h-3 w-3" />
            {t('modelLoading.debugOutput')}
            {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </Button>
        </div>

        {/* Debug log panel */}
        {showDebug && (
          <div className="mt-2 border border-border/50 rounded-lg overflow-hidden">
            <div className="bg-black/30 px-3 py-1.5 border-b border-border/50 flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">{t('modelLoading.pythonLogs')}</span>
              <span className="text-xs text-muted-foreground/50 font-mono">
                {debugLogs.length} {t('modelLoading.lines')}
              </span>
            </div>
            <div
              ref={logContainerRef}
              className="h-48 overflow-y-auto bg-black/20 p-2 font-mono text-xs"
            >
              {debugLogs.length === 0 ? (
                <p className="text-muted-foreground/40 italic">
                  {t('modelLoading.waitingForLogs')}
                </p>
              ) : (
                debugLogs.map((log, index) => (
                  <div
                    key={index}
                    className={cn(
                      'py-0.5 whitespace-pre-wrap break-all',
                      log.includes('ERROR') || log.includes('error')
                        ? 'text-red-400'
                        : log.includes('WARNING') || log.includes('warning')
                          ? 'text-yellow-400'
                          : log.includes('INFO')
                            ? 'text-blue-400'
                            : 'text-muted-foreground/80'
                    )}
                  >
                    {log}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
