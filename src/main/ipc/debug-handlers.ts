/**
 * Debug IPC Handlers
 *
 * Provides IPC interface for the debug system, allowing the renderer
 * to query logs and app status.
 */

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'
import { getDebugService, DEBUG_ENABLED } from '../services/DebugService'
import type { DebugLogEntry, DebugAppStatus } from '../../shared/types'

export function registerDebugHandlers(): void {
  const debugService = getDebugService()

  /**
   * Get all debug logs
   */
  ipcMain.handle(IPC_CHANNELS.DEBUG_GET_LOGS, (): DebugLogEntry[] => {
    return debugService.getLogs()
  })

  /**
   * Clear all debug logs
   */
  ipcMain.handle(IPC_CHANNELS.DEBUG_CLEAR, (): void => {
    debugService.clearLogs()
  })

  /**
   * Get comprehensive app status for debugging
   */
  ipcMain.handle(IPC_CHANNELS.DEBUG_GET_STATUS, (): DebugAppStatus & { debugEnabled: boolean } => {
    return {
      ...debugService.getStatus(),
      debugEnabled: DEBUG_ENABLED
    }
  })

  /**
   * Log from renderer (allows renderer to add logs to the central system)
   */
  ipcMain.handle(
    IPC_CHANNELS.DEBUG_LOG,
    (
      _event,
      level: DebugLogEntry['level'],
      category: DebugLogEntry['category'],
      message: string,
      data?: unknown
    ): void => {
      debugService.log(level, category, message, data)
    }
  )

  debugService.log('info', 'main', 'Debug handlers registered')
}
