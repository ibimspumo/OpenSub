import { useMemo } from 'react'
import { useUIStore } from '../../store/uiStore'

/**
 * Format relative time since last save
 */
function formatTimeAgo(timestamp: number | null): string {
  if (!timestamp) return ''

  const seconds = Math.floor((Date.now() - timestamp) / 1000)

  if (seconds < 5) return 'gerade eben'
  if (seconds < 60) return `vor ${seconds}s`
  if (seconds < 3600) return `vor ${Math.floor(seconds / 60)}m`

  return `vor ${Math.floor(seconds / 3600)}h`
}

export default function SaveIndicator() {
  const { saveStatus, lastSavedAt } = useUIStore()

  const timeAgo = useMemo(() => formatTimeAgo(lastSavedAt), [lastSavedAt])

  // Don't show anything if never saved
  if (saveStatus === 'idle' && !lastSavedAt) {
    return null
  }

  return (
    <div className="flex items-center gap-1.5 text-xs">
      {/* Status indicator dot */}
      <div className="relative">
        {saveStatus === 'saving' ? (
          // Animated saving indicator
          <div className="w-2 h-2 rounded-full bg-primary-400 animate-pulse" />
        ) : saveStatus === 'saved' ? (
          // Success indicator
          <div className="w-2 h-2 rounded-full bg-green-400" />
        ) : saveStatus === 'error' ? (
          // Error indicator
          <div className="w-2 h-2 rounded-full bg-red-400" />
        ) : (
          // Idle indicator (small dot)
          <div className="w-1.5 h-1.5 rounded-full bg-dark-500" />
        )}
      </div>

      {/* Status text */}
      <span
        className={`
          transition-colors duration-200
          ${saveStatus === 'saving' ? 'text-primary-400' : ''}
          ${saveStatus === 'saved' ? 'text-green-400' : ''}
          ${saveStatus === 'error' ? 'text-red-400' : ''}
          ${saveStatus === 'idle' ? 'text-dark-500' : ''}
        `}
      >
        {saveStatus === 'saving' && 'Speichere...'}
        {saveStatus === 'saved' && 'Gespeichert'}
        {saveStatus === 'error' && 'Fehler beim Speichern'}
        {saveStatus === 'idle' && lastSavedAt && `Gespeichert ${timeAgo}`}
      </span>
    </div>
  )
}
