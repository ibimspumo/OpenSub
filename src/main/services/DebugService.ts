/**
 * DebugService - Centralized debug logging for OpenSub
 *
 * Collects logs from all parts of the app (main process, renderer, Python service)
 * and provides status information for debugging production issues.
 */

import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import type { DebugLogEntry, DebugAppStatus } from '../../shared/types'
import { getMainWindow } from '../index'
import { IPC_CHANNELS } from '../../shared/types'

// Enable debug mode via environment variable or always in development
export const DEBUG_ENABLED = !app.isPackaged || process.env.OPENSUB_DEBUG === '1'

// Maximum number of log entries to keep in memory
const MAX_LOG_ENTRIES = 500

class DebugService {
  private logs: DebugLogEntry[] = []
  private whisperServiceRunning = false
  private whisperModelReady = false

  constructor() {
    // Log startup
    this.log('info', 'main', 'DebugService initialized', {
      debugEnabled: DEBUG_ENABLED,
      isPackaged: app.isPackaged
    })
  }

  /**
   * Add a log entry
   */
  log(
    level: DebugLogEntry['level'],
    category: DebugLogEntry['category'],
    message: string,
    data?: unknown
  ): void {
    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data
    }

    this.logs.push(entry)

    // Keep log size bounded
    if (this.logs.length > MAX_LOG_ENTRIES) {
      this.logs = this.logs.slice(-MAX_LOG_ENTRIES)
    }

    // Log to console (always log errors/warnings, other levels only in dev)
    const prefix = `[${category.toUpperCase()}]`
    if (level === 'error') {
      console.error(prefix, message, data ?? '')
    } else if (level === 'warn') {
      console.warn(prefix, message, data ?? '')
    } else if (DEBUG_ENABLED) {
      console.log(prefix, message, data ?? '')
    }

    // Always send to renderer so debug panel works in production
    const mainWindow = getMainWindow()
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC_CHANNELS.DEBUG_LOG, entry)
    }
  }

  /**
   * Get all log entries
   */
  getLogs(): DebugLogEntry[] {
    return [...this.logs]
  }

  /**
   * Clear all logs
   */
  clearLogs(): void {
    this.logs = []
    this.log('info', 'main', 'Logs cleared')
  }

  /**
   * Set whisper service status
   */
  setWhisperStatus(running: boolean, modelReady: boolean): void {
    this.whisperServiceRunning = running
    this.whisperModelReady = modelReady
    this.log('info', 'whisper', `Status updated: running=${running}, modelReady=${modelReady}`)
  }

  /**
   * Get comprehensive app status for debugging
   */
  getStatus(): DebugAppStatus {
    const isPackaged = app.isPackaged
    const appPath = app.getAppPath()
    const resourcesPath = isPackaged ? process.resourcesPath : appPath

    // Calculate Python paths based on environment
    let pythonPath: string
    let pythonServicePath: string

    if (isPackaged) {
      pythonPath = path.join(resourcesPath, 'python-env', 'bin', 'python3')
      pythonServicePath = path.join(resourcesPath, 'python-service', 'whisper_service', 'main.py')
    } else {
      pythonPath = path.join(appPath, 'python-service', '.venv', 'bin', 'python')
      pythonServicePath = path.join(appPath, 'python-service', 'whisper_service', 'main.py')
    }

    // Check if files exist
    let pythonExists = false
    let serviceExists = false

    try {
      // For symlinks, we need to check if the target exists
      pythonExists = fs.existsSync(pythonPath)
      if (pythonExists) {
        // Try to resolve the symlink to see if target exists
        try {
          const realPath = fs.realpathSync(pythonPath)
          pythonExists = fs.existsSync(realPath)
          this.log('debug', 'main', `Python symlink resolves to: ${realPath}`, { exists: pythonExists })
        } catch (e) {
          // Symlink target doesn't exist
          pythonExists = false
          this.log('error', 'main', `Python symlink broken: ${pythonPath}`, { error: String(e) })
        }
      }
    } catch (e) {
      this.log('error', 'main', `Error checking Python path: ${pythonPath}`, { error: String(e) })
    }

    try {
      serviceExists = fs.existsSync(pythonServicePath)
    } catch (e) {
      this.log('error', 'main', `Error checking service path: ${pythonServicePath}`, { error: String(e) })
    }

    return {
      isPackaged,
      appPath,
      resourcesPath,
      pythonPath,
      pythonServicePath,
      pythonExists,
      serviceExists,
      whisperServiceRunning: this.whisperServiceRunning,
      whisperModelReady: this.whisperModelReady,
      platform: process.platform,
      arch: process.arch,
      electronVersion: process.versions.electron,
      nodeVersion: process.versions.node
    }
  }
}

// Singleton instance
let debugServiceInstance: DebugService | null = null

export function getDebugService(): DebugService {
  if (!debugServiceInstance) {
    debugServiceInstance = new DebugService()
  }
  return debugServiceInstance
}

// Convenience functions for logging
export function debugLog(
  level: DebugLogEntry['level'],
  category: DebugLogEntry['category'],
  message: string,
  data?: unknown
): void {
  getDebugService().log(level, category, message, data)
}

export function debugInfo(category: DebugLogEntry['category'], message: string, data?: unknown): void {
  getDebugService().log('info', category, message, data)
}

export function debugWarn(category: DebugLogEntry['category'], message: string, data?: unknown): void {
  getDebugService().log('warn', category, message, data)
}

export function debugError(category: DebugLogEntry['category'], message: string, data?: unknown): void {
  getDebugService().log('error', category, message, data)
}
