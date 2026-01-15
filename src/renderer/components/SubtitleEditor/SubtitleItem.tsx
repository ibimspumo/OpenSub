import { useState, useCallback, useRef, useEffect } from 'react'
import { Pencil, Trash2, Check, ArrowRight } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Subtitle } from '../../../shared/types'

interface SubtitleItemProps {
  subtitle: Subtitle
  isSelected: boolean
  onSelect: () => void
}

export default function SubtitleItem({
  subtitle,
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
    if (confirm('Untertitel wirklich loeschen?')) {
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
      ? 'bg-emerald-500'
      : overallConfidence >= 0.6
        ? 'bg-yellow-500'
        : 'bg-red-500'

  return (
    <Card
      className={cn(
        'group relative cursor-pointer overflow-hidden',
        'transition-all duration-200 ease-smooth',
        isSelected
          ? 'bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-glow-blue ring-1 ring-primary/40 border-primary/30'
          : 'bg-gradient-to-br from-card to-card/70 hover:from-muted hover:to-card/80',
        !isSelected && 'hover:shadow-md hover:ring-1 hover:ring-border'
      )}
      onClick={onSelect}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Subtle gradient overlay for premium feel */}
      <div
        className={cn(
          'absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-300',
          'pointer-events-none'
        )}
      />

      {/* Selection indicator line */}
      <div
        className={cn(
          'absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl',
          'transition-all duration-200 ease-smooth',
          isSelected ? 'bg-primary shadow-glow-blue' : 'bg-transparent'
        )}
      />

      {/* Header */}
      <CardHeader
        className={cn(
          'flex flex-row items-center gap-2 px-3 py-2 space-y-0',
          'border-b transition-colors duration-200',
          isSelected ? 'border-primary/20' : 'border-border/50'
        )}
      >
        {/* Time with premium styling */}
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              'text-[11px] font-mono tracking-tight',
              'transition-colors duration-200',
              isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/70'
            )}
          >
            {formatTime(subtitle.startTime)}
          </span>
          <ArrowRight className="w-3 h-3 text-muted-foreground/50" />
          <span
            className={cn(
              'text-[11px] font-mono tracking-tight',
              'transition-colors duration-200',
              isSelected ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground/70'
            )}
          >
            {formatTime(subtitle.endTime)}
          </span>
        </div>

        {/* Duration badge */}
        <Badge
          variant="secondary"
          className={cn(
            'text-[9px] font-medium px-1.5 py-0.5 h-auto',
            'transition-all duration-200',
            isSelected && 'bg-primary/20 text-primary border-primary/30'
          )}
        >
          {duration.toFixed(1)}s
        </Badge>

        {/* Confidence indicator dot */}
        {subtitle.words.length > 0 && (
          <div
            className={cn(
              'w-1.5 h-1.5 rounded-full transition-all duration-200',
              confidenceColor,
              isSelected ? 'scale-125 animate-pulse-soft' : 'opacity-60 group-hover:opacity-100'
            )}
            title={`${Math.round(overallConfidence * 100)}% Konfidenz`}
          />
        )}

        {/* Actions with smooth fade */}
        <div
          className={cn(
            'ml-auto flex items-center gap-0.5',
            'transition-all duration-200 ease-smooth',
            showActions && !isEditing
              ? 'opacity-100 translate-x-0'
              : 'opacity-0 translate-x-2 pointer-events-none'
          )}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-foreground"
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            title="Bearbeiten"
          >
            <Pencil className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={(e) => {
              e.stopPropagation()
              handleDelete()
            }}
            title="Loeschen"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      {/* Content */}
      <CardContent className="px-3 py-2.5">
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
              className={cn(
                'w-full rounded-lg px-3 py-2 text-sm resize-none',
                'bg-background/60 border border-border',
                'placeholder:text-muted-foreground text-foreground',
                'focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/30',
                'transition-all duration-200'
              )}
              rows={2}
              placeholder="Untertiteltext eingeben..."
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                className="flex-1"
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave()
                }}
              >
                <Check className="w-3.5 h-3.5" />
                Speichern
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
                  setEditText(subtitle.text)
                  setIsEditing(false)
                }}
              >
                Abbrechen
              </Button>
            </div>
          </div>
        ) : (
          <p
            className={cn(
              'text-sm leading-relaxed transition-colors duration-200',
              isSelected ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground/80'
            )}
          >
            {subtitle.text}
          </p>
        )}
      </CardContent>

      {/* Word Confidence Indicator - Enhanced visualization */}
      {!isEditing && subtitle.words.length > 0 && (
        <div className="px-3 pb-2.5">
          <div
            className={cn(
              'flex gap-[2px] h-1 rounded-full overflow-hidden',
              'bg-muted/40',
              'transition-opacity duration-200',
              isHovered || isSelected ? 'opacity-100' : 'opacity-50'
            )}
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
                  className={cn(
                    'flex-1 rounded-full',
                    bgColor,
                    'transition-all duration-200',
                    isHovered || isSelected ? 'opacity-70' : 'opacity-40',
                    'hover:opacity-100 hover:scale-y-150'
                  )}
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
        className={cn(
          'absolute inset-0 rounded-xl pointer-events-none',
          'transition-opacity duration-300',
          isHovered && !isSelected ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(255,255,255,0.02) 0%, transparent 70%)'
        }}
      />
    </Card>
  )
}
