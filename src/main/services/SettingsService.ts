import Store from 'electron-store'

/**
 * App-wide settings that persist between sessions
 */
export interface AppSettings {
  openRouterApiKey?: string
}

// Schema for type-safe electron-store
const schema = {
  openRouterApiKey: {
    type: 'string' as const
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
      openRouterApiKey: this.store.get('openRouterApiKey')
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
