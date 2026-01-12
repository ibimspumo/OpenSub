import type { TranscriptionProgress as Progress } from '../../../shared/types'

interface TranscriptionProgressProps {
  progress: Progress | null
}

export default function TranscriptionProgress({ progress }: TranscriptionProgressProps) {
  const getStageLabel = (stage: Progress['stage']) => {
    switch (stage) {
      case 'loading':
        return 'Lade Audio...'
      case 'transcribing':
        return 'Transkribiere...'
      case 'aligning':
        return 'Synchronisiere Wörter...'
      case 'diarizing':
        return 'Erkenne Sprecher...'
      case 'complete':
        return 'Fertig!'
      default:
        return 'Verarbeite...'
    }
  }

  const getStageIcon = (stage: Progress['stage']) => {
    switch (stage) {
      case 'loading':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
            />
          </svg>
        )
      case 'transcribing':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
        )
      case 'aligning':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h16m-7 6h7"
            />
          </svg>
        )
      case 'diarizing':
        return (
          <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
            />
          </svg>
        )
      case 'complete':
        return (
          <svg className="w-8 h-8 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        )
      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className={`text-primary-400 ${progress?.stage !== 'complete' ? 'animate-pulse' : ''}`}>
            {progress && getStageIcon(progress.stage)}
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-center mb-2">
          {progress ? getStageLabel(progress.stage) : 'Starte Transkription...'}
        </h2>

        {/* Message */}
        {progress?.message && (
          <p className="text-dark-400 text-center text-sm mb-6">{progress.message}</p>
        )}

        {/* Progress Bar */}
        <div className="relative h-2 bg-dark-700 rounded-full overflow-hidden mb-4">
          <div
            className={`absolute left-0 top-0 h-full bg-primary-500 transition-all duration-300 ${
              !progress || progress.percent === 0 ? 'progress-indeterminate w-full' : ''
            }`}
            style={{
              width: progress && progress.percent > 0 ? `${progress.percent}%` : undefined
            }}
          />
        </div>

        {/* Percentage */}
        <p className="text-center text-sm text-dark-400">
          {progress && progress.percent > 0 ? `${Math.round(progress.percent)}%` : 'Bitte warten...'}
        </p>

        {/* Cancel Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => window.api.whisper.cancel()}
            className="btn btn-ghost text-sm"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
