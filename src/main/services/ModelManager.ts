import { app } from 'electron'
import path from 'path'
import fs from 'fs'

/**
 * Information about an available AI model
 */
export interface ModelInfo {
  id: string
  name: string
  size: string
  sizeBytes: number
  quality: 'high' | 'medium' | 'low'
  downloaded: boolean
}

/**
 * Model download progress information
 */
export interface ModelDownloadProgress {
  modelId: string
  percent: number
  downloadedBytes: number
  totalBytes: number
  status: 'downloading' | 'complete' | 'error'
  error?: string
}

/**
 * Mapping from HuggingFace model IDs to WhisperX short names.
 * WhisperX uses short names like 'large-v3', 'medium', 'small'
 * while we store full HuggingFace IDs for model management.
 */
export const MODEL_ID_TO_WHISPER_NAME: Record<string, string> = {
  'mlx-community/whisper-large-v3-mlx': 'large-v3',
  'mlx-community/whisper-medium-mlx': 'medium',
  'mlx-community/whisper-small-mlx': 'small'
}

/**
 * Get the WhisperX short name for a HuggingFace model ID.
 * Falls back to 'large-v3' if model ID is not found.
 */
export function getWhisperModelName(modelId: string): string {
  return MODEL_ID_TO_WHISPER_NAME[modelId] || 'large-v3'
}

/**
 * ModelManager handles checking and managing AI model availability.
 *
 * Models are stored in the HuggingFace cache directory:
 * ~/.cache/huggingface/hub/models--<org>--<model-name>/
 *
 * The actual model download happens automatically when WhisperX loads
 * the model for the first time. This manager just checks if models exist.
 */
export class ModelManager {
  private cacheDir: string

  constructor() {
    // HuggingFace cache directory
    this.cacheDir = path.join(app.getPath('home'), '.cache', 'huggingface', 'hub')
  }

  /**
   * Get the HuggingFace cache directory path
   */
  getCacheDir(): string {
    return this.cacheDir
  }

  /**
   * Get list of available Whisper models with their download status
   */
  getAvailableModels(): ModelInfo[] {
    return [
      {
        id: 'mlx-community/whisper-large-v3-mlx',
        name: 'Whisper Large V3',
        size: '2.9 GB',
        sizeBytes: 2.9 * 1024 * 1024 * 1024,
        quality: 'high',
        downloaded: this.isModelDownloaded('mlx-community--whisper-large-v3-mlx')
      },
      {
        id: 'mlx-community/whisper-medium-mlx',
        name: 'Whisper Medium',
        size: '1.5 GB',
        sizeBytes: 1.5 * 1024 * 1024 * 1024,
        quality: 'medium',
        downloaded: this.isModelDownloaded('mlx-community--whisper-medium-mlx')
      },
      {
        id: 'mlx-community/whisper-small-mlx',
        name: 'Whisper Small',
        size: '0.5 GB',
        sizeBytes: 0.5 * 1024 * 1024 * 1024,
        quality: 'low',
        downloaded: this.isModelDownloaded('mlx-community--whisper-small-mlx')
      }
    ]
  }

  /**
   * Check if a specific model is downloaded in the HuggingFace cache.
   *
   * HuggingFace stores models in: ~/.cache/huggingface/hub/models--<folder>/
   * where <folder> is the model ID with "/" replaced by "--"
   *
   * @param modelFolder The model folder name (e.g., 'mlx-community--whisper-large-v3-mlx')
   */
  isModelDownloaded(modelFolder: string): boolean {
    const modelPath = path.join(this.cacheDir, `models--${modelFolder}`)

    // Check if directory exists
    if (!fs.existsSync(modelPath)) {
      return false
    }

    // Check if it contains actual model files (snapshots directory)
    const snapshotsPath = path.join(modelPath, 'snapshots')
    if (!fs.existsSync(snapshotsPath)) {
      return false
    }

    // Check if there's at least one snapshot with files
    try {
      const snapshots = fs.readdirSync(snapshotsPath)
      if (snapshots.length === 0) {
        return false
      }

      // Check if the first snapshot contains model files
      const firstSnapshot = path.join(snapshotsPath, snapshots[0])
      const files = fs.readdirSync(firstSnapshot)

      // A valid model should have at least some files (config.json, model files, etc.)
      return files.length > 0
    } catch {
      return false
    }
  }

  /**
   * Check if any Whisper model is downloaded and ready to use
   */
  hasAnyModelDownloaded(): boolean {
    return this.getAvailableModels().some(m => m.downloaded)
  }

  /**
   * Get the first downloaded model (for auto-selection)
   */
  getFirstDownloadedModel(): ModelInfo | null {
    return this.getAvailableModels().find(m => m.downloaded) || null
  }

  /**
   * Get model info by ID
   */
  getModelById(modelId: string): ModelInfo | undefined {
    return this.getAvailableModels().find(m => m.id === modelId)
  }

  /**
   * Check if the first-run setup is needed.
   * Returns true if no models are downloaded yet.
   */
  isFirstRunSetupNeeded(): boolean {
    return !this.hasAnyModelDownloaded()
  }

  /**
   * Get the total size of all downloaded models
   */
  getTotalDownloadedSize(): number {
    return this.getAvailableModels()
      .filter(m => m.downloaded)
      .reduce((sum, m) => sum + m.sizeBytes, 0)
  }

  /**
   * Format bytes to human-readable string
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }
}

// Singleton instance
let modelManagerInstance: ModelManager | null = null

/**
 * Get the shared ModelManager instance
 */
export function getModelManager(): ModelManager {
  if (!modelManagerInstance) {
    modelManagerInstance = new ModelManager()
  }
  return modelManagerInstance
}
