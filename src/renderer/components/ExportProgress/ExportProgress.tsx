import { useMemo } from 'react'
import { useUIStore } from '../../store/uiStore'

// Export progress configuration
const EXPORT_CONFIG = {
  label: 'Video wird exportiert...',
  description: 'Untertitel werden in das Video eingebrannt',
  color: 'from-primary-500 to-cyan-400',
  bgGlow: 'rgba(59, 130, 246, 0.15)',
}

const COMPLETE_CONFIG = {
  label: 'Export abgeschlossen!',
  description: 'Video wurde erfolgreich exportiert',
  color: 'from-green-500 to-emerald-400',
  bgGlow: 'rgba(34, 197, 94, 0.2)',
}

// Film strip icon component with animation
function ExportIcon({ isAnimating }: { isAnimating: boolean }) {
  return (
    <svg
      className={`w-7 h-7 text-white transition-all duration-300`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={1.5}
        d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
      />
    </svg>
  )
}

// Animated film frames for visual interest
function FilmFrames({ isAnimating }: { isAnimating: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className={`
            w-2 h-3 rounded-sm bg-white/40
            transition-all duration-200
            ${isAnimating ? 'animate-pulse-soft' : ''}
          `}
          style={{
            animationDelay: `${i * 150}ms`,
            opacity: isAnimating ? 0.4 + Math.random() * 0.4 : 0.3,
          }}
        />
      ))}
    </div>
  )
}

export default function ExportProgress() {
  const { exportProgress } = useUIStore()

  const isComplete = exportProgress >= 100
  const isAnimating = !isComplete
  const config = isComplete ? COMPLETE_CONFIG : EXPORT_CONFIG

  // Memoize the progress bar width to prevent unnecessary re-renders
  const progressWidth = useMemo(() => {
    return Math.min(100, Math.max(0, exportProgress))
  }, [exportProgress])

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
                {isComplete ? (
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                ) : (
                  <ExportIcon isAnimating={isAnimating} />
                )}
              </div>

              {/* Spinning ring for loading state */}
              {isAnimating && (
                <div
                  className="absolute inset-[-4px] rounded-2xl border-2 border-white/20 border-t-white/60 animate-spin"
                  style={{ animationDuration: '2s' }}
                />
              )}
            </div>
          </div>

          {/* Title */}
          <h2
            className={`
              text-lg font-semibold text-center text-white mb-1
              transition-all duration-300
              ${isComplete ? 'text-emerald-300' : ''}
            `}
          >
            {config.label}
          </h2>

          {/* Description */}
          <p className="text-dark-400 text-center text-xs mb-5 transition-opacity duration-300">
            {config.description}
          </p>

          {/* Progress bar container */}
          <div className="space-y-2">
            {/* Progress bar */}
            <div className="relative h-2 bg-dark-800 rounded-full overflow-hidden">
              {/* Background shimmer effect when starting */}
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
                  ${isComplete ? 'text-emerald-400' : 'text-dark-300'}
                `}
              >
                {progressWidth > 0 ? `${Math.round(progressWidth)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Film frames visualization */}
          {isAnimating && (
            <div className="mt-4 flex justify-center">
              <FilmFrames isAnimating={isAnimating} />
            </div>
          )}

          {/* Cancel button */}
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <button
              onClick={() => window.api.ffmpeg.cancel()}
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
