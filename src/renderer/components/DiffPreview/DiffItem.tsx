import { Check, X, Undo2 } from 'lucide-react'
import type { SubtitleChange } from '../../../shared/types'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface DiffItemProps {
  change: SubtitleChange
  time: string
  onAccept: () => void
  onReject: () => void
}

const CHANGE_TYPE_CONFIG = {
  spelling: {
    label: 'Rechtschreibung',
    className: 'bg-blue-500/20 text-blue-300 border-blue-500/30 hover:bg-blue-500/30',
  },
  grammar: {
    label: 'Grammatik',
    className: 'bg-amber-500/20 text-amber-300 border-amber-500/30 hover:bg-amber-500/30',
  },
  context: {
    label: 'Kontext',
    className: 'bg-violet-500/20 text-violet-300 border-violet-500/30 hover:bg-violet-500/30',
  },
  name: {
    label: 'Name',
    className: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/30',
  },
  punctuation: {
    label: 'Zeichen',
    className: 'bg-rose-500/20 text-rose-300 border-rose-500/30 hover:bg-rose-500/30',
  },
} as const

export default function DiffItem({ change, time, onAccept, onReject }: DiffItemProps) {
  const typeConfig = CHANGE_TYPE_CONFIG[change.changeType] || CHANGE_TYPE_CONFIG.context
  const isAccepted = change.status === 'accepted'
  const isRejected = change.status === 'rejected'
  const isPending = change.status === 'pending'

  return (
    <Card
      className={cn(
        'p-4 transition-all duration-200',
        isAccepted && 'bg-emerald-500/10 border-emerald-500/30',
        isRejected && 'bg-red-500/5 border-red-500/20 opacity-50',
        isPending && 'bg-card hover:border-muted-foreground/20'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">{time}</span>
          <Badge variant="outline" className={typeConfig.className}>
            {typeConfig.label}
          </Badge>
        </div>
        {!isPending && (
          <span className={cn(
            'text-xs font-medium',
            isAccepted ? 'text-emerald-400' : 'text-red-400'
          )}>
            {isAccepted ? 'Akzeptiert' : 'Abgelehnt'}
          </span>
        )}
      </div>

      {/* Diff display */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <span className="text-red-400 text-xs font-mono mt-0.5">-</span>
          <p className={cn(
            'text-sm leading-relaxed',
            isRejected ? 'text-muted-foreground' : 'text-red-300 line-through decoration-red-400/50'
          )}>
            {change.originalText}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-emerald-400 text-xs font-mono mt-0.5">+</span>
          <p className={cn(
            'text-sm leading-relaxed',
            isRejected ? 'text-muted-foreground/60' : 'text-emerald-300'
          )}>
            {change.correctedText}
          </p>
        </div>
      </div>

      {/* Reason */}
      {change.reason && (
        <p className="text-xs text-muted-foreground italic mb-3 pl-4 border-l-2 border-border">
          {change.reason}
        </p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <Button
            onClick={onAccept}
            variant="outline"
            size="sm"
            className="flex-1 bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/40 hover:text-emerald-200"
          >
            <Check className="w-3.5 h-3.5" />
            Akzeptieren
          </Button>
          <Button
            onClick={onReject}
            variant="outline"
            size="sm"
            className="flex-1 bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/40 hover:text-red-200"
          >
            <X className="w-3.5 h-3.5" />
            Ablehnen
          </Button>
        </div>
      )}

      {/* Undo for decided items */}
      {!isPending && (
        <Button
          onClick={isAccepted ? onReject : onAccept}
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Rückgängig
        </Button>
      )}
    </Card>
  )
}
