import { useMemo } from 'react'
import type { AnalysisProgress as Progress } from '../../../shared/types'

interface AnalysisProgressProps {
  progress: Progress | null
  onCancel: () => void
}

const STAGE_CONFIG = {
  extracting: {
    label: 'Audio extrahieren...',
    description: 'MP3 wird aus dem Video extrahiert',
    color: 'from-blue-500 to-cyan-400',
    bgGlow: 'rgba(59, 130, 246, 0.15)',
  },
  uploading: {
    label: 'Vorbereiten...',
    description: 'Daten werden an die KI gesendet',
    color: 'from-violet-500 to-purple-400',
    bgGlow: 'rgba(139, 92, 246, 0.15)',
  },
  analyzing: {
    label: 'KI analysiert...',
    description: 'Gemini vergleicht Audio mit Transkription',
    color: 'from-amber-500 to-orange-400',
    bgGlow: 'rgba(245, 158, 11, 0.15)',
  },
  comparing: {
    label: 'Vergleiche...',
    description: 'Änderungen werden ermittelt',
    color: 'from-emerald-500 to-teal-400',
    bgGlow: 'rgba(16, 185, 129, 0.15)',
  },
  complete: {
    label: 'Fertig!',
    description: 'Analyse abgeschlossen',
    color: 'from-green-500 to-emerald-400',
    bgGlow: 'rgba(34, 197, 94, 0.2)',
  },
  error: {
    label: 'Fehler',
    description: 'Ein Fehler ist aufgetreten',
    color: 'from-red-500 to-rose-400',
    bgGlow: 'rgba(239, 68, 68, 0.15)',
  },
} as const

function StageIcon({ stage, isAnimating }: { stage: Progress['stage']; isAnimating: boolean }) {
  const iconClass = `w-7 h-7 transition-all duration-300 text-white`

  const icons = {
    extracting: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
      </svg>
    ),
    uploading: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
      </svg>
    ),
    analyzing: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    comparing: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
    complete: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    error: (
      <svg className={iconClass} fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  }

  return icons[stage] || icons.analyzing
}

function SparkleAnimation() {
  return (
    <div className="flex items-center justify-center gap-1 h-4">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="w-1 h-1 rounded-full bg-white/60 animate-pulse"
          style={{ animationDelay: `${i * 200}ms` }}
        />
      ))}
    </div>
  )
}

export default function AnalysisProgress({ progress, onCancel }: AnalysisProgressProps) {
  const stage = progress?.stage || 'extracting'
  const config = STAGE_CONFIG[stage] || STAGE_CONFIG.extracting
  const isAnimating = stage !== 'complete' && stage !== 'error'
  const percent = progress?.percent ?? 0

  const progressWidth = useMemo(() => {
    if (!progress || percent === 0) return 0
    return Math.min(100, Math.max(0, percent))
  }, [progress, percent])

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-backdrop-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        style={{
          background: `
            radial-gradient(circle at 50% 30%, ${config.bgGlow} 0%, transparent 50%),
            rgba(0, 0, 0, 0.75)
          `,
        }}
      />

      {/* Modal */}
      <div className="relative w-full max-w-sm glass-dark-heavy rounded-2xl shadow-elevated-lg overflow-hidden animate-modal-in">
        {/* Animated border */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden">
          <div
            className={`absolute inset-[-2px] rounded-2xl opacity-50 bg-gradient-to-br ${config.color} ${isAnimating ? 'animate-spin-slow' : ''}`}
            style={{
              background: `conic-gradient(from 0deg, transparent, ${config.bgGlow}, transparent)`,
              animationDuration: '8s',
            }}
          />
        </div>

        {/* Content */}
        <div className="relative bg-dark-900/95 rounded-2xl m-[1px] p-6">
          {/* Icon */}
          <div className="flex justify-center mb-5">
            <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br ${config.color} shadow-lg transition-all duration-500 ${isAnimating ? 'animate-breathe' : 'animate-spring-scale'}`}>
              <div className={`absolute inset-0 rounded-2xl opacity-40 bg-gradient-to-br ${config.color} blur-xl ${isAnimating ? 'animate-pulse-soft' : ''}`} />
              <div className="relative z-10">
                <StageIcon stage={stage} isAnimating={isAnimating} />
              </div>
              {isAnimating && (
                <div className="absolute inset-[-4px] rounded-2xl border-2 border-white/20 border-t-white/60 animate-spin" style={{ animationDuration: '2s' }} />
              )}
            </div>
          </div>

          {/* Title */}
          <h2 className={`text-lg font-semibold text-center text-white mb-1 transition-all duration-300 ${stage === 'complete' ? 'text-emerald-300' : ''} ${stage === 'error' ? 'text-red-300' : ''}`}>
            {config.label}
          </h2>

          {/* Description */}
          <p className="text-dark-400 text-center text-xs mb-5">
            {progress?.message || config.description}
          </p>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="relative h-2 bg-dark-800 rounded-full overflow-hidden">
              {isAnimating && progressWidth === 0 && (
                <div className="absolute inset-0 animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
              )}
              <div
                className={`absolute left-0 top-0 h-full rounded-full bg-gradient-to-r ${config.color} transition-all duration-500 ease-smooth-out`}
                style={{
                  width: progressWidth > 0 ? `${progressWidth}%` : '0%',
                  minWidth: progressWidth > 0 ? '8px' : '0',
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
              </div>
              {isAnimating && progressWidth === 0 && (
                <div
                  className={`absolute top-0 h-full w-1/4 rounded-full bg-gradient-to-r ${config.color}`}
                  style={{ animation: 'progressIndeterminate 1.5s ease-in-out infinite' }}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-white/30 to-transparent rounded-full" />
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-dark-500 font-medium">
                {progressWidth > 0 ? 'Fortschritt' : 'Initialisiere...'}
              </span>
              <span className={`font-mono font-semibold transition-colors duration-300 ${stage === 'complete' ? 'text-emerald-400' : 'text-dark-300'}`}>
                {progressWidth > 0 ? `${Math.round(progressWidth)}%` : '—'}
              </span>
            </div>
          </div>

          {/* Animation */}
          {isAnimating && (
            <div className="mt-4 flex justify-center">
              <SparkleAnimation />
            </div>
          )}

          {/* Cancel button */}
          <div className="mt-5 pt-4 border-t border-white/[0.06]">
            <button
              onClick={onCancel}
              className="w-full px-4 py-2.5 rounded-xl text-sm font-medium bg-dark-800/60 text-dark-400 border border-white/[0.06] hover:bg-dark-700/60 hover:text-dark-200 hover:border-white/[0.1] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
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
