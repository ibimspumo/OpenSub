import { useMemo } from 'react'
import type { TranscriptionProgress } from '../../../shared/types'

interface ModelLoadingScreenProps {
  progress: TranscriptionProgress | null
}

export default function ModelLoadingScreen({ progress }: ModelLoadingScreenProps) {
  const percent = progress?.percent ?? 0
  const message = progress?.message || 'KI-Modell wird geladen...'

  // Memoize the progress bar width to prevent unnecessary re-renders
  const progressWidth = useMemo(() => {
    if (percent === 0) return 0
    return Math.min(100, Math.max(0, percent))
  }, [percent])

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-backdrop-in">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-dark-950"
        style={{
          background: `
            radial-gradient(circle at 50% 30%, rgba(139, 92, 246, 0.1) 0%, transparent 50%),
            rgb(2, 6, 23)
          `,
        }}
      />

      {/* Content container */}
      <div className="relative flex flex-col items-center max-w-md w-full px-6">
        {/* Animated AI Icon */}
        <div className="relative mb-8">
          {/* Outer glow rings */}
          <div className="absolute inset-[-20px] rounded-full bg-gradient-to-br from-violet-500/20 to-purple-500/20 blur-2xl animate-pulse-soft" />
          <div className="absolute inset-[-10px] rounded-full bg-gradient-to-br from-violet-500/10 to-purple-500/10 blur-xl animate-pulse-soft" style={{ animationDelay: '500ms' }} />

          {/* Main icon container */}
          <div
            className="
              relative w-24 h-24 rounded-3xl
              flex items-center justify-center
              bg-gradient-to-br from-violet-600 to-purple-600
              shadow-lg shadow-violet-500/30
              animate-breathe
            "
          >
            {/* Inner glow */}
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-b from-white/20 to-transparent" />

            {/* AI Brain Icon */}
            <svg
              className="w-12 h-12 text-white relative z-10"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>

            {/* Spinning ring */}
            <div
              className="absolute inset-[-6px] rounded-3xl border-2 border-violet-400/30 border-t-violet-400/80 animate-spin"
              style={{ animationDuration: '3s' }}
            />
          </div>
        </div>

        {/* App Name */}
        <h1 className="text-2xl font-bold text-white mb-2 tracking-tight">
          OpenSub
        </h1>

        {/* Loading message */}
        <p className="text-dark-400 text-sm text-center mb-8 max-w-xs">
          {message}
        </p>

        {/* Progress bar container */}
        <div className="w-full max-w-xs space-y-3">
          {/* Progress bar */}
          <div className="relative h-1.5 bg-dark-800 rounded-full overflow-hidden">
            {/* Background shimmer effect when no progress */}
            {progressWidth === 0 && (
              <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            )}

            {/* Progress fill */}
            <div
              className="
                absolute left-0 top-0 h-full rounded-full
                bg-gradient-to-r from-violet-500 to-purple-400
                transition-all duration-500 ease-smooth-out
              "
              style={{
                width: progressWidth > 0 ? `${progressWidth}%` : '0%',
                minWidth: progressWidth > 0 ? '8px' : '0',
              }}
            >
              {/* Shine effect */}
              <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-full" />

              {/* Pulse at the end */}
              {progressWidth > 0 && progressWidth < 100 && (
                <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-white/60 rounded-full animate-pulse" />
              )}
            </div>

            {/* Indeterminate animation when no progress */}
            {progressWidth === 0 && (
              <div
                className="
                  absolute top-0 h-full w-1/4 rounded-full
                  bg-gradient-to-r from-violet-500 to-purple-400
                "
                style={{
                  animation: 'progressIndeterminate 1.5s ease-in-out infinite',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/40 to-transparent rounded-full" />
              </div>
            )}
          </div>

          {/* Progress text */}
          <div className="flex items-center justify-between text-xs">
            <span className="text-dark-500">
              {progressWidth > 0 ? 'Fortschritt' : 'Initialisiere...'}
            </span>
            <span className="font-mono text-dark-400">
              {progressWidth > 0 ? `${Math.round(progressWidth)}%` : ''}
            </span>
          </div>
        </div>

        {/* Subtle hint text */}
        <p className="mt-8 text-dark-600 text-xs text-center">
          Dieser Vorgang kann beim ersten Start einige Minuten dauern.
        </p>
      </div>
    </div>
  )
}
