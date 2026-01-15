/**
 * DebugPanel - App-wide debug panel for diagnosing issues
 *
 * Shows logs, app status, and Python service information.
 * Toggle with Cmd+Shift+D or via environment variable.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { Bug, X, RefreshCw, Trash2, CheckCircle, XCircle, AlertTriangle, ChevronDown, ChevronUp, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { DebugLogEntry, DebugAppStatus } from '../../../shared/types'

interface DebugPanelProps {
  isOpen: boolean
  onClose: () => void
}

export default function DebugPanel({ isOpen, onClose }: DebugPanelProps) {
  const { t } = useTranslation()
  const [logs, setLogs] = useState<DebugLogEntry[]>([])
  const [status, setStatus] = useState<(DebugAppStatus & { debugEnabled: boolean }) | null>(null)
  const [showStatus, setShowStatus] = useState(true)
  const [autoScroll, setAutoScroll] = useState(true)
  const logContainerRef = useRef<HTMLDivElement>(null)

  // Load initial logs and status
  const refresh = useCallback(async () => {
    try {
      const [logsData, statusData] = await Promise.all([
        window.api.debug.getLogs(),
        window.api.debug.getStatus()
      ])
      setLogs(logsData)
      setStatus(statusData)
    } catch (e) {
      console.error('Failed to load debug data:', e)
    }
  }, [])

  // Subscribe to new logs
  useEffect(() => {
    if (!isOpen) return

    refresh()

    const unsubscribe = window.api.debug.onLog((entry) => {
      setLogs(prev => [...prev.slice(-499), entry])
    })

    return () => unsubscribe()
  }, [isOpen, refresh])

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight
    }
  }, [logs, autoScroll])

  // Clear logs
  const handleClear = async () => {
    await window.api.debug.clearLogs()
    setLogs([])
  }

  // Copy status to clipboard
  const handleCopyStatus = () => {
    if (status) {
      navigator.clipboard.writeText(JSON.stringify(status, null, 2))
    }
  }

  // Format timestamp
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleTimeString('de-DE', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    })
  }

  // Get log level color
  const getLevelColor = (level: DebugLogEntry['level']) => {
    switch (level) {
      case 'error': return 'text-red-400'
      case 'warn': return 'text-yellow-400'
      case 'info': return 'text-blue-400'
      case 'debug': return 'text-gray-400'
      default: return 'text-gray-300'
    }
  }

  // Get category badge color
  const getCategoryColor = (category: DebugLogEntry['category']) => {
    switch (category) {
      case 'main': return 'bg-purple-500/20 text-purple-400'
      case 'renderer': return 'bg-blue-500/20 text-blue-400'
      case 'python': return 'bg-green-500/20 text-green-400'
      case 'whisper': return 'bg-orange-500/20 text-orange-400'
      case 'ffmpeg': return 'bg-pink-500/20 text-pink-400'
      case 'ipc': return 'bg-cyan-500/20 text-cyan-400'
      default: return 'bg-gray-500/20 text-gray-400'
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-4xl max-h-[80vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center">
              <Bug className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">{t('debugPanel.title')}</h2>
              <p className="text-xs text-gray-400">{t('debugPanel.description')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={refresh}
              className="text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="text-gray-400 hover:text-white"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-gray-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Status Section */}
        <div className="border-b border-gray-700">
          <button
            onClick={() => setShowStatus(!showStatus)}
            className="w-full px-4 py-2 flex items-center justify-between text-sm text-gray-300 hover:bg-gray-800/50"
          >
            <span className="font-medium">{t('debugPanel.appStatus')}</span>
            {showStatus ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showStatus && status && (
            <div className="px-4 pb-3 grid grid-cols-2 gap-3 text-xs">
              {/* Left Column - Paths */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-24">{t('debugPanel.packaged')}:</span>
                  <span className={status.isPackaged ? 'text-green-400' : 'text-yellow-400'}>
                    {status.isPackaged ? t('debugPanel.production') : t('debugPanel.development')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-24">{t('debugPanel.platform')}:</span>
                  <span className="text-gray-300">{status.platform} / {status.arch}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-24 shrink-0">{t('debugPanel.python')}:</span>
                  <span className="text-gray-300 break-all font-mono text-[10px]">{status.pythonPath}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-gray-500 w-24 shrink-0">{t('debugPanel.service')}:</span>
                  <span className="text-gray-300 break-all font-mono text-[10px]">{status.pythonServicePath}</span>
                </div>
              </div>

              {/* Right Column - Status Indicators */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-32">{t('debugPanel.pythonExists')}:</span>
                  {status.pythonExists ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-32">{t('debugPanel.serviceExists')}:</span>
                  {status.serviceExists ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-32">{t('debugPanel.whisperRunning')}:</span>
                  {status.whisperServiceRunning ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-gray-500 w-32">{t('debugPanel.modelReady')}:</span>
                  {status.whisperModelReady ? (
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400" />
                  )}
                </div>
              </div>

              {/* Copy Button */}
              <div className="col-span-2 flex justify-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyStatus}
                  className="text-xs text-gray-400 hover:text-white gap-1"
                >
                  <Copy className="w-3 h-3" />
                  {t('debugPanel.copyStatus')}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Logs Section */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-4 py-2 flex items-center justify-between text-xs text-gray-400 border-b border-gray-800">
            <span>{t('debugPanel.logEntries', { count: logs.length })}</span>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoScroll}
                onChange={(e) => setAutoScroll(e.target.checked)}
                className="rounded border-gray-600"
              />
              {t('debugPanel.autoScroll')}
            </label>
          </div>

          <div
            ref={logContainerRef}
            className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1"
          >
            {logs.length === 0 ? (
              <p className="text-gray-500 italic p-2">{t('debugPanel.noLogs')}</p>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex items-start gap-2 p-1.5 rounded hover:bg-gray-800/50',
                    log.level === 'error' && 'bg-red-500/10'
                  )}
                >
                  <span className="text-gray-500 shrink-0 w-20">
                    {formatTime(log.timestamp)}
                  </span>
                  <span className={cn(
                    'shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase font-medium',
                    getCategoryColor(log.category)
                  )}>
                    {log.category}
                  </span>
                  <span className={cn('shrink-0 w-12', getLevelColor(log.level))}>
                    [{log.level}]
                  </span>
                  <span className="text-gray-300 break-all">
                    {log.message}
                    {log.data && (
                      <span className="text-gray-500 ml-2">
                        {typeof log.data === 'string' ? log.data : JSON.stringify(log.data)}
                      </span>
                    )}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500 flex items-center justify-between">
          <span>{t('debugPanel.shortcutHint')}</span>
          <span>Electron {status?.electronVersion} / Node {status?.nodeVersion}</span>
        </div>
      </div>
    </div>
  )
}
