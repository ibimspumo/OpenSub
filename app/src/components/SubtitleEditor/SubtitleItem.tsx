import { useState, useCallback, useRef, useEffect, memo } from 'react'
import { useTranslation } from 'react-i18next'
import { Pencil, Trash2 } from 'lucide-react'
import { useProjectStore } from '@/store/projectStore'
import { cn } from '@/lib/utils'
import type { Subtitle } from '@/lib/types'

interface SubtitleItemProps {
  subtitle: Subtitle
  isSelected: boolean
  isActive: boolean
  onSelect: () => void
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(1)
  return `${mins}:${secs.padStart(4, '0')}`
}

/**
 * Compact transcript row. The current line follows playback (isActive),
 * double-click edits inline (Enter commits, Esc cancels), hover reveals actions.
 */
function SubtitleItem({ subtitle, isSelected, isActive, onSelect }: SubtitleItemProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [editText, setEditText] = useState(subtitle.text)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const { updateSubtitleText, deleteSubtitle } = useProjectStore()

  useEffect(() => {
    if (!isEditing) {
      setEditText(subtitle.text)
    }
  }, [subtitle.text, isEditing])

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus()
      textareaRef.current.select()
      // Grow to fit content
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`
    }
  }, [isEditing])

  const handleSave = useCallback(() => {
    const trimmed = editText.trim()
    if (trimmed && trimmed !== subtitle.text) {
      updateSubtitleText(subtitle.id, trimmed)
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

  // Words below this confidence get a subtle warning marker
  const lowConfidence =
    subtitle.words.length > 0 &&
    subtitle.words.reduce((acc, word) => acc + word.confidence, 0) / subtitle.words.length < 0.6

  return (
    <div
      data-subtitle-id={subtitle.id}
      className={cn(
        'group relative rounded-lg px-2.5 py-2 cursor-pointer',
        'transition-colors duration-150',
        isSelected
          ? 'bg-white/[0.06]'
          : isActive
            ? 'bg-white/[0.035]'
            : 'hover:bg-white/[0.03]'
      )}
      onClick={onSelect}
      onDoubleClick={(e) => {
        e.stopPropagation()
        setIsEditing(true)
      }}
    >
      {/* Active playback indicator */}
      <div
        className={cn(
          'absolute left-0 top-1.5 bottom-1.5 w-[2.5px] rounded-full transition-all duration-200',
          isActive ? 'bg-primary opacity-100' : 'opacity-0 bg-primary/50'
        )}
      />

      {/* Meta row: time + warning + actions */}
      <div className="flex items-center gap-1.5 mb-0.5">
        <span
          className={cn(
            'text-[10px] font-mono tabular-nums transition-colors duration-150',
            isActive ? 'text-primary' : 'text-muted-foreground/70'
          )}
        >
          {formatTime(subtitle.startTime)}
        </span>
        {lowConfidence && (
          <span
            className="w-1 h-1 rounded-full bg-amber-400/80"
            title={t('subtitleItem.lowConfidence')}
          />
        )}

        {/* Hover actions */}
        <div
          className={cn(
            'ml-auto flex items-center gap-0.5',
            'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
            isEditing && 'hidden'
          )}
        >
          <button
            className="pressable w-5.5 h-5.5 p-1 rounded-md text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.08] transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            title={t('common.edit')}
          >
            <Pencil className="w-3 h-3" />
          </button>
          <button
            className="pressable w-5.5 h-5.5 p-1 rounded-md text-muted-foreground/70 hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={(e) => {
              e.stopPropagation()
              deleteSubtitle(subtitle.id)
            }}
            title={t('common.delete')}
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Text / inline editor */}
      {isEditing ? (
        <textarea
          ref={textareaRef}
          value={editText}
          onChange={(e) => {
            setEditText(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
          onKeyDown={handleKeyDown}
          onBlur={handleSave}
          onClick={(e) => e.stopPropagation()}
          className={cn(
            'w-full rounded-md px-1.5 py-1 -mx-1.5 text-[13px] leading-snug resize-none overflow-hidden',
            'bg-white/[0.05] text-foreground',
            'ring-1 ring-primary/50 focus:outline-none'
          )}
          rows={1}
        />
      ) : (
        <p
          className={cn(
            'text-[13px] leading-snug transition-colors duration-150',
            isActive || isSelected
              ? 'text-foreground'
              : 'text-foreground/65 group-hover:text-foreground/85'
          )}
        >
          {subtitle.text}
        </p>
      )}
    </div>
  )
}

export default memo(SubtitleItem)
