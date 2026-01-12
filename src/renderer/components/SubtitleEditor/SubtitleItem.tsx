import { useState, useCallback, useRef, useEffect } from 'react'
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
  const [isHovered, setIsHovered] = useState(false)
  const [showActions, setShowActions] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { updateSubtitleText, deleteSubtitle } = useProjectStore()

  // Sync edit text when subtitle changes
  useEffect(() => {
    if (!isEditing) {
      setEditText(subtitle.text)
    }
  }, [subtitle.text, isEditing])

  // Auto-focus and select text when entering edit mode
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
    }
  }, [isEditing])

  // Delayed show/hide for actions with smooth appearance
  useEffect(() => {
    let timer: NodeJS.Timeout
    if (isHovered || isSelected) {
      timer = setTimeout(() => setShowActions(true), 50)
    } else {
      timer = setTimeout(() => setShowActions(false), 150)
    }
    return () => clearTimeout(timer)
  }, [isHovered, isSelected])

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(1)
    return `${mins}:${secs.padStart(4, '0')}`
  }

  // Calculate duration for display
  const duration = subtitle.endTime - subtitle.startTime

  const handleSave = useCallback(() => {
    if (editText.trim() !== subtitle.text) {
      updateSubtitleText(subtitle.id, editText.trim())
    }
    setIsEditing(false)
  }, [subtitle.id, subtitle.text, editText, updateSubtitleText])

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

  // Get confidence level for overall indicator
  const getOverallConfidence = () => {
    if (subtitle.words.length === 0) return 1
    const avgConfidence =
      subtitle.words.reduce((acc, word) => acc + word.confidence, 0) / subtitle.words.length
    return avgConfidence
  }

  const overallConfidence = getOverallConfidence()
  const confidenceColor =
    overallConfidence >= 0.8
      ? 'text-emerald-400'
      : overallConfidence >= 0.6
        ? 'text-yellow-400'
        : 'text-red-400'

  return (
    <div
      className={`
        group relative rounded-xl overflow-hidden cursor-pointer
        transition-all duration-200 ease-smooth
        ${
          isSelected
            ? 'bg-gradient-to-br from-primary-500/15 via-primary-500/10 to-primary-600/5 shadow-glow-blue ring-1 ring-primary-500/40'
            : 'bg-gradient-to-br from-dark-800/90 to-dark-800/70 hover:from-dark-700/90 hover:to-dark-800/80'
        }
        ${!isSelected && 'hover:shadow-dark-md hover:ring-1 hover:ring-white/[0.08]'}
        border border-white/[0.06]
        ${isSelected && 'border-primary-500/30'}
      `}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle gradient overlay for premium feel */}
      <div
        className={`
          absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent
          opacity-0 group-hover:opacity-100 transition-opacity duration-300
          pointer-events-none
        `}
      />

      {/* Selection indicator line */}
      <div
        className={`
          absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl
          transition-all duration-200 ease-smooth
          ${isSelected ? 'bg-primary-500 shadow-glow-blue' : 'bg-transparent'}
        `}
      />

      {/* Header */}
      <div
        className={`
          flex items-center gap-2 px-3 py-2
          border-b transition-colors duration-200
          ${isSelected ? 'border-primary-500/20' : 'border-white/[0.04]'}
        `}
      >
        {/* Speaker Badge with enhanced styling */}
        {speaker && (
          <span
            className={`
              speaker-badge px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider
              transition-all duration-200 ease-smooth
              ${isSelected ? 'scale-105' : 'group-hover:scale-105'}
            `}
            style={{
              backgroundColor: speaker.color + '20',
              color: speaker.color,
              boxShadow: isSelected ? `0 0 12px ${speaker.color}30` : 'none'
            }}
          >
            {speaker.name}
          </span>
        )}

        {/* Time with premium styling */}
        <div className="flex items-center gap-1.5">
          <span
            className={`
              text-[11px] font-mono tracking-tight
              transition-colors duration-200
              ${isSelected ? 'text-primary-300' : 'text-dark-400 group-hover:text-dark-300'}
            `}
          >
            {formatTime(subtitle.startTime)}
          </span>
          <span className="text-dark-600">→</span>
          <span
            className={`
              text-[11px] font-mono tracking-tight
              transition-colors duration-200
              ${isSelected ? 'text-primary-300' : 'text-dark-400 group-hover:text-dark-300'}
            `}
          >
            {formatTime(subtitle.endTime)}
          </span>
        </div>

        {/* Duration badge */}
        <span
          className={`
            text-[9px] font-medium px-1.5 py-0.5 rounded-md
            transition-all duration-200
            ${isSelected ? 'bg-primary-500/20 text-primary-300' : 'bg-dark-700/50 text-dark-500 group-hover:bg-dark-700 group-hover:text-dark-400'}
          `}
        >
          {duration.toFixed(1)}s
        </span>

        {/* Confidence indicator dot */}
        {subtitle.words.length > 0 && (
          <div
            className={`
              w-1.5 h-1.5 rounded-full transition-all duration-200
              ${confidenceColor.replace('text-', 'bg-')}
              ${isSelected ? 'scale-125 animate-pulse-soft' : 'opacity-60 group-hover:opacity-100'}
            `}
            title={`${Math.round(overallConfidence * 100)}% Konfidenz`}
          />
        )}

        {/* Actions with smooth fade */}
        <div
          className={`
            ml-auto flex items-center gap-0.5
            transition-all duration-200 ease-smooth
            ${showActions && !isEditing ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-2 pointer-events-none'}
          `}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            className={`
              p-1.5 rounded-lg transition-all duration-150 ease-smooth
              text-dark-400 hover:text-white
              hover:bg-white/[0.08] active:scale-95
            `}
            title="Bearbeiten"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
            className={`
              p-1.5 rounded-lg transition-all duration-150 ease-smooth
              text-dark-400 hover:text-red-400
              hover:bg-red-500/10 active:scale-95
            `}
            title="Löschen"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="px-3 py-2.5">
        {isEditing ? (
          <div
            className="space-y-2.5 animate-fade-in-scale"
            onClick={(e) => e.stopPropagation()}
          >
            <textarea
              ref={textareaRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={handleKeyDown}
              className={`
                w-full rounded-lg px-3 py-2 text-sm resize-none
                bg-dark-900/60 border border-white/[0.08]
                placeholder-dark-500 text-dark-100
                focus:outline-none focus:ring-2 focus:ring-primary-500/50 focus:border-primary-500/30
                transition-all duration-200
              `}
              rows={2}
              placeholder="Untertiteltext eingeben..."
            />
            <div className="flex gap-2">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave()
                }}
                className={`
                  flex-1 px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-primary-600 text-white
                  hover:bg-primary-500 active:scale-[0.98]
                  transition-all duration-150 ease-spring
                  shadow-sm hover:shadow-glow-blue
                `}
              >
                <span className="flex items-center justify-center gap-1.5">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Speichern
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setEditText(subtitle.text)
                  setIsEditing(false)
                }}
                className={`
                  px-3 py-1.5 rounded-lg text-xs font-medium
                  bg-dark-700/50 text-dark-300 border border-white/[0.06]
                  hover:bg-dark-700 hover:text-white active:scale-[0.98]
                  transition-all duration-150 ease-smooth
                `}
              >
                Abbrechen
              </button>
            </div>
          </div>
        ) : (
          <p
            className={`
              text-sm leading-relaxed transition-colors duration-200
              ${isSelected ? 'text-dark-100' : 'text-dark-300 group-hover:text-dark-200'}
            `}
          >
            {subtitle.text}
          </p>
        )}
      </div>

      {/* Word Confidence Indicator - Enhanced visualization */}
      {!isEditing && subtitle.words.length > 0 && (
        <div className="px-3 pb-2.5">
          <div
            className={`
              flex gap-[2px] h-1 rounded-full overflow-hidden
              bg-dark-900/40
              transition-opacity duration-200
              ${isHovered || isSelected ? 'opacity-100' : 'opacity-50'}
            `}
          >
            {subtitle.words.map((word, index) => {
              const confidence = word.confidence
              const bgColor =
                confidence >= 0.8
                  ? 'bg-emerald-500'
                  : confidence >= 0.6
                    ? 'bg-yellow-500'
                    : 'bg-red-500'

              return (
                <div
                  key={index}
                  className={`
                    flex-1 rounded-full ${bgColor}
                    transition-all duration-200
                    ${isHovered || isSelected ? 'opacity-70' : 'opacity-40'}
                    hover:opacity-100 hover:scale-y-150
                  `}
                  style={{
                    transitionDelay: `${index * 10}ms`
                  }}
                  title={`"${word.text}": ${Math.round(confidence * 100)}% Konfidenz`}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* Hover glow effect - subtle radial gradient */}
      <div
        className={`
          absolute inset-0 rounded-xl pointer-events-none
          transition-opacity duration-300
          ${isHovered && !isSelected ? 'opacity-100' : 'opacity-0'}
        `}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)'
        }}
      />
    </div>
  )
}
