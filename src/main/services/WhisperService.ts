import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { EventEmitter } from 'events'
import { WhisperIPC } from './WhisperIPC'
import { debugInfo, debugError } from './DebugService'
import type {
  WhisperConfig,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgress,
  AlignmentSegment
} from '../../shared/types'

export class WhisperService extends EventEmitter {
  private process: ChildProcess | null = null
  private ipc: WhisperIPC | null = null
  private isReady = false
  private config: WhisperConfig

  constructor(config: Partial<WhisperConfig>) {
    super()
    this.config = {
      model: config.model ?? 'large-v3',
      language: config.language ?? 'de',
      device: config.device ?? 'mps', // MLX backend uses Metal on Apple Silicon
      hfToken: config.hfToken
    }
  }

  /**
   * Get path to Python executable
   */
  private getPythonPath(): string {
    const isDev = !app.isPackaged

    if (isDev) {
      // Development: use local venv in python-service
      return path.join(app.getAppPath(), 'python-service', '.venv', 'bin', 'python')
    }

    // Production: use bundled Python environment (created by scripts/setup-python-env.sh)
    return path.join(process.resourcesPath, 'python-env', 'bin', 'python3')
  }

  /**
   * Get path to Python service script
   */
  private getServicePath(): string {
    const isDev = !app.isPackaged

    if (isDev) {
      return path.join(app.getAppPath(), 'python-service', 'whisper_service', 'main.py')
    }

    return path.join(
      process.resourcesPath,
      'python-service',
      'whisper_service',
      'main.py'
    )
  }

  /**
   * Get path to Python service directory (for PYTHONPATH)
   */
  private getServiceDir(): string {
    const isDev = !app.isPackaged

    if (isDev) {
      return path.join(app.getAppPath(), 'python-service')
    }

    return path.join(process.resourcesPath, 'python-service')
  }

  /**
   * Get PYTHONHOME for production (needed for bundled Python)
   */
  private getPythonHome(): string | undefined {
    const isDev = !app.isPackaged

    if (isDev) {
      return undefined // Not needed in development
    }

    // In production, PYTHONHOME must point to the bundled Python environment
    return path.join(process.resourcesPath, 'python-env')
  }

  /**
   * Get paths to bundled FFmpeg/FFprobe binaries for production
   * These are unpacked from @ffmpeg-installer and @ffprobe-installer
   */
  private getFFmpegPaths(): string[] {
    const isDev = !app.isPackaged

    if (isDev) {
      // In development, assume FFmpeg is in system PATH
      return []
    }

    // In production, FFmpeg binaries are unpacked to app.asar.unpacked
    const arch = process.arch === 'arm64' ? 'darwin-arm64' : 'darwin-x64'
    return [
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffmpeg-installer', arch),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@ffprobe-installer', arch)
    ]
  }

  /**
   * Start the Python WhisperX service
   */
  async start(): Promise<void> {
    debugInfo('python', 'WhisperService.start() called')

    if (this.process) {
      debugError('python', 'WhisperService already running')
      throw new Error('WhisperService already running')
    }

    return new Promise((resolve, reject) => {
      const pythonPath = this.getPythonPath()
      const servicePath = this.getServicePath()
      const serviceDir = this.getServiceDir()
      const pythonHome = this.getPythonHome()
      const ffmpegPaths = this.getFFmpegPaths()

      // Check if paths exist
      const pythonExists = fs.existsSync(pythonPath)
      const serviceExists = fs.existsSync(servicePath)
      const serviceDirExists = fs.existsSync(serviceDir)

      debugInfo('python', 'Python paths', {
        pythonPath,
        pythonExists,
        servicePath,
        serviceExists,
        serviceDir,
        serviceDirExists,
        pythonHome,
        ffmpegPaths,
        isPackaged: app.isPackaged
      })

      if (!pythonExists) {
        const err = new Error(`Python not found at: ${pythonPath}`)
        debugError('python', err.message)
        reject(err)
        return
      }

      if (!serviceExists) {
        const err = new Error(`Service script not found at: ${servicePath}`)
        debugError('python', err.message)
        reject(err)
        return
      }

      const timeout = setTimeout(() => {
        debugError('python', 'WhisperService startup timeout after 5 minutes')
        reject(new Error('WhisperService startup timeout'))
      }, 300000) // 5 min timeout for model loading (first run may need to download models)

      console.log(`Starting WhisperX service: ${pythonPath} ${servicePath}`)
      console.log(`PYTHONPATH: ${serviceDir}`)
      console.log(`PYTHONHOME: ${pythonHome || '(not set)'}`)
      console.log(`FFmpeg paths: ${ffmpegPaths.join(':')}`)

      // Build environment variables
      const env: NodeJS.ProcessEnv = {
        ...process.env,
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: serviceDir,
        HF_TOKEN: this.config.hfToken || process.env.HF_TOKEN || ''
      }

      // Set PYTHONHOME in production to tell Python where its stdlib is
      if (pythonHome) {
        env.PYTHONHOME = pythonHome
      }

      // Add bundled FFmpeg to PATH in production
      if (ffmpegPaths.length > 0) {
        const existingPath = env.PATH || ''
        env.PATH = [...ffmpegPaths, existingPath].join(':')
        debugInfo('python', 'Updated PATH with FFmpeg', { PATH: env.PATH })
      }

      debugInfo('python', 'Spawning Python process...')

      this.process = spawn(pythonPath, [servicePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: serviceDir,
        env
      })

      debugInfo('python', 'Python process spawned', { pid: this.process.pid })

      if (!this.process.stdin || !this.process.stdout) {
        clearTimeout(timeout)
        const err = new Error('Failed to create stdio streams')
        debugError('python', err.message)
        reject(err)
        return
      }

      // Set up IPC handler
      this.ipc = new WhisperIPC(this.process.stdin, this.process.stdout)
      debugInfo('python', 'WhisperIPC handler created, waiting for ready event...')

      // Handle notifications from Python
      this.ipc.on('ready', (params) => {
        debugInfo('python', 'Received ready event from Python', params)
        console.log('WhisperX service ready:', params)
        clearTimeout(timeout)
        this.isReady = true
        this.emit('ready')
        resolve()
      })

      this.ipc.on('progress', (params: TranscriptionProgress) => {
        this.emit('progress', params)
      })

      // Handle stderr for logging - emit to renderer for debug display
      this.process.stderr?.on('data', (data) => {
        const logLine = data.toString().trim()
        console.log('[WhisperX]', logLine)
        // Log to debug service as well
        debugInfo('python', `[stderr] ${logLine}`)
        // Emit debug log event for renderer to display
        this.emit('debug-log', logLine)
      })

      // Handle process errors
      this.process.on('error', (error) => {
        clearTimeout(timeout)
        debugError('python', 'Python process error', { error: error.message })
        console.error('WhisperX process error:', error)
        this.emit('error', error)
        reject(error)
      })

      this.process.on('exit', (code, signal) => {
        debugInfo('python', `Python process exited`, { code, signal })
        console.log(`WhisperX process exited: code=${code}, signal=${signal}`)
        this.process = null
        this.ipc = null
        this.isReady = false
        this.emit('exit', { code, signal })
      })
    })
  }

  /**
   * Initialize WhisperX models
   */
  async initialize(): Promise<void> {
    if (!this.ipc) throw new Error('Service not started')

    await this.ipc.call('initialize', {
      model: this.config.model,
      language: this.config.language,
      device: this.config.device,
      hf_token: this.config.hfToken
    })
  }

  /**
   * Transcribe audio file with word-level timestamps
   */
  async transcribe(
    audioPath: string,
    options: TranscriptionOptions = {}
  ): Promise<TranscriptionResult> {
    if (!this.ipc) throw new Error('Service not started')

    return this.ipc.call('transcribe', {
      audio_path: audioPath,
      language: options.language || this.config.language
    })
  }

  /**
   * Forced alignment: align given text with audio for word-level timestamps.
   * Used after AI corrections to get accurate timing for corrected text.
   */
  async align(
    audioPath: string,
    segments: AlignmentSegment[]
  ): Promise<TranscriptionResult> {
    if (!this.ipc) throw new Error('Service not started')

    return this.ipc.call('align', {
      audio_path: audioPath,
      segments: segments
    })
  }

  /**
   * Cancel ongoing transcription
   */
  async cancel(): Promise<void> {
    if (!this.ipc) throw new Error('Service not started')
    await this.ipc.call('cancel', {})
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{ initialized: boolean; processing: boolean }> {
    if (!this.ipc) throw new Error('Service not started')
    return this.ipc.call('get_status', {})
  }

  /**
   * Stop the service gracefully
   */
  async stop(): Promise<void> {
    if (!this.process || !this.ipc) return

    try {
      await this.ipc.call('shutdown', {})
    } catch (e) {
      // Ignore shutdown errors
    }

    // Give it a moment to clean up
    await new Promise((resolve) => setTimeout(resolve, 1000))

    if (this.process) {
      this.process.kill('SIGTERM')

      // Force kill after 5 seconds
      setTimeout(() => {
        if (this.process) {
          this.process.kill('SIGKILL')
        }
      }, 5000)
    }
  }
}
