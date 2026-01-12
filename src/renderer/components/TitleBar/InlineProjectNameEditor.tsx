import { useState, useRef, useEffect, useCallback } from 'react'

interface InlineProjectNameEditorProps {
  name: string
  onSave: (newName: string) => void
  className?: string
}

/**
 * Inline editor component for project name.
 * Activated on double-click, with confirm icon and keyboard support.
 * Prevents window maximize on double-click when active.
 */
export default function InlineProjectNameEditor({
  name,
  onSave,
  className = ''
}: InlineProjectNameEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync edit value when name prop changes
  useEffect(() => {
    if (!isEditing) {
      setEditValue(name)
    }
  }, [name, isEditing])

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const handleSave = useCallback(() => {
    const trimmedValue = editValue.trim()
    if (trimmedValue && trimmedValue !== name) {
      onSave(trimmedValue)
    }
    setIsEditing(false)
  }, [editValue, name, onSave])

  const handleCancel = useCallback(() => {
    setEditValue(name)
    setIsEditing(false)
  }, [name])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        handleSave()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        handleCancel()
      }
    },
    [handleSave, handleCancel]
  )

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    // Prevent window maximize on double-click
    e.stopPropagation()
    setIsEditing(true)
  }, [])

  const handleBlur = useCallback(() => {
    // Save on blur (clicking outside)
    handleSave()
  }, [handleSave])

  if (isEditing) {
    return (
      <div
        className="flex items-center gap-1 no-drag"
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          className={`
            bg-dark-800 border border-primary-500/50 rounded px-2 py-0.5
            text-dark-200 text-sm font-medium
            focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30
            max-w-[200px]
            ${className}
          `}
          maxLength={50}
        />
        {/* Confirm button */}
        <button
          onMouseDown={(e) => {
            // Use mousedown to fire before blur
            e.preventDefault()
            handleSave()
          }}
          className="
            p-1 rounded
            text-primary-400 hover:text-primary-300
            hover:bg-primary-500/10
            transition-colors duration-150
          "
          title="Speichern (Enter)"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        </button>
      </div>
    )
  }

  return (
    <span
      onDoubleClick={handleDoubleClick}
      className={`
        text-dark-200 max-w-[200px] truncate cursor-pointer no-drag
        hover:text-dark-100 transition-colors duration-150
        ${className}
      `}
      title="Doppelklick zum Bearbeiten"
    >
      {name}
    </span>
  )
}
