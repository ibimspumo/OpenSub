import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

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

  const getStatusConfig = () => {
    switch (saveStatus) {
      case 'saving':
        return {
          variant: 'outline' as const,
          className: 'bg-primary/20 text-primary border-primary/30',
          icon: <Loader2 className="w-3 h-3 animate-spin" />,
          text: 'Speichere...',
        }
      case 'saved':
        return {
          variant: 'outline' as const,
          className: 'bg-green-500/20 text-green-400 border-green-500/30',
          icon: <div className="w-2 h-2 rounded-full bg-green-400" />,
          text: 'Gespeichert',
        }
      case 'error':
        return {
          variant: 'destructive' as const,
          className: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: <div className="w-2 h-2 rounded-full bg-red-400" />,
          text: 'Fehler beim Speichern',
        }
      default:
        return {
          variant: 'secondary' as const,
          className: 'bg-muted text-muted-foreground border-border',
          icon: <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50" />,
          text: lastSavedAt ? `Gespeichert ${timeAgo}` : '',
        }
    }
  }

  const config = getStatusConfig()

  if (!config.text) return null

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'gap-1.5 font-normal transition-colors duration-200',
        config.className
      )}
    >
      {config.icon}
      {config.text}
    </Badge>
  )
}
