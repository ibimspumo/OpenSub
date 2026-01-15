import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import { parseColor } from 'react-aria-components'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import type { AnimationType, SubtitlePosition, SubtitleStyle, FontWeight } from '../../../shared/types'
import { DEFAULT_SUBTITLE_STYLE } from '../../../shared/types'
import StyleProfileSelector from './StyleProfileSelector'
import FontSelector from './FontSelector'
import { getWeightOptions, getAvailableWeights } from '../../utils/fontLoader'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import {
  ColorPicker,
  ColorArea,
  ColorSlider,
  ColorThumb,
  SliderTrack,
  ColorSwatch,
  ColorSwatchPicker,
  ColorSwatchPickerItem
} from '@/components/ui/color'
import { Input } from '@/components/ui/input'
import {
  ChevronDown,
  Type,
  Palette,
  Move,
  Play,
  Sparkles,
  RotateCcw,
  Lightbulb,
  Info
} from 'lucide-react'

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
      <Button
        variant="ghost"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2.5 h-auto rounded-lg transition-all duration-200 group justify-start',
          isOpen
            ? 'bg-white/[0.04] border border-white/[0.06] hover:bg-white/[0.06]'
            : 'bg-transparent border border-transparent hover:bg-white/[0.03] hover:border-white/[0.04]'
        )}
      >
        {/* Icon container */}
        <div
          className={cn(
            'flex items-center justify-center w-7 h-7 rounded-lg transition-all duration-200',
            isOpen
              ? 'bg-primary/15 text-primary'
              : 'bg-white/[0.06] text-muted-foreground group-hover:bg-white/[0.08] group-hover:text-foreground/70'
          )}
        >
          {icon}
        </div>

        {/* Title */}
        <span
          className={cn(
            'text-xs font-semibold tracking-wide uppercase flex-1 text-left transition-colors duration-200',
            isOpen ? 'text-foreground/80' : 'text-muted-foreground group-hover:text-foreground/70'
          )}
        >
          {title}
        </span>

        {/* Chevron indicator */}
        <ChevronDown
          className={cn(
            'h-4 w-4 transition-all duration-300',
            isOpen ? 'rotate-180 text-primary' : 'rotate-0 text-muted-foreground group-hover:text-foreground/70'
          )}
        />
      </Button>

      {/* Content with smooth height animation */}
      <div
        className={cn(
          'transition-all duration-300 ease-out',
          isOpen
            ? 'opacity-100 max-h-[1000px] mt-3'
            : 'opacity-0 max-h-0 mt-0 overflow-hidden'
        )}
      >
        <div className="space-y-3 px-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// Premium slider component using ShadCN Slider - commits value only on release
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

  const handleValueChange = (values: number[]) => {
    setLocalValue(values[0])
  }

  const handleValueCommit = (values: number[]) => {
    isDragging.current = false
    if (values[0] !== value) {
      onChange(values[0])
    }
  }

  const handlePointerDown = () => {
    isDragging.current = true
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </Label>
        <span className="text-xs font-mono text-foreground/70 bg-muted/60 px-2 py-0.5 rounded-md">
          {localValue}{unit}
        </span>
      </div>
      <Slider
        value={[localValue]}
        min={min}
        max={max}
        step={step}
        onValueChange={handleValueChange}
        onValueCommit={handleValueCommit}
        onPointerDown={handlePointerDown}
        className="w-full"
      />
    </div>
  )
}

// Premium color picker component with JollyUI ColorPicker
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
  // Ensure we have a valid hex color value, fallback to white if undefined/invalid
  const safeValue = useMemo(() => {
    if (!value || typeof value !== 'string') return '#FFFFFF'
    // Check if it's a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase()
    // Try to extract hex from rgba
    if (value.startsWith('rgba') || value.startsWith('rgb')) {
      const match = value.match(/\d+/g)
      if (match && match.length >= 3) {
        return '#' + match.slice(0, 3).map(n => parseInt(n).toString(16).padStart(2, '0')).join('').toUpperCase()
      }
    }
    return '#FFFFFF'
  }, [value])

  const [isOpen, setIsOpen] = useState(false)
  const [hexInput, setHexInput] = useState(safeValue)

  // Sync hex input when value changes externally
  useEffect(() => {
    setHexInput(safeValue)
  }, [safeValue])

  // Handle hex input change
  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setHexInput(newValue)
    // Only update if it's a valid hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue.toUpperCase())
    }
  }

  // Handle hex input blur - validate and fix
  const handleHexBlur = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      setHexInput(safeValue) // Reset to current valid value
    }
  }

  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
        {label}
      </Label>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-9 px-2 justify-start gap-2 border-input hover:border-ring bg-muted/60"
          >
            <div
              className="w-6 h-6 rounded-md border border-white/20 shadow-sm"
              style={{ backgroundColor: safeValue }}
            />
            <span className="text-xs font-mono text-muted-foreground uppercase flex-1 text-left">
              {safeValue}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start" sideOffset={8}>
          <ColorPicker
            value={parseColor(safeValue)}
            onChange={(color) => onChange(color.toString('hex').toUpperCase())}
          >
            <div className="flex flex-col gap-3 p-3">
              {/* Color Area with Hue Slider */}
              <div>
                <ColorArea
                  colorSpace="hsb"
                  xChannel="saturation"
                  yChannel="brightness"
                  className="h-[140px] w-[200px] rounded-t-md rounded-b-none border-b-0"
                >
                  <ColorThumb className="z-50" />
                </ColorArea>
                <ColorSlider colorSpace="hsb" channel="hue">
                  <SliderTrack className="rounded-t-none rounded-b-md border-t-0 w-[200px] h-6">
                    <ColorThumb className="top-1/2" />
                  </SliderTrack>
                </ColorSlider>
              </div>

              {/* Hex Input */}
              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  Hex
                </Label>
                <Input
                  value={hexInput}
                  onChange={handleHexChange}
                  onBlur={handleHexBlur}
                  className="h-8 font-mono text-xs uppercase bg-muted/60"
                  maxLength={7}
                />
              </div>

              {/* Preset Swatches */}
              <ColorSwatchPicker className="w-[200px] justify-between">
                {presets.map((preset) => (
                  <ColorSwatchPickerItem
                    key={preset}
                    color={preset}
                    className="size-6 rounded-md"
                  >
                    <ColorSwatch className="size-full rounded-md" />
                  </ColorSwatchPickerItem>
                ))}
              </ColorSwatchPicker>
            </div>
          </ColorPicker>
        </PopoverContent>
      </Popover>
    </div>
  )
}

// Premium select component using ShadCN Select
interface PremiumSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

function PremiumSelect({ label, value, options, onChange }: PremiumSelectProps) {
  return (
    <div className="space-y-2">
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
        {label}
      </Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-9 bg-muted/60 border-input hover:border-ring">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

// Premium button group component using ShadCN Button
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
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider block">
        {label}
      </Label>
      <div
        className="grid gap-1.5"
        style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
      >
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <Button
              key={option.value}
              variant={isActive ? 'default' : 'outline'}
              size="sm"
              onClick={() => onChange(option.value)}
              className={cn(
                'h-auto px-2.5 py-2 text-xs font-medium transition-all duration-200',
                isActive
                  ? 'shadow-md shadow-primary/25'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
                {option.icon}
                {option.label}
              </span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}

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
    <div className="pb-3 border-b border-border">
      <Button
        onClick={handleStartAnalysis}
        disabled={isAnalyzing}
        className="w-full h-auto px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-500 text-white shadow-lg shadow-violet-500/25 hover:from-violet-500 hover:to-purple-400 hover:shadow-xl hover:shadow-violet-500/30 active:scale-[0.98] transition-all duration-200"
      >
        <Lightbulb className="w-5 h-5" />
        KI-Korrektur starten
      </Button>
      <p className="text-[10px] text-muted-foreground text-center mt-2">
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
        upcomingColor: profileStyle.upcomingColor,
        backgroundColor: profileStyle.backgroundColor,
        outlineColor: profileStyle.outlineColor,
        outlineWidth: profileStyle.outlineWidth,
        shadowColor: profileStyle.shadowColor,
        shadowBlur: profileStyle.shadowBlur,
        shadowOffsetX: profileStyle.shadowOffsetX,
        shadowOffsetY: profileStyle.shadowOffsetY,
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
      <div className="flex items-center gap-3 pb-3 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-foreground">Stil bearbeiten</h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">Anpassen der Untertitel-Darstellung</p>
        </div>
      </div>

      {/* Style Profile Selector */}
      <div className="pb-3 border-b border-border">
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
        <CollapsibleSection title="Typografie" icon={<Type className="w-4 h-4" />} defaultOpen={true}>
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
              label="Groesse"
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
            <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Versalien (Grossbuchstaben)
            </Label>
            <Switch
              checked={style.textTransform === 'uppercase'}
              onCheckedChange={(checked) => handleUpdateStyle({ textTransform: checked ? 'uppercase' : 'none' })}
            />
          </div>
        </CollapsibleSection>

        {/* Colors Section */}
        <CollapsibleSection title="Farben" icon={<Palette className="w-4 h-4" />} defaultOpen={true}>
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

          {/* Upcoming color - only shown for karaoke animation */}
          {style.animation === 'karaoke' && (
            <PremiumColorPicker
              label="Kommende Woerter"
              value={style.upcomingColor}
              onChange={(value) => handleUpdateStyle({ upcomingColor: value })}
              presets={['#808080', '#A0A0A0', '#606060', '#505050', '#707070', '#909090', '#B0B0B0', '#404040']}
            />
          )}

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
        <CollapsibleSection title="Position" icon={<Move className="w-4 h-4" />} defaultOpen={false}>
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
          <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border">
            <div className="relative aspect-[9/16] max-h-32 mx-auto bg-muted/50 rounded-md overflow-hidden">
              {/* Video placeholder lines */}
              <div className="absolute inset-0 flex flex-col justify-center gap-1.5 p-2 opacity-20">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-1 bg-muted-foreground rounded-full" style={{ width: `${60 + Math.random() * 30}%` }} />
                ))}
              </div>

              {/* Position indicator */}
              <div
                className="absolute left-1/2 -translate-x-1/2 h-3 bg-primary/60 rounded-sm transition-all duration-300 shadow-lg shadow-primary/20"
                style={{
                  width: `${(style.maxWidth ?? 0.85) * 100}%`,
                  top: style.position === 'top' ? '12%' : style.position === 'center' ? '50%' : '85%',
                  transform: `translate(-50%, ${style.position === 'center' ? '-50%' : '0'})`
                }}
              >
                <div className="absolute inset-0 bg-white/30 rounded-sm animate-pulse" />
              </div>
            </div>
            <p className="text-[9px] text-muted-foreground text-center mt-2">
              Vorschau der Textbox-Breite und Position
            </p>
          </div>
        </CollapsibleSection>

        {/* Animation Section */}
        <CollapsibleSection title="Animation" icon={<Play className="w-4 h-4" />} defaultOpen={false}>
          <PremiumButtonGroup
            label="Animationstyp"
            value={style.animation}
            options={animationOptions}
            onChange={(value) => handleUpdateStyle({ animation: value as AnimationType })}
            columns={2}
          />

          {/* Animation preview description */}
          <div className="p-2.5 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-md bg-primary/15 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Info className="w-3 h-3 text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                {style.animation === 'karaoke' && 'Woerter werden einzeln hervorgehoben, waehrend sie gesprochen werden.'}
                {style.animation === 'appear' && 'Untertitel erscheinen sofort ohne Uebergang.'}
                {style.animation === 'fade' && 'Sanftes Ein- und Ausblenden der Untertitel.'}
                {style.animation === 'scale' && 'Untertitel werden beim Erscheinen leicht vergroessert.'}
                {style.animation === 'none' && 'Keine Animation - Untertitel werden statisch angezeigt.'}
              </p>
            </div>
          </div>

          {/* Karaoke Box Settings - only shown when animation is karaoke */}
          {style.animation === 'karaoke' && (
            <div className="space-y-3 pt-2 border-t border-border">
              {/* Karaoke Box Toggle */}
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Karaoke-Box
                </Label>
                <Switch
                  checked={style.karaokeBoxEnabled}
                  onCheckedChange={(checked) => handleUpdateStyle({ karaokeBoxEnabled: checked })}
                />
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
                  <div className="p-3 rounded-lg bg-muted/40 border border-border">
                    <div className="flex items-center justify-center py-3">
                      <span className="text-sm text-muted-foreground mr-1">Beispiel</span>
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
                      <span className="text-sm text-muted-foreground ml-1">Text</span>
                    </div>
                    <p className="text-[9px] text-muted-foreground text-center">
                      Vorschau der Karaoke-Box
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CollapsibleSection>

        {/* Effects Section */}
        <CollapsibleSection title="Effekte" icon={<Sparkles className="w-4 h-4" />} defaultOpen={false}>
          <PremiumColorPicker
            label="Schattenfarbe"
            value={style.shadowColor}
            onChange={(value) => handleUpdateStyle({ shadowColor: value })}
            presets={['#000000', '#1A1A1A', '#333333', '#0A0A0A', '#2D2D2D', '#1F1F1F', '#4A4A4A', '#666666']}
          />

          <PremiumSlider
            label="Schatten-Unschaerfe"
            value={style.shadowBlur}
            min={0}
            max={100}
            step={1}
            unit="px"
            onChange={(value) => handleUpdateStyle({ shadowBlur: value })}
          />

          <div className="grid grid-cols-2 gap-3">
            <PremiumSlider
              label="Versatz X"
              value={style.shadowOffsetX ?? 0}
              min={-50}
              max={50}
              step={1}
              unit="px"
              onChange={(value) => handleUpdateStyle({ shadowOffsetX: value })}
            />

            <PremiumSlider
              label="Versatz Y"
              value={style.shadowOffsetY ?? 0}
              min={-50}
              max={50}
              step={1}
              unit="px"
              onChange={(value) => handleUpdateStyle({ shadowOffsetY: value })}
            />
          </div>

          {/* Shadow preview */}
          <div className="p-3 rounded-lg bg-muted/40 border border-border">
            <div className="flex items-center justify-center py-4">
              <span
                className="text-lg font-bold transition-all duration-200"
                style={{
                  color: style.color,
                  textShadow: `${style.shadowOffsetX ?? 0}px ${style.shadowOffsetY ?? 0}px ${style.shadowBlur}px ${style.shadowColor || 'rgba(0,0,0,0.8)'}`,
                  WebkitTextStroke: `${Math.min(style.outlineWidth, 2)}px ${style.outlineColor}`
                }}
              >
                Beispieltext
              </span>
            </div>
            <p className="text-[9px] text-muted-foreground text-center">
              Live-Vorschau des Schattens
            </p>
          </div>
        </CollapsibleSection>
      </div>

      {/* Reset button at bottom */}
      <div className="pt-3 border-t border-border">
        <Button
          variant="outline"
          onClick={() => {
            // Reset to defaults using the centralized DEFAULT_SUBTITLE_STYLE
            handleUpdateStyle({
              fontFamily: DEFAULT_SUBTITLE_STYLE.fontFamily,
              fontSize: DEFAULT_SUBTITLE_STYLE.fontSize,
              fontWeight: DEFAULT_SUBTITLE_STYLE.fontWeight,
              textTransform: DEFAULT_SUBTITLE_STYLE.textTransform,
              color: DEFAULT_SUBTITLE_STYLE.color,
              highlightColor: DEFAULT_SUBTITLE_STYLE.highlightColor,
              upcomingColor: DEFAULT_SUBTITLE_STYLE.upcomingColor,
              backgroundColor: DEFAULT_SUBTITLE_STYLE.backgroundColor,
              outlineColor: DEFAULT_SUBTITLE_STYLE.outlineColor,
              outlineWidth: DEFAULT_SUBTITLE_STYLE.outlineWidth,
              shadowColor: DEFAULT_SUBTITLE_STYLE.shadowColor,
              shadowBlur: DEFAULT_SUBTITLE_STYLE.shadowBlur,
              shadowOffsetX: DEFAULT_SUBTITLE_STYLE.shadowOffsetX,
              shadowOffsetY: DEFAULT_SUBTITLE_STYLE.shadowOffsetY,
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
          className="w-full bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Auf Standard zuruecksetzen
        </Button>
      </div>
    </div>
  )
}
