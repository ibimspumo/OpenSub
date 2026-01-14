import { useMemo } from 'react'
import type { SubtitleChange } from '../../../shared/types'
import { useUIStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import DiffItem from './DiffItem'

interface DiffPreviewProps {
  onClose: () => void
  onApply: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function DiffPreview({ onClose, onApply }: DiffPreviewProps) {
  const { pendingChanges, updateChangeStatus, acceptAllChanges, rejectAllChanges } = useUIStore()
  const { project, updateSubtitleText } = useProjectStore()

  const summary = useMemo(() => {
    const accepted = pendingChanges.filter(c => c.status === 'accepted').length
    const rejected = pendingChanges.filter(c => c.status === 'rejected').length
    const pending = pendingChanges.filter(c => c.status === 'pending').length

    return {
      total: pendingChanges.length,
      accepted,
      rejected,
      pending,
      spelling: pendingChanges.filter(c => c.changeType === 'spelling').length,
      grammar: pendingChanges.filter(c => c.changeType === 'grammar').length,
      context: pendingChanges.filter(c => c.changeType === 'context').length,
      name: pendingChanges.filter(c => c.changeType === 'name').length,
      punctuation: pendingChanges.filter(c => c.changeType === 'punctuation').length,
    }
  }, [pendingChanges])

  const handleApply = () => {
    // Apply accepted changes to subtitles
    const acceptedChanges = pendingChanges.filter(c => c.status === 'accepted')

    for (const change of acceptedChanges) {
      updateSubtitleText(change.subtitleId, change.correctedText)
    }

    onApply()
  }

  const getSubtitleTime = (subtitleId: string): number => {
    const subtitle = project?.subtitles.find(s => s.id === subtitleId)
    return subtitle?.startTime ?? 0
  }

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-4 animate-backdrop-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] glass-dark-heavy rounded-2xl shadow-elevated-lg overflow-hidden animate-modal-in flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">KI-Korrektur Vorschau</h2>
              <p className="text-xs text-dark-400">{summary.total} Änderungen gefunden</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/[0.08] transition-all duration-150"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Summary badges */}
        <div className="px-6 py-3 border-b border-white/[0.06] flex flex-wrap gap-2">
          {summary.spelling > 0 && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-blue-500/20 text-blue-300">
              {summary.spelling} Rechtschreibung
            </span>
          )}
          {summary.grammar > 0 && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-amber-500/20 text-amber-300">
              {summary.grammar} Grammatik
            </span>
          )}
          {summary.context > 0 && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-violet-500/20 text-violet-300">
              {summary.context} Kontext
            </span>
          )}
          {summary.name > 0 && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-emerald-500/20 text-emerald-300">
              {summary.name} Namen
            </span>
          )}
          {summary.punctuation > 0 && (
            <span className="px-2 py-1 rounded-md text-xs font-medium bg-rose-500/20 text-rose-300">
              {summary.punctuation} Zeichensetzung
            </span>
          )}
        </div>

        {/* Bulk actions */}
        <div className="px-6 py-3 border-b border-white/[0.06] flex gap-2">
          <button
            onClick={acceptAllChanges}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 transition-all duration-150"
          >
            Alle akzeptieren
          </button>
          <button
            onClick={rejectAllChanges}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600/20 text-red-300 border border-red-500/30 hover:bg-red-600/30 transition-all duration-150"
          >
            Alle ablehnen
          </button>
          <div className="flex-1" />
          <span className="text-xs text-dark-400 self-center">
            {summary.accepted} akzeptiert, {summary.rejected} abgelehnt
          </span>
        </div>

        {/* Changes list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3 scrollbar-thin">
          {pendingChanges.length === 0 ? (
            <div className="text-center py-12 text-dark-400">
              <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm">Keine Änderungen gefunden</p>
              <p className="text-xs mt-1">Die Transkription scheint korrekt zu sein</p>
            </div>
          ) : (
            pendingChanges.map((change) => (
              <DiffItem
                key={change.subtitleId}
                change={change}
                time={formatTime(getSubtitleTime(change.subtitleId))}
                onAccept={() => updateChangeStatus(change.subtitleId, 'accepted')}
                onReject={() => updateChangeStatus(change.subtitleId, 'rejected')}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.06] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-dark-800/60 text-dark-300 border border-white/[0.06] hover:bg-dark-700/60 hover:text-white transition-all duration-150"
          >
            Abbrechen
          </button>
          <button
            onClick={handleApply}
            disabled={summary.accepted === 0}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 ${
              summary.accepted > 0
                ? 'bg-primary-600 text-white hover:bg-primary-500 shadow-glow-blue'
                : 'bg-dark-700 text-dark-500 cursor-not-allowed'
            }`}
          >
            {summary.accepted > 0 ? `${summary.accepted} Änderungen übernehmen` : 'Keine Änderungen ausgewählt'}
          </button>
        </div>
      </div>
    </div>
  )
}
