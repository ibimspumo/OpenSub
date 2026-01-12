import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  DEFAULT_FONTS,
  GOOGLE_FONTS,
  loadGoogleFont,
  isFontLoaded,
  isFontLoading,
  type FontInfo,
  type FontCategory
} from '../../utils/fontLoader'

interface FontSelectorProps {
  value: string
  onChange: (value: string) => void
}

// Icons for font categories
const DefaultFontIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
)

const GoogleFontIcon = () => (
  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
  </svg>
)

const SystemFontIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
)

const LoadingSpinner = () => (
  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

export default function FontSelector({ value, onChange }: FontSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [systemFonts, setSystemFonts] = useState<FontInfo[]>([])
  const [loadingSystemFonts, setLoadingSystemFonts] = useState(false)
  const [loadingFonts, setLoadingFonts] = useState<Set<string>>(new Set())
  const containerRef = useRef<HTMLDivElement>(null)
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

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isOpen && searchInputRef.current) {
      searchInputRef.current.focus()
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
    return firstFont || 'Unbekannt'
  }, [value, systemFonts])

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
        className={`
          w-full flex items-center gap-2 px-3 py-2 text-left
          transition-all duration-150
          ${isSelected
            ? 'bg-primary-600/20 text-primary-300'
            : 'text-dark-200 hover:bg-white/[0.04]'
          }
        `}
        style={{
          fontFamily: isLoaded ? font.value : 'inherit'
        }}
      >
        {/* Font preview */}
        <span className="flex-1 truncate text-sm">{font.family}</span>

        {/* Status indicators */}
        <div className="flex items-center gap-1.5">
          {isLoading && (
            <span className="text-primary-400">
              <LoadingSpinner />
            </span>
          )}
          {isSelected && (
            <span className="text-primary-400">
              <CheckIcon />
            </span>
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
    <div className="sticky top-0 flex items-center gap-2 px-3 py-1.5 bg-dark-900/95 backdrop-blur-sm border-b border-white/[0.04]">
      <span className="text-dark-500">{icon}</span>
      <span className="text-[10px] font-semibold text-dark-400 uppercase tracking-wider">
        {label}
      </span>
      <span className="text-[10px] text-dark-500 ml-auto">{count}</span>
    </div>
  )

  const totalResults =
    filteredFonts.default.length +
    filteredFonts.google.length +
    filteredFonts.system.length

  return (
    <div ref={containerRef} className="relative">
      {/* Label */}
      <label className="text-[11px] font-medium text-dark-400 uppercase tracking-wider block mb-2">
        Schriftart
      </label>

      {/* Current selection button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full h-9 px-3 rounded-lg text-sm text-left
          bg-dark-800/60 text-dark-200
          border hover:border-white/[0.12]
          focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40
          transition-all duration-200 cursor-pointer
          flex items-center gap-2
          ${isOpen ? 'border-primary-500/40 ring-2 ring-primary-500/30' : 'border-white/[0.08]'}
        `}
        style={{ fontFamily: value }}
      >
        <span className="flex-1 truncate">{currentFontName}</span>
        <svg
          className={`w-4 h-4 text-dark-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 rounded-lg bg-dark-900 border border-white/[0.08] shadow-xl shadow-black/40 overflow-hidden animate-fade-in-scale">
          {/* Search input */}
          <div className="p-2 border-b border-white/[0.06]">
            <div className="relative">
              <svg
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Schriftart suchen..."
                className="w-full h-8 pl-8 pr-3 rounded-md text-sm
                  bg-dark-800/60 text-dark-200 placeholder-dark-500
                  border border-white/[0.06]
                  focus:outline-none focus:border-primary-500/40
                  transition-colors duration-150"
              />
            </div>
          </div>

          {/* Font list */}
          <div className="max-h-64 overflow-y-auto">
            {totalResults === 0 ? (
              <div className="px-3 py-6 text-center text-dark-500 text-sm">
                Keine Schriftarten gefunden
              </div>
            ) : (
              <>
                {/* Default fonts */}
                {filteredFonts.default.length > 0 && (
                  <div>
                    {renderCategoryHeader(
                      'Standard',
                      <DefaultFontIcon />,
                      filteredFonts.default.length
                    )}
                    {filteredFonts.default.map(renderFontOption)}
                  </div>
                )}

                {/* Google fonts */}
                {filteredFonts.google.length > 0 && (
                  <div>
                    {renderCategoryHeader(
                      'Google Fonts',
                      <GoogleFontIcon />,
                      filteredFonts.google.length
                    )}
                    {filteredFonts.google.map(renderFontOption)}
                  </div>
                )}

                {/* System fonts */}
                {filteredFonts.system.length > 0 && (
                  <div>
                    {renderCategoryHeader(
                      loadingSystemFonts ? 'System (Laden...)' : 'System',
                      <SystemFontIcon />,
                      filteredFonts.system.length
                    )}
                    {filteredFonts.system.map(renderFontOption)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer with stats */}
          <div className="px-3 py-2 border-t border-white/[0.06] bg-dark-800/40">
            <div className="flex items-center justify-between text-[10px] text-dark-500">
              <span>
                {DEFAULT_FONTS.length} Standard · {GOOGLE_FONTS.length} Google ·{' '}
                {systemFonts.length} System
              </span>
              {search && <span>{totalResults} Ergebnisse</span>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
