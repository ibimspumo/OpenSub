import { ipcMain, dialog, app } from 'electron'
import { readFile, writeFile, unlink } from 'fs/promises'
import { existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'
import { IPC_CHANNELS, StyleProfileExport } from '../../shared/types'
import { getMainWindow } from '../index'

// Cache for system fonts (they don't change during app lifetime)
let cachedSystemFonts: string[] | null = null

/**
 * Get system fonts available on the OS
 * Uses different methods depending on the platform
 */
function getSystemFonts(): string[] {
  if (cachedSystemFonts !== null) {
    return cachedSystemFonts
  }

  try {
    const platform = process.platform
    let fonts: string[] = []

    if (platform === 'darwin') {
      // macOS: Use atsutil to list fonts (fast and reliable)
      try {
        // atsutil databases -list gives font database info, but we'll use a simpler approach
        // List fonts from common macOS font directories
        const { readdirSync, existsSync } = require('fs')
        const { join, basename, extname } = require('path')

        const fontDirs = [
          '/System/Library/Fonts',
          '/Library/Fonts',
          join(process.env.HOME || '', 'Library/Fonts')
        ]

        const fontNames = new Set<string>()

        for (const dir of fontDirs) {
          if (existsSync(dir)) {
            try {
              const files = readdirSync(dir)
              for (const file of files) {
                const ext = extname(file).toLowerCase()
                if (['.ttf', '.otf', '.ttc', '.dfont'].includes(ext)) {
                  // Extract font name from filename (remove extension and common suffixes)
                  let name = basename(file, ext)
                    .replace(/-Regular$|-Bold$|-Italic$|-BoldItalic$/i, '')
                    .replace(/Regular$|Bold$|Italic$|BoldItalic$/i, '')
                    .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space before capitals
                    .trim()
                  if (name) fontNames.add(name)
                }
              }
            } catch {
              // Skip directories we can't read
            }
          }
        }

        fonts = Array.from(fontNames)
      } catch {
        // Fallback: Return common macOS fonts
        fonts = [
          'SF Pro',
          'SF Pro Display',
          'SF Pro Text',
          'Helvetica Neue',
          'Helvetica',
          'Arial',
          'Times New Roman',
          'Georgia',
          'Courier New',
          'Verdana',
          'Tahoma',
          'Trebuchet MS',
          'Impact',
          'Comic Sans MS',
          'Menlo',
          'Monaco',
          'Avenir',
          'Avenir Next',
          'Futura',
          'Gill Sans',
          'Optima',
          'Palatino'
        ]
      }
    } else if (platform === 'win32') {
      // Windows: List fonts from registry
      try {
        const output = execSync(
          'reg query "HKLM\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion\\Fonts" 2>nul',
          { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 }
        ).trim()
        const fontNames = new Set<string>()
        output.split('\n').forEach((line) => {
          const match = line.match(/^\s+(.+?)\s+REG_SZ/)
          if (match) {
            // Remove file extension info like "(TrueType)"
            const fontName = match[1].replace(/\s*\(.*\)\s*$/, '').trim()
            if (fontName) fontNames.add(fontName)
          }
        })
        fonts = Array.from(fontNames).sort()
      } catch {
        // Fallback: Common Windows fonts
        fonts = [
          'Arial',
          'Calibri',
          'Cambria',
          'Comic Sans MS',
          'Consolas',
          'Courier New',
          'Georgia',
          'Impact',
          'Segoe UI',
          'Tahoma',
          'Times New Roman',
          'Trebuchet MS',
          'Verdana'
        ]
      }
    } else {
      // Linux: Use fc-list
      try {
        const output = execSync('fc-list : family 2>/dev/null | sort -u', {
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024
        }).trim()
        fonts = output.split('\n').filter((f) => f.length > 0)
      } catch {
        // Fallback: Common Linux fonts
        fonts = [
          'DejaVu Sans',
          'DejaVu Serif',
          'DejaVu Sans Mono',
          'Liberation Sans',
          'Liberation Serif',
          'Liberation Mono',
          'Ubuntu',
          'Noto Sans',
          'Roboto'
        ]
      }
    }

    // Filter out duplicates and sort
    cachedSystemFonts = [...new Set(fonts)].sort((a, b) =>
      a.toLowerCase().localeCompare(b.toLowerCase())
    )

    return cachedSystemFonts
  } catch (error) {
    console.error('Error getting system fonts:', error)
    return []
  }
}

export function registerFileHandlers(): void {
  // Select video file
  ipcMain.handle(IPC_CHANNELS.FILE_SELECT_VIDEO, async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return null

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Video auswählen',
      properties: ['openFile'],
      filters: [
        {
          name: 'Video',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'm4v']
        },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return null
    }

    return result.filePaths[0]
  })

  // Select output file location
  ipcMain.handle(
    IPC_CHANNELS.FILE_SELECT_OUTPUT,
    async (_event, defaultName: string) => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return null

      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Video speichern',
        defaultPath: defaultName,
        filters: [
          { name: 'MP4 Video', extensions: ['mp4'] },
          { name: 'MOV Video', extensions: ['mov'] }
        ]
      })

      if (result.canceled || !result.filePath) {
        return null
      }

      return result.filePath
    }
  )

  // Get app path
  ipcMain.handle(IPC_CHANNELS.FILE_GET_APP_PATH, async () => {
    return app.getAppPath()
  })

  // Write temporary file (used for ASS subtitles during export)
  ipcMain.handle(
    IPC_CHANNELS.FILE_WRITE_TEMP,
    async (_event, filename: string, content: string): Promise<{ success: boolean; filePath?: string; error?: string }> => {
      try {
        // Use app's userData directory for temp files (writable location)
        const tempDir = join(app.getPath('userData'), 'temp')

        // Ensure temp directory exists
        if (!existsSync(tempDir)) {
          mkdirSync(tempDir, { recursive: true })
        }

        const filePath = join(tempDir, filename)
        await writeFile(filePath, content, 'utf-8')

        return { success: true, filePath }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write temp file'
        }
      }
    }
  )

  // Export style profile to JSON file
  ipcMain.handle(
    IPC_CHANNELS.PROFILE_EXPORT,
    async (_event, profileExport: StyleProfileExport, defaultName: string) => {
      const mainWindow = getMainWindow()
      if (!mainWindow) return { success: false, error: 'No main window available' }

      const result = await dialog.showSaveDialog(mainWindow, {
        title: 'Stil-Profil exportieren',
        defaultPath: `${defaultName}.json`,
        filters: [{ name: 'JSON-Dateien', extensions: ['json'] }]
      })

      if (result.canceled || !result.filePath) {
        return { success: false, canceled: true }
      }

      try {
        const jsonContent = JSON.stringify(profileExport, null, 2)
        await writeFile(result.filePath, jsonContent, 'utf-8')
        return { success: true, filePath: result.filePath }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to write file'
        }
      }
    }
  )

  // Get temp directory path
  ipcMain.handle(IPC_CHANNELS.FILE_GET_TEMP_DIR, async () => {
    return app.getPath('temp')
  })

  // Delete a temp file
  ipcMain.handle(
    IPC_CHANNELS.FILE_DELETE_TEMP,
    async (_event, filePath: string): Promise<{ success: boolean; error?: string }> => {
      try {
        // Security check: only allow deletion of files in temp directory
        const tempDir = app.getPath('temp')
        if (!filePath.startsWith(tempDir)) {
          return {
            success: false,
            error: 'File is not in temp directory'
          }
        }

        await unlink(filePath)
        return { success: true }
      } catch (error) {
        // If file doesn't exist, consider it a success (already deleted)
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          return { success: true }
        }
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete temp file'
        }
      }
    }
  )

  // Import style profile from JSON file
  ipcMain.handle(IPC_CHANNELS.PROFILE_IMPORT, async () => {
    const mainWindow = getMainWindow()
    if (!mainWindow) return { success: false, error: 'No main window available' }

    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Stil-Profil importieren',
      properties: ['openFile'],
      filters: [
        { name: 'JSON-Dateien', extensions: ['json'] },
        { name: 'Alle Dateien', extensions: ['*'] }
      ]
    })

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, canceled: true }
    }

    try {
      const fileContent = await readFile(result.filePaths[0], 'utf-8')
      const profileExport: StyleProfileExport = JSON.parse(fileContent)

      // Validate the imported data structure
      if (
        !profileExport.version ||
        !profileExport.profile ||
        !profileExport.profile.id ||
        !profileExport.profile.name ||
        !profileExport.profile.style
      ) {
        return {
          success: false,
          error: 'Ungültiges Profil-Format: Erforderliche Felder fehlen'
        }
      }

      return { success: true, profileExport }
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { success: false, error: 'Ungültiges JSON-Format' }
      }
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      }
    }
  })

  // Get system fonts
  ipcMain.handle(IPC_CHANNELS.FONTS_GET_SYSTEM, async () => {
    return getSystemFonts()
  })
}
