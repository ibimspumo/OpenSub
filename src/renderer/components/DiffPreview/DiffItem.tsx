import type { SubtitleChange } from '../../../shared/types'

interface DiffItemProps {
  change: SubtitleChange
  time: string
  onAccept: () => void
  onReject: () => void
}

const CHANGE_TYPE_CONFIG = {
  spelling: {
    label: 'Rechtschreibung',
    color: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  },
  grammar: {
    label: 'Grammatik',
    color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  },
  context: {
    label: 'Kontext',
    color: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
  },
  name: {
    label: 'Name',
    color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  },
  punctuation: {
    label: 'Zeichen',
    color: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
  },
} as const

export default function DiffItem({ change, time, onAccept, onReject }: DiffItemProps) {
  const typeConfig = CHANGE_TYPE_CONFIG[change.changeType] || CHANGE_TYPE_CONFIG.context
  const isAccepted = change.status === 'accepted'
  const isRejected = change.status === 'rejected'
  const isPending = change.status === 'pending'

  return (
    <div
      className={`
        rounded-xl border p-4 transition-all duration-200
        ${isAccepted ? 'bg-emerald-500/10 border-emerald-500/30' : ''}
        ${isRejected ? 'bg-red-500/5 border-red-500/20 opacity-50' : ''}
        ${isPending ? 'bg-dark-800/50 border-white/[0.06] hover:border-white/[0.12]' : ''}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-dark-400">{time}</span>
          <span className={`text-xs px-2 py-0.5 rounded-md border ${typeConfig.color}`}>
            {typeConfig.label}
          </span>
        </div>
        {!isPending && (
          <span className={`text-xs font-medium ${isAccepted ? 'text-emerald-400' : 'text-red-400'}`}>
            {isAccepted ? 'Akzeptiert' : 'Abgelehnt'}
          </span>
        )}
      </div>

      {/* Diff display */}
      <div className="space-y-2 mb-3">
        <div className="flex items-start gap-2">
          <span className="text-red-400 text-xs font-mono mt-0.5">-</span>
          <p className={`text-sm leading-relaxed ${isRejected ? 'text-dark-300' : 'text-red-300 line-through decoration-red-400/50'}`}>
            {change.originalText}
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="text-emerald-400 text-xs font-mono mt-0.5">+</span>
          <p className={`text-sm leading-relaxed ${isRejected ? 'text-dark-400' : 'text-emerald-300'}`}>
            {change.correctedText}
          </p>
        </div>
      </div>

      {/* Reason */}
      {change.reason && (
        <p className="text-xs text-dark-400 italic mb-3 pl-4 border-l-2 border-dark-700">
          {change.reason}
        </p>
      )}

      {/* Actions */}
      {isPending && (
        <div className="flex gap-2">
          <button
            onClick={onAccept}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/40 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Akzeptieren
          </button>
          <button
            onClick={onReject}
            className="flex-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/40 active:scale-[0.98] transition-all duration-150 flex items-center justify-center gap-1.5"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Ablehnen
          </button>
        </div>
      )}

      {/* Undo for decided items */}
      {!isPending && (
        <button
          onClick={isAccepted ? onReject : onAccept}
          className="text-xs text-dark-400 hover:text-white transition-colors duration-150"
        >
          Rückgängig
        </button>
      )}
    </div>
  )
}
