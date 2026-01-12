import { useUIStore } from '../../store/uiStore'

export default function ExportProgress() {
  const { exportProgress } = useUIStore()

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
      <div className="bg-dark-900 rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          <div className="text-primary-400 animate-pulse">
            <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-semibold text-center mb-2">Video wird exportiert...</h2>

        {/* Subtitle */}
        <p className="text-dark-400 text-center text-sm mb-6">
          Untertitel werden in das Video eingebrannt
        </p>

        {/* Progress Bar */}
        <div className="relative h-3 bg-dark-700 rounded-full overflow-hidden mb-4">
          <div
            className="absolute left-0 top-0 h-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-300"
            style={{ width: `${exportProgress}%` }}
          />
        </div>

        {/* Percentage */}
        <p className="text-center text-lg font-medium">{Math.round(exportProgress)}%</p>

        {/* Cancel Button */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => window.api.ffmpeg.cancel()}
            className="btn btn-ghost text-sm"
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  )
}
