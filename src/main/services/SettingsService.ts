import Store from 'electron-store'
import { DEFAULT_MODEL_ID } from '../../shared/types'
import type { AppSettings, AppLanguage } from '../../shared/types'

// Schema for type-safe electron-store
const schema = {
  openRouterApiKey: {
    type: 'string' as const
  },
  selectedModelId: {
    type: 'string' as const
  },
  language: {
    type: 'string' as const,
    enum: ['de', 'en']
  }
}

/**
 * Service for managing persistent app settings using electron-store.
 * Settings are stored in the user's app data directory.
 */
class SettingsService {
  private store: Store<AppSettings>

  constructor() {
    this.store = new Store<AppSettings>({
      name: 'settings',
      schema,
      defaults: {}
    })
  }

  /**
   * Get all settings
   */
  getSettings(): AppSettings {
    return {
      openRouterApiKey: this.store.get('openRouterApiKey'),
      selectedModelId: this.store.get('selectedModelId'),
      language: this.store.get('language')
    }
  }

  /**
   * Update settings (partial update supported)
   */
  setSettings(settings: Partial<AppSettings>): void {
    if (settings.openRouterApiKey !== undefined) {
      if (settings.openRouterApiKey === '') {
        // Empty string means delete the key
        this.store.delete('openRouterApiKey')
      } else {
        this.store.set('openRouterApiKey', settings.openRouterApiKey)
      }
    }

    if (settings.selectedModelId !== undefined) {
      if (settings.selectedModelId === '') {
        this.store.delete('selectedModelId')
      } else {
        this.store.set('selectedModelId', settings.selectedModelId)
      }
    }

    if (settings.language !== undefined) {
      this.store.set('language', settings.language)
    }
  }

  /**
   * Get the selected Whisper model ID.
   * Returns the default model if none is selected.
   */
  getSelectedModelId(): string {
    return this.store.get('selectedModelId') || DEFAULT_MODEL_ID
  }

  /**
   * Set the selected Whisper model ID.
   */
  setSelectedModelId(modelId: string): void {
    this.store.set('selectedModelId', modelId)
  }

  /**
   * Get the user's language preference.
   * Returns undefined if no language preference is set (first launch).
   */
  getLanguage(): AppLanguage | undefined {
    return this.store.get('language')
  }

  /**
   * Set the user's language preference.
   */
  setLanguage(language: AppLanguage): void {
    this.store.set('language', language)
  }

  /**
   * Check if a language preference has been set.
   * Used to determine if this is the first launch and system language detection is needed.
   */
  hasLanguagePreference(): boolean {
    return this.store.has('language')
  }

  /**
   * Check if an API key is available via environment variable.
   * This takes priority over user settings.
   */
  hasEnvApiKey(): boolean {
    return !!process.env.OPENROUTER_API_KEY
  }

  /**
   * Get the OpenRouter API key with fallback logic:
   * 1. Environment variable (for development)
   * 2. User settings (for bundled app)
   *
   * Returns undefined if no API key is configured.
   */
  getApiKey(): string | undefined {
    // Priority 1: Environment variable
    if (process.env.OPENROUTER_API_KEY) {
      return process.env.OPENROUTER_API_KEY
    }

    // Priority 2: User settings
    return this.store.get('openRouterApiKey')
  }
}

// Singleton instance
export const settingsService = new SettingsService()
