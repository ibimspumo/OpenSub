import { useMemo } from 'react'
import type { TranscriptionProgress as Progress } from '../../../shared/types'

interface TranscriptionProgressProps {
  progress: Progress | null
}

// Stage configuration with icons and colors
const STAGE_CONFIG = {
  loading: {
    label: 'Lade Audio...',
    description: 'Audiodatei wird extrahiert und vorbereitet',
    color: 'from-blue-500 to-cyan-400',
    bgGlow: 'rgba(59, 130, 246, 0.15)',
  },
  transcribing: {
    label: 'Transkribiere...',
    description: 'KI analysiert gesprochene Inhalte',
    color: 'from-violet-500 to-purple-400',
    bgGlow: 'rgba(139, 92, 246, 0.15)',
  },
  aligning: {
    label: 'Synchronisiere...',
    description: 'Wörter werden zeitlich zugeordnet',
    color: 'from-amber-500 to-orange-400',
    bgGlow: 'rgba(245, 158, 11, 0.15)',
  },
  complete: {
    label: 'Fertig!',
    description: 'Transkription erfolgreich abgeschlossen',
    color: 'from-green-500 to-emerald-400',
    bgGlow: 'rgba(34, 197, 94, 0.2)',
  },
} as const

// Animated stage icon component
function StageIcon({ stage, isAnimating }: { stage: Progress['stage']; isAnimating: boolean }) {
  const iconClass = `w-7 h-7 transition-all duration-300 ${isAnimating ? 'text-white' : 'text-white'}`

  const icons = {
    loading: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3"
        />
      </svg>
    ),
    transcribing: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
        />
      </svg>
    ),
    aligning: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 6h16M4 12h16m-7 6h7"
        />
      </svg>
    ),
    complete: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  }

  return icons[stage] || icons.loading
}

// Animated waveform component for visual interest
function AudioWaveform({ isAnimating }: { isAnimating: boolean }) {
  const bars = 5
  return (
    <div className="flex items-center justify-center gap-0.5 h-4">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className={`
            w-0.5 rounded-full bg-white/60
            transition-all duration-150
            ${isAnimating ? 'animate-pulse-soft' : ''}
          `}
          style={{
            height: isAnimating ? `${8 + Math.random() * 8}px` : '4px',
            animationDelay: `${i * 100}ms`,
            animationDuration: `${600 + i * 100}ms`,
          }}
        />
      ))}
    </div>
  )
}

// Stage progress indicator (dots)
function StageIndicator({ currentStage }: { currentStage: Progress['stage'] }) {
  const stages: Progress['stage'][] = ['loading', 'transcribing', 'aligning', 'complete']
  const currentIndex = stages.indexOf(currentStage)

  return (
    <div className="flex items-center justify-center gap-2">
      {stages.slice(0, -1).map((stage, index) => {
        const isCompleted = index < currentIndex
        const isCurrent = index === currentIndex
        const isPending = index > currentIndex

        return (
          <div key={stage} className="flex items-center gap-2">
            {/* Dot */}
            <div
              className={`
                relative w-2 h-2 rounded-full transition-all duration-300
                ${isCompleted ? 'bg-emerald-400 scale-100' : ''}
                ${isCurrent ? 'bg-primary-400 scale-125' : ''}
                ${isPending ? 'bg-dark-600 scale-100' : ''}
              `}
            >
              {/* Pulse effect for current */}
              {isCurrent && (
                <div className="absolute inset-0 rounded-full bg-primary-400 animate-ping opacity-50" />
              )}
            </div>

            {/* Connector line (except for last) */}
            {index < stages.length - 2 && (
              <div
                className={`
                  w-6 h-0.5 rounded-full transition-all duration-500
                  ${isCompleted ? 'bg-emerald-400/50' : 'bg-dark-700'}
                `}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TranscriptionProgress({ progress }: TranscriptionProgressProps) {
  const stage = progress?.stage || 'loading'
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.loading
  const isAnimating = stage !== 'complete'
  const percent = progress?.percent ?? 0

  // Memoize the progress bar width to prevent unnecessary re-renders
  const progressWidth = useMemo(() => {
    if (!progress || percent === 0) return 0
    return Math.min(100, Math.max(0, percent))
  }, [progress, percent])

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-backdrop-in">
      {/* Backdrop with blur */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        style={{
          background: `
            radial-gradient(circle at 50% 30%, ${config.bgGlow} 0%, transparent 50%),
            rgba(0, 0, 0, 0.75)
          `,
        }}
      />

      {/* Modal container */}
      <div
        className={`
          relative w-full max-w-sm
          glass-dark-heavy rounded-2xl
          shadow-elevated-lg
          overflow-hidden
          animate-modal-in
        `}
      >
        {/* Animated gradient border effect */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div
            className={`
              absolute inset-[-2px] rounded-2xl opacity-50
              bg-gradient-to-br ${config.color}
              ${isAnimating ? 'animate-spin-slow' : ''}
            `}
            style={{
              background: `conic-gradient(from 0deg, transparent, ${config.bgGlow}, transparent)`,
              animationDuration: '8s',
            }}
          />
        </div>

        {/* Content container */}
        <div className="relative bg-dark-900/95 rounded-2xl m-[1px] p-6">
          {/* Icon container with gradient background */}
          <div className="flex justify-center mb-5">
            <div
              className={`
                relative w-16 h-16 rounded-2xl
                flex items-center justify-center
                bg-gradient-to-br ${config.color}
                shadow-lg
                transition-all duration-500
                ${isAnimating ? 'animate-breathe' : 'animate-spring-scale'}
              `}
            >
              {/* Icon glow effect */}
              <div
                className={`
                  absolute inset-0 rounded-2xl opacity-40
                  bg-gradient-to-br ${config.color}
                  blur-xl
                  ${isAnimating ? 'animate-pulse-soft' : ''}
                `}
              />

              {/* Icon */}
              <div className="relative z-10">
                <StageIcon stage={stage} isAnimating={isAnimating} />
              </div>

              {/* Spinning ring for loading states */}
              {isAnimating && (
                <div className="absolute inset-[-4px] rounded-2xl border-2 border-white/20 border-t-white/60 animate-spin" style={{ animationDuration: '2s' }} />
              )}
            </div>
          </div>

          {/* Title */}
          <h2
            className={`
              text-lg font-semibold text-center text-white mb-1
              transition-all duration-300
              ${stage === 'complete' ? 'text-emerald-300' : ''}
            `}
          >
            {config.label}
          </h2>

          {/* Description */}
          <p className="text-dark-400 text-center text-xs mb-5 transition-opacity duration-300">
            {progress?.message || config.description}
          </p>

          {/* Stage indicator dots */}
          <div className="mb-5">
            <StageIndicator currentStage={stage} />
          </div>

          {/* Progress bar container */}
          <div className="space-y-2">
            {/* Progress bar */}
            <div className="relative h-2 bg-dark-800 rounded-full overflow-hidden">
              {/* Background shimmer effect */}
              {isAnimating && progressWidth === 0 && (
                <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              )}

              {/* Progress fill */}
              <div
                className={`
                  absolute left-0 top-0 h-full rounded-full
                  bg-gradient-to-r ${config.color}
                  transition-all duration-500 ease-smooth-out
                `}
                style={{
                  width: progressWidth > 0 ? `${progressWidth}%` : '0%',
                  minWidth: progressWidth > 0 ? '8px' : '0',
                }}
              >
                {/* Shine effect on progress bar */}
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />

                {/* Pulse at the end of progress */}
                {progressWidth > 0 && progressWidth < 100 && (
                  <div className="absolute right-0 top-0 bottom-0 w-2 bg-white/50 rounded-full animate-pulse" />
                )}
              </div>

              {/* Indeterminate animation when no progress */}
              {isAnimating && progressWidth === 0 && (
                <div
                  className={`
                    absolute top-0 h-full w-1/4 rounded-full
                    bg-gradient-to-r ${config.color}
                  `}
                  style={{
                    animation: 'progressIndeterminate 1.5s ease-in-out infinite',
                  }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              )}
            </div>

            {/* Progress text */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-500 font-medium">
                {progressWidth > 0 ? 'Fortschritt' : 'Initialisiere...'}
              </span>
              <span
                className={`
                  font-mono font-semibold transition-colors duration-300
                  ${stage === 'complete' ? 'text-emerald-400' : 'text-dark-300'}
                `}
              >
                {progressWidth > 0 ? `${Math.round(progressWidth)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Audio waveform visualization */}
          {isAnimating && (
            <div className="mt-4 flex justify-center">
              <AudioWaveform isAnimating={isAnimating} />
            </div>
          )}

          {/* Cancel button */}
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => window.api.whisper.cancel()}
              className={`
                w-full px-4 py-2.5 rounded-xl text-sm font-medium
                bg-dark-800/60 text-dark-400
                border border-white/[0.06]
                hover:bg-dark-700/60 hover:text-dark-200 hover:border-white/[0.1]
                active:scale-[0.98]
                transition-all duration-200
                flex items-center justify-center gap-2
              `}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
