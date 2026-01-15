import { ipcMain, app } from 'electron'
import { IPC_CHANNELS, DEFAULT_LANGUAGE } from '../../shared/types'
import type { AppSettings, AppLanguage } from '../../shared/types'
import { settingsService } from '../services/SettingsService'

export function registerSettingsHandlers(): void {
  // Get all settings
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET, (): AppSettings => {
    return settingsService.getSettings()
  })

  // Update settings
  ipcMain.handle(
    IPC_CHANNELS.SETTINGS_SET,
    (_event, settings: Partial<AppSettings>): void => {
      settingsService.setSettings(settings)
    }
  )

  // Check if API key is set via environment variable
  ipcMain.handle(IPC_CHANNELS.SETTINGS_HAS_ENV_API_KEY, (): boolean => {
    return settingsService.hasEnvApiKey()
  })

  // Get API key (with fallback logic)
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_API_KEY, (): string | undefined => {
    return settingsService.getApiKey()
  })

  // Get system language for initial language detection
  // Uses Electron's app.getLocale() to detect the OS language
  // Maps to supported AppLanguage ('de' | 'en'), defaulting to German if unsupported
  ipcMain.handle(IPC_CHANNELS.SETTINGS_GET_SYSTEM_LANGUAGE, (): AppLanguage => {
    const locale = app.getLocale() // e.g., 'en-US', 'de-DE', 'de', 'en'
    const languageCode = locale.split('-')[0].toLowerCase() // Extract base language code

    // Map to supported languages
    if (languageCode === 'en') {
      return 'en'
    }
    if (languageCode === 'de') {
      return 'de'
    }

    // Default to German for unsupported languages
    return DEFAULT_LANGUAGE
  })
}
