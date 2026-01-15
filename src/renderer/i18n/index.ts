import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// Import translation files (to be created in T003 and T004)
import de from './locales/de.json'
import en from './locales/en.json'

// Supported languages
export const SUPPORTED_LANGUAGES = ['de', 'en'] as const
export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]

// Language display names
export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English'
}

// Default fallback language
export const DEFAULT_LANGUAGE: SupportedLanguage = 'de'

/**
 * Initialize i18next with React and language detection
 *
 * Language detection priority:
 * 1. Previously saved user preference (localStorage)
 * 2. Browser/system language
 * 3. Default fallback (German)
 */
i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      de: { translation: de },
      en: { translation: en }
    },
    fallbackLng: DEFAULT_LANGUAGE,
    supportedLngs: SUPPORTED_LANGUAGES,

    // Detection options
    detection: {
      // Order of detection methods
      order: ['localStorage', 'navigator'],
      // Key used in localStorage to store language preference
      lookupLocalStorage: 'opensub-language',
      // Cache the detected language
      caches: ['localStorage']
    },

    // Interpolation settings
    interpolation: {
      escapeValue: false // React already escapes values
    },

    // React-specific options
    react: {
      useSuspense: false // Disable suspense for synchronous rendering
    },

    // Debug mode (disable in production)
    debug: import.meta.env.DEV
  })

/**
 * Change the current language
 * @param language - The language code to switch to
 */
export async function changeLanguage(language: SupportedLanguage): Promise<void> {
  await i18n.changeLanguage(language)
}

/**
 * Get the current language
 * @returns The current language code
 */
export function getCurrentLanguage(): SupportedLanguage {
  const lang = i18n.language
  // Handle cases like 'de-DE' -> 'de'
  const baseLang = lang?.split('-')[0] as SupportedLanguage
  return SUPPORTED_LANGUAGES.includes(baseLang) ? baseLang : DEFAULT_LANGUAGE
}

/**
 * Check if a language is supported
 * @param language - The language code to check
 * @returns True if the language is supported
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
  return SUPPORTED_LANGUAGES.includes(language as SupportedLanguage)
}

export default i18n
