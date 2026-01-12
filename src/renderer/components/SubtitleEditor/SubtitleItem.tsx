import { useState, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import type { Subtitle, Speaker } from '../../../shared/types'

interface SubtitleItemProps {
  subtitle: Subtitle
  speaker?: Speaker
  isSelected: boolean
  onSelect: () => void
}

export default function SubtitleItem({
  subtitle,
  speaker,
  isSelected,
  onSelect
}: SubtitleItemProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(subtitle.text)

  const { updateSubtitleText, deleteSubtitle } = useProjectStore()

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(1)
    return `${mins}:${secs.padStart(4, '0')}`
  }

  const handleSave = useCallback(() => {
    updateSubtitleText(subtitle.id, editText)
    setIsEditing(false)
  }, [subtitle.id, editText, updateSubtitleText])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      setEditText(subtitle.text)
      setIsEditing(false)
    }
  }

  const handleDelete = useCallback(() => {
    if (confirm('Untertitel wirklich löschen?')) {
      deleteSubtitle(subtitle.id)
    }
  }, [subtitle.id, deleteSubtitle])

  return (
    <div
      className={`
        rounded-lg border transition-all cursor-pointer
        ${
          isSelected
            ? 'border-primary-500 bg-primary-500/10'
            : 'border-dark-700 hover:border-dark-600 bg-dark-800'
        }
      `}
      onClick={onSelect}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-dark-700">
        {/* Speaker Badge */}
        {speaker && (
          <span
            className="speaker-badge"
            style={{ backgroundColor: speaker.color + '30', color: speaker.color }}
          >
            {speaker.name}
          </span>
        )}

        {/* Time */}
        <span className="text-xs text-dark-400 font-mono">
          {formatTime(subtitle.startTime)} - {formatTime(subtitle.endTime)}
        </span>

        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          {!isEditing && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditing(true)
                }}
                className="p-1 hover:bg-dark-700 rounded text-dark-400 hover:text-white"
                title="Bearbeiten"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                className="p-1 hover:bg-red-500/20 rounded text-dark-400 hover:text-red-400"
                title="Löschen"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        {isEditing ? (
          <div className="space-y-2">
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-dark-700 rounded px-2 py-1 text-sm resize-none focus:ring-2 focus:ring-primary-500"
              rows={2}
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave()
                }}
                className="btn btn-primary text-xs py-1"
              >
                Speichern
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditText(subtitle.text)
                  setIsEditing(false)
                }}
                className="btn btn-ghost text-xs py-1"
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-dark-200 leading-relaxed">{subtitle.text}</p>
        )}
      </div>

      {/* Word Confidence Indicator */}
      {!isEditing && subtitle.words.length > 0 && (
        <div className="px-3 pb-2">
          <div className="flex gap-0.5">
            {subtitle.words.map((word, index) => {
              // Color based on confidence
              const confidence = word.confidence
              let bgColor = 'bg-green-500'
              if (confidence < 0.7) bgColor = 'bg-yellow-500'
              if (confidence < 0.5) bgColor = 'bg-red-500'

              return (
                <div
                  key={index}
                  className={`h-1 flex-1 rounded-full ${bgColor} opacity-50`}
                  title={`${word.text}: ${Math.round(confidence * 100)}% Konfidenz`}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
