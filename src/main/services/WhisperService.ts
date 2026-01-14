import { spawn, ChildProcess } from 'child_process'
import { app } from 'electron'
import path from 'path'
import { EventEmitter } from 'events'
import { WhisperIPC } from './WhisperIPC'
import type {
  WhisperConfig,
  TranscriptionOptions,
  TranscriptionResult,
  TranscriptionProgress
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
      // Development: use venv Python
      return path.join(app.getAppPath(), 'python-service', '.venv', 'bin', 'python')
    }

    // Production: use bundled Python
    return path.join(process.resourcesPath, 'python-service', '.venv', 'bin', 'python')
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
   * Start the Python WhisperX service
   */
  async start(): Promise<void> {
    if (this.process) {
      throw new Error('WhisperService already running')
    }

    return new Promise((resolve, reject) => {
      const pythonPath = this.getPythonPath()
      const servicePath = this.getServicePath()

      const timeout = setTimeout(() => {
        reject(new Error('WhisperService startup timeout'))
      }, 300000) // 5 min timeout for model loading (first run may need to download models)

      const serviceDir = this.getServiceDir()
      console.log(`Starting WhisperX service: ${pythonPath} ${servicePath}`)
      console.log(`PYTHONPATH: ${serviceDir}`)

      this.process = spawn(pythonPath, [servicePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        cwd: serviceDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PYTHONPATH: serviceDir,
          HF_TOKEN: this.config.hfToken || process.env.HF_TOKEN || ''
        }
      })

      if (!this.process.stdin || !this.process.stdout) {
        clearTimeout(timeout)
        reject(new Error('Failed to create stdio streams'))
        return
      }

      // Set up IPC handler
      this.ipc = new WhisperIPC(this.process.stdin, this.process.stdout)

      // Handle notifications from Python
      this.ipc.on('ready', (params) => {
        console.log('WhisperX service ready:', params)
        clearTimeout(timeout)
        this.isReady = true
        this.emit('ready')
        resolve()
      })

      this.ipc.on('progress', (params: TranscriptionProgress) => {
        this.emit('progress', params)
      })

      // Handle stderr for logging
      this.process.stderr?.on('data', (data) => {
        console.log('[WhisperX]', data.toString().trim())
      })

      // Handle process errors
      this.process.on('error', (error) => {
        clearTimeout(timeout)
        console.error('WhisperX process error:', error)
        this.emit('error', error)
        reject(error)
      })

      this.process.on('exit', (code, signal) => {
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
