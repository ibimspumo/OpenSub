import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import type { AppSettings } from '../../shared/types'
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
}
