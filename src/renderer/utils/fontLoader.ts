/**
 * Font loading utilities for dynamic Google Fonts and system font support
 */

/**
 * Font category for grouping fonts in the UI
 */
export type FontCategory = 'default' | 'google' | 'system'

/**
 * Font metadata structure
 */
export interface FontInfo {
  family: string
  category: FontCategory
  /** CSS font-family value to use */
  value: string
  /** Whether the font has been loaded (for Google Fonts) */
  loaded?: boolean
  /** Available weights for the font */
  weights?: number[]
}

/**
 * Default fonts that are always available (system fonts)
 */
export const DEFAULT_FONTS: FontInfo[] = [
  { family: 'Inter', category: 'default', value: 'Inter, system-ui, sans-serif' },
  { family: 'SF Pro', category: 'default', value: 'SF Pro Display, system-ui, sans-serif' },
  { family: 'Helvetica', category: 'default', value: 'Helvetica Neue, Helvetica, sans-serif' },
  { family: 'Arial', category: 'default', value: 'Arial, sans-serif' },
  { family: 'Georgia', category: 'default', value: 'Georgia, serif' },
  { family: 'Monospace', category: 'default', value: 'monospace' }
]

/**
 * Top 50 Google Fonts curated for subtitle use
 * These fonts are popular, readable, and work well for video subtitles
 */
export const GOOGLE_FONTS: FontInfo[] = [
  { family: 'Roboto', category: 'google', value: 'Roboto, sans-serif', weights: [400, 500, 700] },
  { family: 'Open Sans', category: 'google', value: 'Open Sans, sans-serif', weights: [400, 600, 700] },
  { family: 'Lato', category: 'google', value: 'Lato, sans-serif', weights: [400, 700, 900] },
  { family: 'Montserrat', category: 'google', value: 'Montserrat, sans-serif', weights: [400, 500, 700] },
  { family: 'Oswald', category: 'google', value: 'Oswald, sans-serif', weights: [400, 500, 700] },
  { family: 'Poppins', category: 'google', value: 'Poppins, sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Raleway', category: 'google', value: 'Raleway, sans-serif', weights: [400, 500, 700] },
  { family: 'Nunito', category: 'google', value: 'Nunito, sans-serif', weights: [400, 600, 700] },
  { family: 'Ubuntu', category: 'google', value: 'Ubuntu, sans-serif', weights: [400, 500, 700] },
  { family: 'Playfair Display', category: 'google', value: 'Playfair Display, serif', weights: [400, 700] },
  { family: 'Merriweather', category: 'google', value: 'Merriweather, serif', weights: [400, 700] },
  { family: 'Rubik', category: 'google', value: 'Rubik, sans-serif', weights: [400, 500, 700] },
  { family: 'Work Sans', category: 'google', value: 'Work Sans, sans-serif', weights: [400, 500, 700] },
  { family: 'Noto Sans', category: 'google', value: 'Noto Sans, sans-serif', weights: [400, 700] },
  { family: 'Fira Sans', category: 'google', value: 'Fira Sans, sans-serif', weights: [400, 500, 700] },
  { family: 'Quicksand', category: 'google', value: 'Quicksand, sans-serif', weights: [400, 500, 700] },
  { family: 'Barlow', category: 'google', value: 'Barlow, sans-serif', weights: [400, 500, 700] },
  { family: 'Mulish', category: 'google', value: 'Mulish, sans-serif', weights: [400, 600, 700] },
  { family: 'Josefin Sans', category: 'google', value: 'Josefin Sans, sans-serif', weights: [400, 600, 700] },
  { family: 'Archivo', category: 'google', value: 'Archivo, sans-serif', weights: [400, 500, 700] },
  { family: 'Bebas Neue', category: 'google', value: 'Bebas Neue, sans-serif', weights: [400] },
  { family: 'Anton', category: 'google', value: 'Anton, sans-serif', weights: [400] },
  { family: 'Cabin', category: 'google', value: 'Cabin, sans-serif', weights: [400, 500, 700] },
  { family: 'Karla', category: 'google', value: 'Karla, sans-serif', weights: [400, 700] },
  { family: 'Manrope', category: 'google', value: 'Manrope, sans-serif', weights: [400, 500, 700] },
  { family: 'Space Grotesk', category: 'google', value: 'Space Grotesk, sans-serif', weights: [400, 500, 700] },
  { family: 'DM Sans', category: 'google', value: 'DM Sans, sans-serif', weights: [400, 500, 700] },
  { family: 'Inter Tight', category: 'google', value: 'Inter Tight, sans-serif', weights: [400, 500, 700] },
  { family: 'Plus Jakarta Sans', category: 'google', value: 'Plus Jakarta Sans, sans-serif', weights: [400, 500, 700] },
  { family: 'Outfit', category: 'google', value: 'Outfit, sans-serif', weights: [400, 500, 700] },
  { family: 'Sora', category: 'google', value: 'Sora, sans-serif', weights: [400, 500, 700] },
  { family: 'Lexend', category: 'google', value: 'Lexend, sans-serif', weights: [400, 500, 700] },
  { family: 'Figtree', category: 'google', value: 'Figtree, sans-serif', weights: [400, 500, 700] },
  { family: 'Comfortaa', category: 'google', value: 'Comfortaa, cursive', weights: [400, 500, 700] },
  { family: 'Righteous', category: 'google', value: 'Righteous, cursive', weights: [400] },
  { family: 'Permanent Marker', category: 'google', value: 'Permanent Marker, cursive', weights: [400] },
  { family: 'Bangers', category: 'google', value: 'Bangers, cursive', weights: [400] },
  { family: 'Titan One', category: 'google', value: 'Titan One, cursive', weights: [400] },
  { family: 'Russo One', category: 'google', value: 'Russo One, sans-serif', weights: [400] },
  { family: 'Fredoka One', category: 'google', value: 'Fredoka One, cursive', weights: [400] },
  { family: 'Pacifico', category: 'google', value: 'Pacifico, cursive', weights: [400] },
  { family: 'Dancing Script', category: 'google', value: 'Dancing Script, cursive', weights: [400, 700] },
  { family: 'Caveat', category: 'google', value: 'Caveat, cursive', weights: [400, 700] },
  { family: 'Shadows Into Light', category: 'google', value: 'Shadows Into Light, cursive', weights: [400] },
  { family: 'Indie Flower', category: 'google', value: 'Indie Flower, cursive', weights: [400] },
  { family: 'Lobster', category: 'google', value: 'Lobster, cursive', weights: [400] },
  { family: 'Alfa Slab One', category: 'google', value: 'Alfa Slab One, cursive', weights: [400] },
  { family: 'Abril Fatface', category: 'google', value: 'Abril Fatface, cursive', weights: [400] },
  { family: 'Special Elite', category: 'google', value: 'Special Elite, cursive', weights: [400] },
  { family: 'Press Start 2P', category: 'google', value: 'Press Start 2P, cursive', weights: [400] }
]

/**
 * Cache for loaded Google Fonts to avoid duplicate loads
 */
const loadedFonts = new Set<string>()

/**
 * Cache for loading promises to prevent duplicate loading requests
 */
const loadingPromises = new Map<string, Promise<void>>()

/**
 * Build the Google Fonts URL for a specific font family
 * @param family - The font family name
 * @param weights - Optional array of weights to load (default: [400, 700])
 * @returns The Google Fonts CSS URL
 */
export function buildGoogleFontsUrl(family: string, weights: number[] = [400, 700]): string {
  const encodedFamily = encodeURIComponent(family)
  const weightsStr = weights.join(';')
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weightsStr}&display=swap`
}

/**
 * Load a Google Font dynamically
 * @param family - The font family name to load
 * @param weights - Optional array of weights to load
 * @returns Promise that resolves when the font is loaded
 */
export async function loadGoogleFont(family: string, weights?: number[]): Promise<void> {
  // Check if already loaded
  if (loadedFonts.has(family)) {
    return
  }

  // Check if currently loading
  const existingPromise = loadingPromises.get(family)
  if (existingPromise) {
    return existingPromise
  }

  // Find the font info to get default weights
  const fontInfo = GOOGLE_FONTS.find((f) => f.family === family)
  const fontWeights = weights || fontInfo?.weights || [400, 700]

  // Create the loading promise
  const loadPromise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = buildGoogleFontsUrl(family, fontWeights)

    link.onload = () => {
      loadedFonts.add(family)
      loadingPromises.delete(family)
      resolve()
    }

    link.onerror = () => {
      loadingPromises.delete(family)
      reject(new Error(`Failed to load font: ${family}`))
    }

    document.head.appendChild(link)
  })

  loadingPromises.set(family, loadPromise)
  return loadPromise
}

/**
 * Check if a Google Font is already loaded
 * @param family - The font family name
 * @returns true if the font is loaded
 */
export function isFontLoaded(family: string): boolean {
  return loadedFonts.has(family)
}

/**
 * Check if a Google Font is currently loading
 * @param family - The font family name
 * @returns true if the font is loading
 */
export function isFontLoading(family: string): boolean {
  return loadingPromises.has(family)
}

/**
 * Get font info by family name
 * @param family - The font family name
 * @returns FontInfo or undefined if not found
 */
export function getFontInfo(family: string): FontInfo | undefined {
  // Check default fonts first
  const defaultFont = DEFAULT_FONTS.find((f) => f.family === family)
  if (defaultFont) return defaultFont

  // Check Google fonts
  const googleFont = GOOGLE_FONTS.find((f) => f.family === family)
  if (googleFont) return googleFont

  return undefined
}

/**
 * Get font info by CSS value
 * @param value - The CSS font-family value
 * @returns FontInfo or undefined if not found
 */
export function getFontInfoByValue(value: string): FontInfo | undefined {
  // Check default fonts first
  const defaultFont = DEFAULT_FONTS.find((f) => f.value === value)
  if (defaultFont) return defaultFont

  // Check Google fonts
  const googleFont = GOOGLE_FONTS.find((f) => f.value === value)
  if (googleFont) return googleFont

  return undefined
}

/**
 * Extract the primary font family name from a CSS font-family value
 * @param value - The CSS font-family value (e.g., "Roboto, sans-serif")
 * @returns The primary font family name (e.g., "Roboto")
 */
export function extractFontFamily(value: string): string {
  // Split by comma and get the first font
  const firstFont = value.split(',')[0].trim()
  // Remove quotes if present
  return firstFont.replace(/['"]/g, '')
}

/**
 * Check if a font value corresponds to a Google Font that needs loading
 * @param value - The CSS font-family value
 * @returns true if this is a Google Font
 */
export function isGoogleFont(value: string): boolean {
  return GOOGLE_FONTS.some((f) => f.value === value || f.family === extractFontFamily(value))
}

/**
 * Ensure a font is loaded (load Google Font if necessary)
 * @param value - The CSS font-family value
 * @returns Promise that resolves when the font is ready
 */
export async function ensureFontLoaded(value: string): Promise<void> {
  const fontInfo = getFontInfoByValue(value)

  if (!fontInfo || fontInfo.category !== 'google') {
    // Not a Google Font or not found, assume it's available
    return
  }

  await loadGoogleFont(fontInfo.family, fontInfo.weights)
}

/**
 * Get all available fonts grouped by category
 * @param systemFonts - Optional array of system font names
 * @returns Object with fonts grouped by category
 */
export function getAllFonts(systemFonts: string[] = []): {
  default: FontInfo[]
  google: FontInfo[]
  system: FontInfo[]
} {
  const systemFontInfos: FontInfo[] = systemFonts.map((family) => ({
    family,
    category: 'system' as FontCategory,
    value: `"${family}", sans-serif`
  }))

  return {
    default: DEFAULT_FONTS,
    google: GOOGLE_FONTS,
    system: systemFontInfos
  }
}

/**
 * Preload a set of popular Google Fonts for faster selection
 * This can be called early to cache common fonts
 * @param count - Number of fonts to preload (default: 10)
 */
export async function preloadPopularFonts(count: number = 10): Promise<void> {
  const popularFonts = GOOGLE_FONTS.slice(0, count)
  await Promise.all(popularFonts.map((font) => loadGoogleFont(font.family, font.weights)))
}
