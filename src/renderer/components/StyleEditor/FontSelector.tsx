import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  DEFAULT_FONTS,
  GOOGLE_FONTS,
  loadGoogleFont,
  isFontLoaded,
  isFontLoading,
  type FontInfo,
  type FontCategory
} from '../../utils/fontLoader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Popover,
  PopoverContent,
  PopoverTrigger
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import {
  Monitor,
  Globe,
  Laptop,
  Loader2,
  Check,
  ChevronDown,
  Search
} from 'lucide-react'

interface FontSelectorProps {
  value: string
  onChange: (value: string) => void
}

export default function FontSelector({ value, onChange }: FontSelectorProps) {
  const { t } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [systemFonts, setSystemFonts] = useState<FontInfo[]>([])
  const [loadingSystemFonts, setLoadingSystemFonts] = useState(false)
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set())
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Load system fonts on mount
  useEffect(() => {
    const loadSystemFonts = async () => {
      setLoadingSystemFonts(true)
      try {
        const fonts = await window.api.fonts.getSystemFonts()
        const fontInfos: FontInfo[] = fonts.map((family) => ({
          family,
          category: 'system' as FontCategory,
          value: `"${family}", sans-serif`
        }))
        setSystemFonts(fontInfos)
      } catch (error) {
        console.error('Failed to load system fonts:', error)
      } finally {
        setLoadingSystemFonts(false)
      }
    }
    loadSystemFonts()
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [isOpen])

  // Get current font display name
  const currentFontName = useMemo(() => {
    // Check default fonts
    const defaultFont = DEFAULT_FONTS.find((f) => f.value === value)
    if (defaultFont) return defaultFont.family

    // Check Google fonts
    const googleFont = GOOGLE_FONTS.find((f) => f.value === value)
    if (googleFont) return googleFont.family

    // Check system fonts
    const systemFont = systemFonts.find((f) => f.value === value)
    if (systemFont) return systemFont.family

    // Fallback: extract font name from value
    const firstFont = value.split(',')[0].trim().replace(/['"]/g, '')
    return firstFont || t('fontSelector.unknown')
  }, [value, systemFonts, t])

  // Filter fonts based on search
  const filteredFonts = useMemo(() => {
    const searchLower = search.toLowerCase()
    const filterFn = (font: FontInfo) =>
      font.family.toLowerCase().includes(searchLower)

    return {
      default: DEFAULT_FONTS.filter(filterFn),
      google: GOOGLE_FONTS.filter(filterFn),
      system: systemFonts.filter(filterFn)
    }
  }, [search, systemFonts])

  // Handle font selection
  const handleSelectFont = useCallback(
    async (font: FontInfo) => {
      // If it's a Google font, load it first
      if (font.category === 'google' && !isFontLoaded(font.family)) {
        setLoadingFonts((prev) => new Set(prev).add(font.family))
        try {
          await loadGoogleFont(font.family, font.weights)
        } catch (error) {
          console.error(`Failed to load font ${font.family}:`, error)
        } finally {
          setLoadingFonts((prev) => {
            const next = new Set(prev)
            next.delete(font.family)
            return next
          })
        }
      }

      onChange(font.value)
      setIsOpen(false)
      setSearch('')
    },
    [onChange]
  )

  // Render a font option
  const renderFontOption = (font: FontInfo) => {
    const isSelected = font.value === value
    const isLoading =
      font.category === 'google' &&
      (loadingFonts.has(font.family) || isFontLoading(font.family))
    const isLoaded = font.category !== 'google' || isFontLoaded(font.family)

    return (
      <button
        key={`${font.category}-${font.family}`}
        onClick={() => handleSelectFont(font)}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left',
          'transition-all duration-150 rounded-sm',
          isSelected
            ? 'bg-primary/20 text-primary'
            : 'text-foreground hover:bg-accent'
        )}
        style={{
          fontFamily: isLoaded ? font.value : 'inherit'
        }}
      >
        {/* Font preview */}
        <span className="flex-1 truncate text-sm">{font.family}</span>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5">
          {isLoading && (
            <Loader2 className="w-3 h-3 text-primary animate-spin" />
          )}
          {isSelected && (
            <Check className="w-3 h-3 text-primary" />
          )}
        </div>
      </button>
    )
  }

  // Render category header
  const renderCategoryHeader = (
    label: string,
    icon: React.ReactNode,
    count: number
  ) => (
    <div className="sticky top-0 flex items-center gap-2 px-3 py-1.5 bg-popover/95 backdrop-blur-sm border-b border-border">
      <span className="text-muted-foreground">{icon}</span>
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[10px] text-muted-foreground/70 ml-auto">{count}</span>
    </div>
  )

  const totalResults =
    filteredFonts.default.length +
    filteredFonts.google.length +
    filteredFonts.system.length

  return (
    <div className="space-y-2">
      {/* Label */}
      <Label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
        {t('fontSelector.fontFamily')}
      </Label>

      {/* Font selector using ShadCN Popover */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={isOpen}
            className={cn(
              'w-full h-9 justify-between bg-muted/60 border-input hover:border-ring',
              isOpen && 'ring-1 ring-ring border-ring'
            )}
            style={{ fontFamily: value }}
          >
            <span className="truncate">{currentFontName}</span>
            <ChevronDown className={cn(
              'ml-2 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
              isOpen && 'rotate-180'
            )} />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[var(--radix-popover-trigger-width)] p-0"
          align="start"
        >
          {/* Search input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t('fontSelector.searchPlaceholder')}
                className="h-8 pl-8 bg-muted/60"
              />
            </div>
          </div>

          {/* Font list */}
          <ScrollArea className="max-h-64">
            {totalResults === 0 ? (
              <div className="px-3 py-6 text-center text-muted-foreground text-sm">
                {t('fontSelector.noFontsFound')}
              </div>
            ) : (
              <>
                {/* Default fonts */}
                {filteredFonts.default.length > 0 && (
                  <div>
                    {renderCategoryHeader(
                      t('fontSelector.categoryDefault'),
                      <Monitor className="w-3 h-3" />,
                      filteredFonts.default.length
                    )}
                    <div className="p-1">
                      {filteredFonts.default.map(renderFontOption)}
                    </div>
                  </div>
                )}

                {/* Google fonts */}
                {filteredFonts.google.length > 0 && (
                  <div>
                    {renderCategoryHeader(
                      t('fontSelector.categoryGoogle'),
                      <Globe className="w-3 h-3" />,
                      filteredFonts.google.length
                    )}
                    <div className="p-1">
                      {filteredFonts.google.map(renderFontOption)}
                    </div>
                  </div>
                )}

                {/* System fonts */}
                {filteredFonts.system.length > 0 && (
                  <div>
                    {renderCategoryHeader(
                      loadingSystemFonts ? t('fontSelector.systemLoading') : t('fontSelector.categorySystem'),
                      <Laptop className="w-3 h-3" />,
                      filteredFonts.system.length
                    )}
                    <div className="p-1">
                      {filteredFonts.system.map(renderFontOption)}
                    </div>
                  </div>
                )}
              </>
            )}
          </ScrollArea>

          {/* Footer with stats */}
          <div className="px-3 py-2 border-t border-border bg-muted/40">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>
                {DEFAULT_FONTS.length} {t('fontSelector.categoryDefault')} · {GOOGLE_FONTS.length} Google ·{' '}
                {systemFonts.length} {t('fontSelector.categorySystem')}
              </span>
              {search && <span>{totalResults} {t('fontSelector.results')}</span>}
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
