import { useState, useMemo, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { parseColor } from 'react-aria-components'
import type { BoxPadding } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
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
import { Link, Unlink } from 'lucide-react'

// Shared field label
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="text-[11px] font-medium text-muted-foreground tracking-wide block">
      {children}
    </Label>
  )
}

// Slider that commits value only on release (single undo step per drag)
interface StyleSliderProps {
  label: string
  value: number
  min: number
  max: number
  step?: number
  unit?: string
  onChange: (value: number) => void
}

export function StyleSlider({ label, value, min, max, step = 1, unit = '', onChange }: StyleSliderProps) {
  const [localValue, setLocalValue] = useState(value)
  const isDragging = useRef(false)

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

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <FieldLabel>{label}</FieldLabel>
        <span className="text-[11px] font-mono text-foreground/60 tabular-nums">
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
        onPointerDown={() => { isDragging.current = true }}
        className="w-full"
      />
    </div>
  )
}

// Color picker with popover (hex input + presets)
interface StyleColorPickerProps {
  label: string
  value: string
  onChange: (value: string) => void
  presets?: readonly string[]
}

export function StyleColorPicker({
  label,
  value,
  onChange,
  presets = ['#FFFFFF', '#FFD700', '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD']
}: StyleColorPickerProps) {
  const { t } = useTranslation()
  const safeValue = useMemo(() => {
    if (!value || typeof value !== 'string') return '#FFFFFF'
    if (/^#[0-9A-Fa-f]{6}$/.test(value)) return value.toUpperCase()
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

  useEffect(() => {
    setHexInput(safeValue)
  }, [safeValue])

  const handleHexChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setHexInput(newValue)
    if (/^#[0-9A-Fa-f]{6}$/.test(newValue)) {
      onChange(newValue.toUpperCase())
    }
  }

  const handleHexBlur = () => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hexInput)) {
      setHexInput(safeValue)
    }
  }

  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className="w-full h-8 px-1.5 justify-start gap-2 border-white/[0.07] hover:border-white/[0.14] bg-white/[0.03] hover:bg-white/[0.05]"
          >
            <div
              className="w-5 h-5 rounded-[5px] border border-white/15"
              style={{ backgroundColor: safeValue }}
            />
            <span className="text-[11px] font-mono text-muted-foreground uppercase flex-1 text-left tabular-nums">
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

              <div className="space-y-1.5">
                <Label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                  {t('styleEditor.hex')}
                </Label>
                <Input
                  value={hexInput}
                  onChange={handleHexChange}
                  onBlur={handleHexBlur}
                  className="h-8 font-mono text-xs uppercase bg-muted/60"
                  maxLength={7}
                />
              </div>

              <ColorSwatchPicker className="w-[200px] justify-between">
                {presets.map((preset) => (
                  <ColorSwatchPickerItem key={preset} color={preset} className="size-6 rounded-md">
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

// Select dropdown
interface StyleSelectProps {
  label: string
  value: string
  options: { value: string; label: string }[]
  onChange: (value: string) => void
}

export function StyleSelect({ label, value, options, onChange }: StyleSelectProps) {
  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full h-8 text-xs bg-white/[0.03] border-white/[0.07] hover:border-white/[0.14]">
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

// Segmented button group
interface StyleButtonGroupProps {
  label?: string
  value: string
  options: { value: string; label: string; icon?: React.ReactNode }[]
  onChange: (value: string) => void
  columns?: number
}

export function StyleButtonGroup({ label, value, options, onChange, columns = 3 }: StyleButtonGroupProps) {
  return (
    <div className="space-y-1.5">
      {label && <FieldLabel>{label}</FieldLabel>}
      <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {options.map((option) => {
          const isActive = value === option.value
          return (
            <button
              key={option.value}
              onClick={() => onChange(option.value)}
              className={cn(
                'pressable h-7 px-2 rounded-md text-[11px] font-medium',
                'transition-colors duration-150',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-white/[0.04] text-muted-foreground hover:bg-white/[0.07] hover:text-foreground'
              )}
            >
              <span className="flex items-center justify-center gap-1.5">
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

// Box padding input with link toggle
interface BoxPaddingInputProps {
  label: string
  value: BoxPadding
  onChange: (value: BoxPadding) => void
}

export function BoxPaddingInput({ label, value, onChange }: BoxPaddingInputProps) {
  const { t } = useTranslation()
  const [isLinked, setIsLinked] = useState(
    value.top === value.right && value.right === value.bottom && value.bottom === value.left
  )
  const [localValues, setLocalValues] = useState(value)

  useEffect(() => {
    setLocalValues(value)
    const allEqual = value.top === value.right && value.right === value.bottom && value.bottom === value.left
    setIsLinked(allEqual)
  }, [value])

  const handleChange = (side: keyof BoxPadding, newValue: number) => {
    const clampedValue = Math.max(0, Math.min(100, newValue))

    if (isLinked) {
      const newPadding: BoxPadding = {
        top: clampedValue,
        right: clampedValue,
        bottom: clampedValue,
        left: clampedValue
      }
      setLocalValues(newPadding)
      onChange(newPadding)
    } else {
      const newPadding: BoxPadding = { ...localValues, [side]: clampedValue }
      setLocalValues(newPadding)
      onChange(newPadding)
    }
  }

  const handleInputChange = (side: keyof BoxPadding, inputValue: string) => {
    const parsed = parseInt(inputValue, 10)
    if (!isNaN(parsed)) {
      handleChange(side, parsed)
    }
  }

  const toggleLinked = () => {
    if (!isLinked) {
      const syncedPadding: BoxPadding = {
        top: localValues.top,
        right: localValues.top,
        bottom: localValues.top,
        left: localValues.top
      }
      setLocalValues(syncedPadding)
      onChange(syncedPadding)
    }
    setIsLinked(!isLinked)
  }

  const sideInput = (side: keyof BoxPadding) => (
    <Input
      type="number"
      value={localValues[side]}
      onChange={(e) => handleInputChange(side, e.target.value)}
      className="w-12 h-7 text-center text-[11px] font-mono bg-white/[0.04] border-white/[0.07] px-1"
      min={0}
      max={100}
    />
  )

  return (
    <div className="space-y-1.5">
      <FieldLabel>{label}</FieldLabel>
      <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-2.5">
        <div className="flex flex-col items-center gap-1.5">
          {sideInput('top')}
          <div className="flex items-center gap-1.5">
            {sideInput('left')}
            <button
              onClick={toggleLinked}
              className={cn(
                'pressable w-12 h-9 rounded-md border border-dashed flex items-center justify-center',
                'transition-colors duration-150',
                isLinked
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-white/[0.1] text-muted-foreground hover:text-foreground hover:bg-white/[0.04]'
              )}
              title={isLinked ? t('styleEditor.unlinkValues') : t('styleEditor.linkValues')}
            >
              {isLinked ? <Link className="w-3.5 h-3.5" /> : <Unlink className="w-3.5 h-3.5" />}
            </button>
            {sideInput('right')}
          </div>
          {sideInput('bottom')}
        </div>
      </div>
    </div>
  )
}

// Section heading inside inspector tabs
export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 pt-1">
      {children}
    </h3>
  )
}
