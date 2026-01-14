import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import type { AnimationType, SubtitlePosition, SubtitleStyle, FontWeight } from '../../../shared/types'
import { DEFAULT_SUBTITLE_STYLE } from '../../../shared/types'
import StyleProfileSelector from './StyleProfileSelector'
import FontSelector from './FontSelector'
import { getWeightOptions, getAvailableWeights } from '../../utils/fontLoader'

// Collapsible section component with smooth animations
interface CollapsibleSectionProps {
  title: string
  icon: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}

function CollapsibleSection({
  title,
  icon,
  defaultOpen = true,
  children
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className={isOpen ? 'overflow-visible' : 'overflow-hidden'}>
      {/* Section header */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg
          transition-all duration-200 ease-smooth group
          ${isOpen
            ? 'bg-white/[0.04] border border-white/[0.06]'
            : 'bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]'
          }
        `}
      >
        {/* Icon container */}
        <div
          className={`
            flex items-center justify-center w-7 h-7 rounded-lg
            transition-all duration-200
            ${isOpen
              ? 'bg-primary-500/15 text-primary-400'
              : 'bg-white/[0.06] text-dark-400 group-hover:bg-white/[0.08] group-hover:text-dark-300'
            }
          `}
        >
          {icon}
        </div>

        {/* Title */}
        <span
          className={`
            text-xs font-semibold tracking-wide uppercase flex-1 text-left
            transition-colors duration-200
            ${isOpen ? 'text-dark-200' : 'text-dark-400 group-hover:text-dark-300'}
          `}
        >
          {title}
        </span>

        {/* Chevron indicator */}
        <div
          className={`
            w-5 h-5 flex items-center justify-center
            transition-transform duration-300 ease-spring
            ${isOpen ? 'rotate-180' : 'rotate-0'}
          `}
        >
          <svg
            className={`
              w-4 h-4 transition-colors duration-200
              ${isOpen ? 'text-primary-400' : 'text-dark-500 group-hover:text-dark-400'}
            `}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Content with smooth height animation */}
      <div
        className={`
          transition-all duration-300 ease-smooth
          ${isOpen
            ? 'opacity-100 max-h-[1000px] mt-3'
            : 'opacity-0 max-h-0 mt-0 overflow-hidden'
          }
        `}
      >
        <div className="space-y-3 px-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Premium slider component - commits value only on release to avoid excessive auto-saves
interface PremiumSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

function PremiumSlider({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  onChange
}: PremiumSliderProps) {
  // Local state for smooth dragging without triggering auto-save
  const [localValue, setLocalValue] = useState(value)
  const isDragging = useRef(false)

  // Sync local value with prop when not dragging
  useEffect(() => {
    if (!isDragging.current) {
      setLocalValue(value)
    }
  }, [value])

  const percentage = ((localValue - min) / (max - min)) * 100

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseFloat(e.target.value)
    setLocalValue(newValue)
  }

  const handlePointerDown = () => {
    isDragging.current = true
  }

  const handlePointerUp = () => {
    isDragging.current = false
    // Commit the value to the store only when releasing
    if (localValue !== value) {
      onChange(localValue)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider">
          {label}
        </label>
        <span className="text-xs font-mono text-dark-300 bg-dark-800/60 px-2 py-0.5 rounded-md">
          {localValue}{unit}
        </span>
      </div>
      <div className="relative group">
        {/* Track background */}
        <div className="h-1.5 rounded-full bg-dark-800 overflow-hidden">
          {/* Active track with gradient */}
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-100"
            style={{ width: `${percentage}%` }}
          />
        </div>
        {/* Invisible range input for interaction */}
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={localValue}
          onChange={handleChange}
          onPointerDown={handlePointerDown}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
        {/* Thumb indicator */}
        <div
          className={`
            absolute top-1/2 -translate-y-1/2 -translate-x-1/2
            w-3.5 h-3.5 rounded-full
            bg-white shadow-md shadow-black/30
            border-2 border-primary-500
            transition-all duration-100
            group-hover:scale-110 group-active:scale-95
            pointer-events-none
          `}
          style={{ left: `${percentage}%` }}
        >
          {/* Inner dot */}
          <div className="absolute inset-1 rounded-full bg-primary-400" />
        </div>
      </div>
    </div>
  )
}

// Premium color picker component
interface PremiumColorPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  presets?: string[]
}

function PremiumColorPicker({
  label,
  value,
  onChange,
  presets = ['#FFFFFF', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
}: PremiumColorPickerProps) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider block">
        {label}
      </label>
      <div className="space-y-2">
        {/* Main color display and picker */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <div
              className={`
                relative h-9 rounded-lg overflow-hidden cursor-pointer
                border border-white/[0.08] hover:border-white/[0.12]
                transition-all duration-200
                ${isExpanded ? 'ring-2 ring-primary-500/30' : ''}
              `}
              onClick={() => setIsExpanded(!isExpanded)}
            >
              {/* Color preview with checkerboard for transparency */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #374151 25%, transparent 25%), linear-gradient(-45deg, #374151 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #374151 75%), linear-gradient(-45deg, transparent 75%, #374151 75%)',
                  backgroundSize: '8px 8px',
                  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px'
                }}
              />
              <div
                className="absolute inset-0 transition-colors duration-200"
                style={{ backgroundColor: value }}
              />
              {/* Subtle inner shadow for depth */}
              <div className="absolute inset-0 shadow-inner-soft" />
            </div>
            {/* Hidden native color input */}
            <input
              type="color"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          {/* Hex value display */}
          <div className="text-[10px] font-mono text-dark-400 bg-dark-800/60 px-2 py-1.5 rounded-md uppercase">
            {value}
          </div>
        </div>

        {/* Preset colors */}
        {isExpanded && (
          <div className="flex flex-wrap gap-1.5 p-2 rounded-lg bg-dark-800/40 border border-white/[0.04] animate-fade-in-scale">
            {presets.map((preset) => (
              <button
                key={preset}
                onClick={() => {
                  onChange(preset)
                  setIsExpanded(false)
                }}
                className={`
                  w-6 h-6 rounded-md transition-all duration-150
                  hover:scale-110 active:scale-95
                  border-2
                  ${value === preset ? 'border-white shadow-glow-blue' : 'border-transparent hover:border-white/30'}
                `}
                style={{ backgroundColor: preset }}
                title={preset}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Premium select component
interface PremiumSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function PremiumSelect({ label, value, options, onChange }: PremiumSelectProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider block">
        {label}
      </label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`
            w-full h-9 px-3 pr-8 rounded-lg text-sm
            bg-dark-800/60 text-dark-200
            border border-white/[0.08] hover:border-white/[0.12]
            focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40
            transition-all duration-200 cursor-pointer
            appearance-none
          `}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-dark-800">
              {option.label}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  )
}

// Premium button group component
interface PremiumButtonGroupProps {
  label: string
  value: string
  options: { value: string; label: string; icon?: React.ReactNode }[]
  onChange: (value: string) => void
  columns?: number
}

function PremiumButtonGroup({
  label,
  value,
  options,
  onChange,
  columns = 3
}: PremiumButtonGroupProps) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider block">
        {label}
      </label>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={`
                relative px-2.5 py-2 rounded-lg text-xs font-medium
                transition-all duration-200 ease-spring
                ${
                  isActive
                    ? 'bg-primary-600 text-white shadow-md shadow-primary-500/25'
                    : 'bg-dark-800/60 text-dark-400 hover:bg-dark-700/60 hover:text-dark-200 border border-white/[0.04] hover:border-white/[0.08]'
                }
                active:scale-95
              `}
            >
              {/* Active indicator glow */}
              {isActive && (
                <div className="absolute inset-0 rounded-lg bg-primary-500/20 animate-pulse-soft" />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                {option.icon}
                {option.label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Icons for sections
const FontIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
)

const ColorIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
  </svg>
)

const PositionIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
  </svg>
)

const AnimationIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
  </svg>
)

const EffectsIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
)

// AI Analysis Button Component
function AIAnalysisButton() {
  const { project } = useProjectStore()
  const { isAnalyzing, setIsAnalyzing, setAnalysisProgress, setPendingChanges, setShowDiffPreview } = useUIStore()

  const handleStartAnalysis = async () => {
    if (!project || project.subtitles.length === 0) return

    setIsAnalyzing(true)
    setAnalysisProgress({ stage: 'extracting', percent: 0, message: 'Starte Analyse...' })

    try {
      // API key is read from .env in the main process
      const result = await window.api.analysis.analyze({
        videoPath: project.videoPath,
        subtitles: project.subtitles,
        config: {
          apiKey: '', // Will be read from .env in main process
          model: 'google/gemini-3-flash-preview',
          language: 'de'
        }
      })

      setPendingChanges(result.changes)
      setIsAnalyzing(false)
      setAnalysisProgress(null)

      if (result.changes.length > 0) {
        setShowDiffPreview(true)
      }
    } catch (error) {
      console.error('Analysis failed:', error)
      setIsAnalyzing(false)
      setAnalysisProgress({
        stage: 'error',
        percent: 0,
        message: error instanceof Error ? error.message : 'Analyse fehlgeschlagen'
      })
    }
  }

  if (!project || project.subtitles.length === 0) return null

  return (
    <div className="pb-3 border-b border-white/[0.06]">
      <button
        onClick={handleStartAnalysis}
        disabled={isAnalyzing}
        className={`
          w-full px-4 py-3 rounded-xl text-sm font-medium
          bg-gradient-to-r from-violet-600 to-purple-500
          text-white shadow-lg shadow-violet-500/25
          hover:from-violet-500 hover:to-purple-400
          hover:shadow-xl hover:shadow-violet-500/30
          active:scale-[0.98]
          transition-all duration-200
          flex items-center justify-center gap-2
          disabled:opacity-50 disabled:cursor-not-allowed
        `}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        KI-Korrektur starten
      </button>
      <p className="text-[10px] text-dark-500 text-center mt-2">
        Gemini analysiert Audio und korrigiert Fehler
      </p>
    </div>
  )
}

export default function StyleEditor() {
  const { project, updateStyle } = useProjectStore()

  const handleUpdateStyle = useCallback(
    (updates: Parameters<typeof updateStyle>[0]) => {
      updateStyle(updates)
    },
    [updateStyle]
  )

  // Handle applying a profile's style to the current project
  const handleApplyProfile = useCallback(
    (profileStyle: SubtitleStyle) => {
      updateStyle({
        fontFamily: profileStyle.fontFamily,
        fontSize: profileStyle.fontSize,
        fontWeight: profileStyle.fontWeight,
        textTransform: profileStyle.textTransform,
        color: profileStyle.color,
        highlightColor: profileStyle.highlightColor,
        backgroundColor: profileStyle.backgroundColor,
        outlineColor: profileStyle.outlineColor,
        outlineWidth: profileStyle.outlineWidth,
        shadowColor: profileStyle.shadowColor,
        shadowBlur: profileStyle.shadowBlur,
        position: profileStyle.position,
        positionX: profileStyle.positionX,
        positionY: profileStyle.positionY,
        animation: profileStyle.animation,
        maxWidth: profileStyle.maxWidth,
        maxLines: profileStyle.maxLines,
        karaokeBoxEnabled: profileStyle.karaokeBoxEnabled,
        karaokeBoxColor: profileStyle.karaokeBoxColor,
        karaokeBoxPadding: profileStyle.karaokeBoxPadding,
        karaokeBoxBorderRadius: profileStyle.karaokeBoxBorderRadius
      })
    },
    [updateStyle]
  )

  if (!project) return null

  const { style } = project

  // Get available font weights for the current font family
  const weightOptions = useMemo(() => {
    const options = getWeightOptions(style.fontFamily)
    return options.map(opt => ({
      value: String(opt.value),
      label: opt.label
    }))
  }, [style.fontFamily])

  const positionOptions: { value: SubtitlePosition; label: string }[] = [
    { value: 'top', label: 'Oben' },
    { value: 'center', label: 'Mitte' },
    { value: 'bottom', label: 'Unten' }
  ]

  const animationOptions: { value: AnimationType; label: string }[] = [
    { value: 'karaoke', label: 'Karaoke' },
    { value: 'appear', label: 'Erscheinen' },
    { value: 'fade', label: 'Einblenden' },
    { value: 'scale', label: 'Skalieren' },
    { value: 'none', label: 'Keine' }
  ]

  return (
    <div className="p-4 space-y-4 animate-fade-in">
      {/* Header with elegant styling */}
      <div className="flex items-center gap-3 pb-3 border-b border-white/[0.06]">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500/20 to-primary-600/10 flex items-center justify-center">
          <svg className="w-4 h-4 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
          </svg>
        </div>
        <div>
          <h2 className="text-sm font-semibold text-dark-100">Stil bearbeiten</h2>
          <p className="text-[10px] text-dark-500 mt-0.5">Anpassen der Untertitel-Darstellung</p>
        </div>
      </div>

      {/* Style Profile Selector */}
      <div className="pb-3 border-b border-white/[0.06]">
        <StyleProfileSelector
          currentStyle={style}
          onApplyProfile={handleApplyProfile}
        />
      </div>

      {/* AI Analysis Button */}
      <AIAnalysisButton />

      {/* Collapsible sections */}
      <div className="space-y-3">
        {/* Typography Section */}
        <CollapsibleSection title="Typografie" icon={<FontIcon />} defaultOpen={true}>
          <FontSelector
            value={style.fontFamily}
            onChange={(value) => {
              // Get available weights for the new font
              const availableWeights = getAvailableWeights(value)
              // Get current weight as number
              const currentWeight = typeof style.fontWeight === 'number'
                ? style.fontWeight
                : style.fontWeight === 'bold' ? 700 : 400

              // Check if current weight is available in new font
              const updates: Partial<SubtitleStyle> = { fontFamily: value }
              if (!availableWeights.includes(currentWeight)) {
                // Find closest available weight
                const closestWeight = availableWeights.reduce((prev, curr) =>
                  Math.abs(curr - currentWeight) < Math.abs(prev - currentWeight) ? curr : prev
                )
                updates.fontWeight = closestWeight as FontWeight
              }

              handleUpdateStyle(updates)
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <PremiumSlider
              label="Größe"
              value={style.fontSize}
              min={24}
              max={144}
              unit="px"
              onChange={(value) => handleUpdateStyle({ fontSize: value })}
            />

            <PremiumSelect
              label="Gewicht"
              value={String(style.fontWeight)}
              options={weightOptions}
              onChange={(value) =>
                handleUpdateStyle({ fontWeight: parseInt(value, 10) as FontWeight })
              }
            />
          </div>

          {/* Uppercase Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider">
              Versalien (Großbuchstaben)
            </label>
            <button
              onClick={() => handleUpdateStyle({ textTransform: style.textTransform === 'uppercase' ? 'none' : 'uppercase' })}
              className={`
                relative w-10 h-5 rounded-full transition-all duration-200
                ${style.textTransform === 'uppercase'
                  ? 'bg-primary-600'
                  : 'bg-dark-700 border border-white/[0.08]'
                }
              `}
            >
              <div
                className={`
                  absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md
                  transition-all duration-200 ease-spring
                  ${style.textTransform === 'uppercase' ? 'left-5' : 'left-0.5'}
                `}
              />
            </button>
          </div>
        </CollapsibleSection>

        {/* Colors Section */}
        <CollapsibleSection title="Farben" icon={<ColorIcon />} defaultOpen={true}>
          <div className="grid grid-cols-2 gap-3">
            <PremiumColorPicker
              label="Textfarbe"
              value={style.color}
              onChange={(value) => handleUpdateStyle({ color: value })}
              presets={['#FFFFFF', '#F8F8F8', '#E8E8E8', '#D0D0D0', '#A0A0A0', '#808080', '#404040', '#000000']}
            />

            <PremiumColorPicker
              label="Highlight"
              value={style.highlightColor}
              onChange={(value) => handleUpdateStyle({ highlightColor: value })}
              presets={['#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#FF8C00']}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <PremiumColorPicker
              label="Umrissfarbe"
              value={style.outlineColor}
              onChange={(value) => handleUpdateStyle({ outlineColor: value })}
              presets={['#000000', '#1A1A1A', '#333333', '#4A4A4A', '#666666', '#0A0A0A', '#2D2D2D', '#1F1F1F']}
            />

            <PremiumSlider
              label="Umriss-Breite"
              value={style.outlineWidth}
              min={0}
              max={50}
              step={1}
              unit="px"
              onChange={(value) => handleUpdateStyle({ outlineWidth: value })}
            />
          </div>
        </CollapsibleSection>

        {/* Position Section */}
        <CollapsibleSection title="Position" icon={<PositionIcon />} defaultOpen={false}>
          <PremiumButtonGroup
            label="Vertikale Position"
            value={style.position}
            options={positionOptions}
            onChange={(value) => handleUpdateStyle({ position: value as SubtitlePosition })}
            columns={3}
          />

          {/* Max Width Slider for text box */}
          <PremiumSlider
            label="Maximale Breite"
            value={Math.round((style.maxWidth ?? 0.85) * 100)}
            min={50}
            max={100}
            step={5}
            unit="%"
            onChange={(value) => handleUpdateStyle({ maxWidth: value / 100 })}
          />

          {/* Visual position preview */}
          <div className="mt-2 p-3 rounded-lg bg-dark-900/40 border border-white/[0.04]">
            <div className="relative aspect-[9/16] max-h-32 mx-auto bg-dark-800/50 rounded-md overflow-hidden">
              {/* Video placeholder lines */}
              <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-2 opacity-20">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-1 bg-dark-600 rounded-full" style={{ width: `${60 + Math.random() * 30}%` }} />
                ))}
              </div>

              {/* Position indicator */}
              <div
                className={`
                  absolute left-1/2 -translate-x-1/2
                  h-3 bg-primary-500/60 rounded-sm
                  transition-all duration-300 ease-spring
                  shadow-glow-blue
                `}
                style={{
                  width: `${(style.maxWidth ?? 0.85) * 100}%`,
                  top: style.position === 'top' ? '12%' : style.position === 'center' ? '50%' : '85%',
                  transform: `translate(-50%, ${style.position === 'center' ? '-50%' : '0'})`
                }}
              >
                <div className="absolute inset-0 bg-white/30 rounded-sm animate-pulse-soft" />
              </div>
            </div>
            <p className="text-[9px] text-dark-500 text-center mt-2">
              Vorschau der Textbox-Breite und Position
            </p>
          </div>
        </CollapsibleSection>

        {/* Animation Section */}
        <CollapsibleSection title="Animation" icon={<AnimationIcon />} defaultOpen={false}>
          <PremiumButtonGroup
            label="Animationstyp"
            value={style.animation}
            options={animationOptions}
            onChange={(value) => handleUpdateStyle({ animation: value as AnimationType })}
            columns={2}
          />

          {/* Animation preview description */}
          <div className="p-2.5 rounded-lg bg-dark-900/40 border border-white/[0.04]">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-md bg-primary-500/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <svg className="w-3 h-3 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-[10px] text-dark-400 leading-relaxed">
                {style.animation === 'karaoke' && 'Wörter werden einzeln hervorgehoben, während sie gesprochen werden.'}
                {style.animation === 'appear' && 'Untertitel erscheinen sofort ohne Übergang.'}
                {style.animation === 'fade' && 'Sanftes Ein- und Ausblenden der Untertitel.'}
                {style.animation === 'scale' && 'Untertitel werden beim Erscheinen leicht vergrößert.'}
                {style.animation === 'none' && 'Keine Animation – Untertitel werden statisch angezeigt.'}
              </p>
            </div>
          </div>

          {/* Karaoke Box Settings - only shown when animation is karaoke */}
          {style.animation === 'karaoke' && (
            <div className="space-y-3 pt-2 border-t border-white/[0.06]">
              {/* Karaoke Box Toggle */}
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider">
                  Karaoke-Box
                </label>
                <button
                  onClick={() => handleUpdateStyle({ karaokeBoxEnabled: !style.karaokeBoxEnabled })}
                  className={`
                    relative w-10 h-5 rounded-full transition-all duration-200
                    ${style.karaokeBoxEnabled
                      ? 'bg-primary-600'
                      : 'bg-dark-700 border border-white/[0.08]'
                    }
                  `}
                >
                  <div
                    className={`
                      absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-md
                      transition-all duration-200 ease-spring
                      ${style.karaokeBoxEnabled ? 'left-5' : 'left-0.5'}
                    `}
                  />
                </button>
              </div>

              {/* Karaoke Box Settings - only shown when enabled */}
              {style.karaokeBoxEnabled && (
                <div className="space-y-3 animate-fade-in">
                  <PremiumColorPicker
                    label="Box-Farbe"
                    value={style.karaokeBoxColor}
                    onChange={(value) => handleUpdateStyle({ karaokeBoxColor: value })}
                    presets={['#32CD32', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#FF8C00', '#9B59B6', '#E74C3C']}
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <PremiumSlider
                      label="Innenabstand"
                      value={style.karaokeBoxPadding}
                      min={0}
                      max={100}
                      step={1}
                      unit="px"
                      onChange={(value) => handleUpdateStyle({ karaokeBoxPadding: value })}
                    />

                    <PremiumSlider
                      label="Ecken-Radius"
                      value={style.karaokeBoxBorderRadius}
                      min={0}
                      max={300}
                      step={1}
                      unit="px"
                      onChange={(value) => handleUpdateStyle({ karaokeBoxBorderRadius: value })}
                    />
                  </div>

                  {/* Karaoke Box Preview */}
                  <div className="p-3 rounded-lg bg-dark-900/40 border border-white/[0.04]">
                    <div className="flex items-center justify-center py-3">
                      <span className="text-sm text-dark-400 mr-1">Beispiel</span>
                      <span
                        className="text-sm font-bold px-1"
                        style={{
                          color: style.highlightColor,
                          backgroundColor: style.karaokeBoxColor,
                          padding: `${Math.max(2, style.karaokeBoxPadding / 2)}px ${style.karaokeBoxPadding}px`,
                          borderRadius: `${style.karaokeBoxBorderRadius}px`
                        }}
                      >
                        Wort
                      </span>
                      <span className="text-sm text-dark-400 ml-1">Text</span>
                    </div>
                    <p className="text-[9px] text-dark-500 text-center">
                      Vorschau der Karaoke-Box
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Effects Section */}
        <CollapsibleSection title="Effekte" icon={<EffectsIcon />} defaultOpen={false}>
          <PremiumSlider
            label="Schatten-Stärke"
            value={style.shadowBlur}
            min={0}
            max={100}
            step={1}
            unit="px"
            onChange={(value) => handleUpdateStyle({ shadowBlur: value })}
          />

          {/* Shadow preview */}
          <div className="p-3 rounded-lg bg-dark-900/40 border border-white/[0.04]">
            <div className="flex items-center justify-center py-4">
              <span
                className="text-lg font-bold transition-all duration-200"
                style={{
                  color: style.color,
                  textShadow: `0 0 ${style.shadowBlur}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}`,
                  WebkitTextStroke: `${style.outlineWidth}px ${style.outlineColor}`
                }}
              >
                Beispieltext
              </span>
            </div>
            <p className="text-[9px] text-dark-500 text-center">
              Live-Vorschau des Schattens
            </p>
          </div>
        </CollapsibleSection>
      </div>

      {/* Reset button at bottom */}
      <div className="pt-3 border-t border-white/[0.06]">
        <button
          onClick={() => {
            // Reset to defaults using the centralized DEFAULT_SUBTITLE_STYLE
            handleUpdateStyle({
              fontFamily: DEFAULT_SUBTITLE_STYLE.fontFamily,
              fontSize: DEFAULT_SUBTITLE_STYLE.fontSize,
              fontWeight: DEFAULT_SUBTITLE_STYLE.fontWeight,
              textTransform: DEFAULT_SUBTITLE_STYLE.textTransform,
              color: DEFAULT_SUBTITLE_STYLE.color,
              highlightColor: DEFAULT_SUBTITLE_STYLE.highlightColor,
              backgroundColor: DEFAULT_SUBTITLE_STYLE.backgroundColor,
              outlineColor: DEFAULT_SUBTITLE_STYLE.outlineColor,
              outlineWidth: DEFAULT_SUBTITLE_STYLE.outlineWidth,
              shadowColor: DEFAULT_SUBTITLE_STYLE.shadowColor,
              shadowBlur: DEFAULT_SUBTITLE_STYLE.shadowBlur,
              position: DEFAULT_SUBTITLE_STYLE.position,
              positionX: DEFAULT_SUBTITLE_STYLE.positionX,
              positionY: DEFAULT_SUBTITLE_STYLE.positionY,
              animation: DEFAULT_SUBTITLE_STYLE.animation,
              maxWidth: DEFAULT_SUBTITLE_STYLE.maxWidth,
              maxLines: DEFAULT_SUBTITLE_STYLE.maxLines,
              // Karaoke box properties
              karaokeBoxEnabled: DEFAULT_SUBTITLE_STYLE.karaokeBoxEnabled,
              karaokeBoxColor: DEFAULT_SUBTITLE_STYLE.karaokeBoxColor,
              karaokeBoxPadding: DEFAULT_SUBTITLE_STYLE.karaokeBoxPadding,
              karaokeBoxBorderRadius: DEFAULT_SUBTITLE_STYLE.karaokeBoxBorderRadius
            })
          }}
          className={`
            w-full px-3 py-2 rounded-lg text-xs font-medium
            bg-dark-800/40 text-dark-400
            border border-white/[0.04]
            hover:bg-dark-700/40 hover:text-dark-300 hover:border-white/[0.08]
            active:scale-[0.98]
            transition-all duration-200
            flex items-center justify-center gap-2
          `}
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Auf Standard zurücksetzen
        </button>
      </div>
    </div>
  )
}
