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
 * Weights are set to all available weights for each font family
 */
export const GOOGLE_FONTS: FontInfo[] = [
  // Variable weight fonts (100-900)
  { family: 'Roboto', category: 'google', value: 'Roboto, sans-serif', weights: [100, 300, 400, 500, 700, 900] },
  { family: 'Open Sans', category: 'google', value: 'Open Sans, sans-serif', weights: [300, 400, 500, 600, 700, 800] },
  { family: 'Lato', category: 'google', value: 'Lato, sans-serif', weights: [100, 300, 400, 700, 900] },
  { family: 'Montserrat', category: 'google', value: 'Montserrat, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Oswald', category: 'google', value: 'Oswald, sans-serif', weights: [200, 300, 400, 500, 600, 700] },
  { family: 'Poppins', category: 'google', value: 'Poppins, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Raleway', category: 'google', value: 'Raleway, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Nunito', category: 'google', value: 'Nunito, sans-serif', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Ubuntu', category: 'google', value: 'Ubuntu, sans-serif', weights: [300, 400, 500, 700] },
  { family: 'Playfair Display', category: 'google', value: 'Playfair Display, serif', weights: [400, 500, 600, 700, 800, 900] },
  { family: 'Merriweather', category: 'google', value: 'Merriweather, serif', weights: [300, 400, 700, 900] },
  { family: 'Rubik', category: 'google', value: 'Rubik, sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Work Sans', category: 'google', value: 'Work Sans, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Noto Sans', category: 'google', value: 'Noto Sans, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Fira Sans', category: 'google', value: 'Fira Sans, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Quicksand', category: 'google', value: 'Quicksand, sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'Barlow', category: 'google', value: 'Barlow, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Mulish', category: 'google', value: 'Mulish, sans-serif', weights: [200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Josefin Sans', category: 'google', value: 'Josefin Sans, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700] },
  { family: 'Archivo', category: 'google', value: 'Archivo, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  // Single weight fonts (display/decorative)
  { family: 'Bebas Neue', category: 'google', value: 'Bebas Neue, sans-serif', weights: [400] },
  { family: 'Anton', category: 'google', value: 'Anton, sans-serif', weights: [400] },
  // Variable weight fonts continued
  { family: 'Cabin', category: 'google', value: 'Cabin, sans-serif', weights: [400, 500, 600, 700] },
  { family: 'Karla', category: 'google', value: 'Karla, sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Manrope', category: 'google', value: 'Manrope, sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Space Grotesk', category: 'google', value: 'Space Grotesk, sans-serif', weights: [300, 400, 500, 600, 700] },
  { family: 'DM Sans', category: 'google', value: 'DM Sans, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Inter Tight', category: 'google', value: 'Inter Tight, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Plus Jakarta Sans', category: 'google', value: 'Plus Jakarta Sans, sans-serif', weights: [200, 300, 400, 500, 600, 700, 800] },
  { family: 'Outfit', category: 'google', value: 'Outfit, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Sora', category: 'google', value: 'Sora, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800] },
  { family: 'Lexend', category: 'google', value: 'Lexend, sans-serif', weights: [100, 200, 300, 400, 500, 600, 700, 800, 900] },
  { family: 'Figtree', category: 'google', value: 'Figtree, sans-serif', weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: 'Comfortaa', category: 'google', value: 'Comfortaa, cursive', weights: [300, 400, 500, 600, 700] },
  // Single weight decorative fonts
  { family: 'Righteous', category: 'google', value: 'Righteous, cursive', weights: [400] },
  { family: 'Permanent Marker', category: 'google', value: 'Permanent Marker, cursive', weights: [400] },
  { family: 'Bangers', category: 'google', value: 'Bangers, cursive', weights: [400] },
  { family: 'Titan One', category: 'google', value: 'Titan One, cursive', weights: [400] },
  { family: 'Russo One', category: 'google', value: 'Russo One, sans-serif', weights: [400] },
  { family: 'Fredoka One', category: 'google', value: 'Fredoka One, cursive', weights: [400] },
  { family: 'Pacifico', category: 'google', value: 'Pacifico, cursive', weights: [400] },
  // Script/handwriting fonts with limited weights
  { family: 'Dancing Script', category: 'google', value: 'Dancing Script, cursive', weights: [400, 500, 600, 700] },
  { family: 'Caveat', category: 'google', value: 'Caveat, cursive', weights: [400, 500, 600, 700] },
  { family: 'Shadows Into Light', category: 'google', value: 'Shadows Into Light, cursive', weights: [400] },
  { family: 'Indie Flower', category: 'google', value: 'Indie Flower, cursive', weights: [400] },
  { family: 'Lobster', category: 'google', value: 'Lobster, cursive', weights: [400] },
  { family: 'Alfa Slab One', category: 'google', value: 'Alfa Slab One, cursive', weights: [400] },
  { family: 'Abril Fatface', category: 'google', value: 'Abril Fatface, cursive', weights: [400] },
  { family: 'Special Elite', category: 'google', value: 'Special Elite, cursive', weights: [400] },
  { family: 'Press Start 2P', category: 'google', value: 'Press Start 2P, cursive', weights: [400] }
]

/**
 * Cache for loaded Google Fonts - stores which weights have been loaded per family
 */
const loadedFontWeights = new Map<string, Set<number>>()

/**
 * Cache for loading promises to prevent duplicate loading requests
 */
const loadingPromises = new Map<string, Promise<void>>()

/**
 * Build the Google Fonts URL for a specific font family
 * Uses the modern Google Fonts CSS2 API format
 * @param family - The font family name
 * @param weights - Array of weights to load
 * @returns The Google Fonts CSS URL
 */
export function buildGoogleFontsUrl(family: string, weights: number[]): string {
  const encodedFamily = encodeURIComponent(family)
  // Sort weights and join with semicolons for CSS2 API
  const sortedWeights = [...weights].sort((a, b) => a - b)
  const weightsStr = sortedWeights.join(';')
  return `https://fonts.googleapis.com/css2?family=${encodedFamily}:wght@${weightsStr}&display=swap`
}

/**
 * Load a Google Font dynamically with all its weights
 * @param family - The font family name to load
 * @param weights - Optional array of weights to load (uses all available if not specified)
 * @returns Promise that resolves when the font is loaded
 */
export async function loadGoogleFont(family: string, weights?: number[]): Promise<void> {
  // Find the font info to get default weights
  const fontInfo = GOOGLE_FONTS.find((f) => f.family === family)
  const fontWeights = weights || fontInfo?.weights || [400, 700]

  // Check which weights are already loaded
  const loadedWeights = loadedFontWeights.get(family) || new Set<number>()
  const weightsToLoad = fontWeights.filter(w => !loadedWeights.has(w))

  // If all weights are already loaded, return immediately
  if (weightsToLoad.length === 0) {
    return
  }

  // Create a unique key for this specific weight combination
  const cacheKey = `${family}:${weightsToLoad.sort().join(',')}`

  // Check if currently loading these weights
  const existingPromise = loadingPromises.get(cacheKey)
  if (existingPromise) {
    return existingPromise
  }

  // Create the loading promise - load ALL weights at once for this font
  const allWeightsToLoad = fontWeights // Always load all defined weights
  const loadPromise = new Promise<void>((resolve, reject) => {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = buildGoogleFontsUrl(family, allWeightsToLoad)
    link.id = `google-font-${family.replace(/\s+/g, '-').toLowerCase()}`

    // Remove any existing link for this font (to reload with all weights)
    const existingLink = document.getElementById(link.id)
    if (existingLink) {
      existingLink.remove()
    }

    console.log(`[FontLoader] Loading Google Font URL: ${link.href}`)
    console.log(`[FontLoader] Weights to load: ${allWeightsToLoad.join(', ')}`)

    link.onload = async () => {
      console.log(`[FontLoader] CSS file loaded successfully for ${family}`)

      // The CSS file is loaded, but font files are lazy-loaded by the browser.
      // For Canvas rendering, we need to explicitly load all font weights
      // using the Font Loading API to ensure the actual font files are fetched.
      try {
        // Debug: Check what @font-face rules were registered
        const registeredFonts = Array.from(document.fonts)
          .filter(f => f.family === family)
          .map(f => ({ weight: f.weight, status: f.status }))
        console.log(`[FontLoader] Registered @font-face for ${family}:`, registeredFonts)

        // Load all font weights explicitly using document.fonts.load()
        // This forces the browser to download the actual font files
        const loadPromises = allWeightsToLoad.map(weight =>
          document.fonts.load(`${weight} 16px "${family}"`)
        )
        await Promise.all(loadPromises)

        // Mark all weights as loaded
        const newLoadedWeights = loadedFontWeights.get(family) || new Set<number>()
        allWeightsToLoad.forEach(w => newLoadedWeights.add(w))
        loadedFontWeights.set(family, newLoadedWeights)
        loadingPromises.delete(cacheKey)
        resolve()
      } catch (fontLoadError) {
        console.warn(`Some font weights for ${family} may not have loaded:`, fontLoadError)
        // Still mark as loaded since CSS is available
        const newLoadedWeights = loadedFontWeights.get(family) || new Set<number>()
        allWeightsToLoad.forEach(w => newLoadedWeights.add(w))
        loadedFontWeights.set(family, newLoadedWeights)
        loadingPromises.delete(cacheKey)
        resolve()
      }
    }

    link.onerror = () => {
      loadingPromises.delete(cacheKey)
      reject(new Error(`Failed to load font: ${family}`))
    }

    document.head.appendChild(link)
  })

  loadingPromises.set(cacheKey, loadPromise)
  return loadPromise
}

/**
 * Check if a Google Font is already loaded (with at least some weights)
 * @param family - The font family name
 * @returns true if the font is loaded
 */
export function isFontLoaded(family: string): boolean {
  const loadedWeights = loadedFontWeights.get(family)
  return loadedWeights !== undefined && loadedWeights.size > 0
}

/**
 * Check if a Google Font is currently loading
 * @param family - The font family name
 * @returns true if the font is loading
 */
export function isFontLoading(family: string): boolean {
  // Check if any loading promise exists for this font family
  for (const key of loadingPromises.keys()) {
    if (key.startsWith(family + ':')) {
      return true
    }
  }
  return false
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
 * Track which fonts are currently being reloaded to prevent infinite loops
 */
const reloadingFonts = new Set<string>()

/**
 * Ensure a specific font weight is loaded for Canvas rendering.
 * This is important because Canvas API requires the actual font file to be loaded,
 * not just the CSS @font-face declaration.
 * @param fontValue - The CSS font-family value (e.g., "Poppins, sans-serif")
 * @param weight - The font weight to ensure is loaded (100-900)
 * @returns Promise that resolves when the font weight is ready for Canvas use
 */
export async function ensureFontWeightLoaded(fontValue: string, weight: number): Promise<void> {
  const fontInfo = getFontInfoByValue(fontValue)
  if (!fontInfo) {
    return
  }

  const family = fontInfo.family

  // Prevent re-entry while reloading
  if (reloadingFonts.has(family)) {
    console.log(`[FontLoader] ${family} is currently reloading, skipping...`)
    return
  }

  const fontString = `${weight} 16px "${family}"`

  // Check if this specific weight is registered as a @font-face
  const registeredWeights = Array.from(document.fonts)
    .filter(f => f.family === family)
    .map(f => parseInt(f.weight, 10))

  const uniqueWeights = [...new Set(registeredWeights)]
  console.log(`[FontLoader] Registered weights for ${family}:`, uniqueWeights)
  console.log(`[FontLoader] Requested weight: ${weight}`)

  // If the requested weight is not registered, we need to reload the CSS with all weights
  if (!uniqueWeights.includes(weight) && fontInfo.weights?.includes(weight)) {
    console.log(`[FontLoader] Weight ${weight} not found! Reloading ${family} with all weights...`)

    // Mark as reloading to prevent re-entry
    reloadingFonts.add(family)

    try {
      // Force reload by clearing the cache for this font
      loadedFontWeights.delete(family)

      // Remove existing link element
      const linkId = `google-font-${family.replace(/\s+/g, '-').toLowerCase()}`
      const existingLink = document.getElementById(linkId)
      if (existingLink) {
        existingLink.remove()
      }

      // Reload with all weights and WAIT for it to complete
      console.log(`[FontLoader] Loading URL: https://fonts.googleapis.com/css2?family=${encodeURIComponent(family)}:wght@${fontInfo.weights.join(';')}&display=swap`)
      await loadGoogleFont(family, fontInfo.weights)

      // Check what we got after reload
      const newWeights = Array.from(document.fonts)
        .filter(f => f.family === family)
        .map(f => parseInt(f.weight, 10))
      console.log(`[FontLoader] After reload, registered weights:`, [...new Set(newWeights)])
    } finally {
      reloadingFonts.delete(family)
    }
  }

  // Now try to load the specific weight
  try {
    const loadedFonts = await document.fonts.load(fontString)
    if (loadedFonts.length > 0) {
      const actualWeight = parseInt(loadedFonts[0].weight, 10)
      if (actualWeight !== weight) {
        console.warn(`[FontLoader] Requested weight ${weight} but browser returned ${actualWeight}`)
      }
    }
  } catch (error) {
    console.error(`[FontLoader] Error loading font:`, error)
  }
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

/**
 * Standard font weight labels for display
 */
export const FONT_WEIGHT_LABELS: Record<number, string> = {
  100: 'Thin',
  200: 'Extra Light',
  300: 'Light',
  400: 'Regular',
  500: 'Medium',
  600: 'Semi Bold',
  700: 'Bold',
  800: 'Extra Bold',
  900: 'Black'
}

/**
 * Get available weights for a font based on its CSS font-family value
 * @param fontValue - The CSS font-family value (e.g., "Roboto, sans-serif")
 * @returns Array of available weights, or default [400, 700] if unknown
 */
export function getAvailableWeights(fontValue: string): number[] {
  // Check Google fonts first (they have defined weights)
  const googleFont = GOOGLE_FONTS.find((f) => f.value === fontValue)
  if (googleFont && googleFont.weights) {
    return googleFont.weights
  }

  // For default and system fonts, assume standard weights are available
  const isDefaultFont = DEFAULT_FONTS.some((f) => f.value === fontValue)
  if (isDefaultFont) {
    // Most system fonts support these common weights
    return [400, 700]
  }

  // For system fonts or unknown fonts, provide common weight options
  return [400, 700]
}

/**
 * Get weight options formatted for a dropdown selector
 * @param fontValue - The CSS font-family value
 * @returns Array of { value, label } options for the dropdown
 */
export function getWeightOptions(fontValue: string): { value: number; label: string }[] {
  const weights = getAvailableWeights(fontValue)
  return weights.map((weight) => ({
    value: weight,
    label: FONT_WEIGHT_LABELS[weight] || `${weight}`
  }))
}
