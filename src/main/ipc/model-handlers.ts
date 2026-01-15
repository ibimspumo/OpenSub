import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getModelManager } from '../services/ModelManager'
import { settingsService } from '../services/SettingsService'
import { reinitializeWithModel, getCurrentModelId } from './whisper-handlers'
import { getMainWindow } from '../index'
import type { ModelInfo } from '../../shared/types'

/**
 * Register IPC handlers for model management.
 *
 * These handlers allow the renderer to check model status
 * and determine if first-run setup is needed.
 */
export function registerModelHandlers(): void {
  const modelManager = getModelManager()

  /**
   * Get list of all available models with download status
   */
  ipcMain.handle(IPC_CHANNELS.MODELS_LIST, (): ModelInfo[] => {
    return modelManager.getAvailableModels()
  })

  /**
   * Check if any model is downloaded
   */
  ipcMain.handle(IPC_CHANNELS.MODELS_CHECK, (): boolean => {
    return modelManager.hasAnyModelDownloaded()
  })

  /**
   * Check if first-run setup is needed (no models downloaded)
   */
  ipcMain.handle(IPC_CHANNELS.MODELS_IS_FIRST_RUN, (): boolean => {
    return modelManager.isFirstRunSetupNeeded()
  })

  /**
   * Get the currently selected model ID
   */
  ipcMain.handle(IPC_CHANNELS.MODELS_GET_SELECTED, (): string => {
    return settingsService.getSelectedModelId()
  })

  /**
   * Select and load a new model.
   * This will reinitialize the WhisperService with the new model.
   */
  ipcMain.handle(
    IPC_CHANNELS.MODELS_SELECT,
    async (_event, modelId: string): Promise<{ success: boolean; error?: string }> => {
      try {
        const currentId = getCurrentModelId()

        // If same model is already loaded, skip reinitialize
        if (currentId === modelId) {
          console.log(`Model ${modelId} is already loaded, skipping reinitialize`)
          return { success: true }
        }

        console.log(`Switching to model: ${modelId}`)

        // Notify renderer that model is being reloaded
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.WHISPER_MODEL_READY, { ready: false })
        }

        // Reinitialize with the new model
        await reinitializeWithModel(modelId)

        // Notify renderer that model is ready
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC_CHANNELS.WHISPER_MODEL_READY, { ready: true })
        }

        return { success: true }
      } catch (error) {
        console.error('Failed to switch model:', error)
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to switch model'
        }
      }
    }
  )
}
