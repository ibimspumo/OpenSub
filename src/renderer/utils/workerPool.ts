/**
 * Worker Pool for parallel frame rendering
 * Manages multiple Web Workers and distributes rendering tasks across them
 */

import type { Subtitle, SubtitleStyle } from '../../shared/types'

interface RenderTask {
  id: number
  width: number
  height: number
  currentTime: number
  subtitles: Subtitle[]
  style: SubtitleStyle
  startTime: number
  endTime: number
}

interface RenderResult {
  id: number
  success: boolean
  data?: string
  startTime: number
  endTime: number
  error?: string
}

interface WorkerState {
  worker: Worker
  busy: boolean
  index: number
}

export interface FrameResult {
  startTime: number
  endTime: number
  dataUrl: string
}

export class FrameRenderWorkerPool {
  private workers: WorkerState[] = []
  private poolSize: number
  private initialized = false

  constructor(poolSize?: number) {
    // Default to number of logical processors, capped at 10
    // M2 Max has 12 cores, we leave 2 for system/main thread
    this.poolSize = poolSize ?? Math.min(navigator.hardwareConcurrency || 4, 10)
  }

  /**
   * Initialize the worker pool
   */
  async initialize(): Promise<void> {
    if (this.initialized) return

    const workerPromises: Promise<void>[] = []

    for (let i = 0; i < this.poolSize; i++) {
      const worker = new Worker(
        new URL('../workers/frameRenderWorker.ts', import.meta.url),
        { type: 'module' }
      )

      const workerState: WorkerState = {
        worker,
        busy: false,
        index: i
      }

      this.workers.push(workerState)

      // Wait for worker to be ready
      const readyPromise = new Promise<void>((resolve) => {
        const handler = (e: MessageEvent) => {
          if (e.data.type === 'ready') {
            worker.removeEventListener('message', handler)
            resolve()
          }
        }
        worker.addEventListener('message', handler)
        worker.postMessage({ type: 'init', workerIndex: i })
      })

      workerPromises.push(readyPromise)
    }

    await Promise.all(workerPromises)
    this.initialized = true
    console.log(`Worker pool initialized with ${this.poolSize} workers`)
  }

  /**
   * Render frames in parallel using all workers
   */
  async renderFrames(
    tasks: Omit<RenderTask, 'id'>[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<FrameResult[]> {
    if (!this.initialized) {
      await this.initialize()
    }

    if (tasks.length === 0) return []

    // Add IDs to tasks
    const tasksWithIds: RenderTask[] = tasks.map((task, index) => ({
      ...task,
      id: index
    }))

    // Split tasks among workers
    const tasksPerWorker = Math.ceil(tasksWithIds.length / this.poolSize)
    const taskChunks: RenderTask[][] = []

    for (let i = 0; i < this.poolSize; i++) {
      const start = i * tasksPerWorker
      const end = Math.min(start + tasksPerWorker, tasksWithIds.length)
      if (start < tasksWithIds.length) {
        taskChunks.push(tasksWithIds.slice(start, end))
      }
    }

    // Track progress across all workers
    let totalCompleted = 0
    const totalTasks = tasksWithIds.length

    // Process chunks in parallel
    const resultPromises = taskChunks.map((chunk, workerIndex) => {
      return new Promise<RenderResult[]>((resolve, reject) => {
        const worker = this.workers[workerIndex].worker

        const handleMessage = (e: MessageEvent) => {
          if (e.data.type === 'progress') {
            // Update progress (approximate, since workers report independently)
            if (onProgress) {
              totalCompleted = Math.min(
                totalCompleted + e.data.completed,
                totalTasks
              )
              onProgress(totalCompleted, totalTasks)
            }
          } else if (e.data.type === 'results') {
            worker.removeEventListener('message', handleMessage)
            resolve(e.data.results)
          }
        }

        const handleError = (error: ErrorEvent) => {
          worker.removeEventListener('message', handleMessage)
          worker.removeEventListener('error', handleError)
          reject(new Error(`Worker ${workerIndex} error: ${error.message}`))
        }

        worker.addEventListener('message', handleMessage)
        worker.addEventListener('error', handleError)
        worker.postMessage({ type: 'render', tasks: chunk })
      })
    })

    // Wait for all workers to complete
    const allResults = await Promise.all(resultPromises)

    // Flatten and sort results by ID to maintain order
    const flatResults = allResults.flat().sort((a, b) => a.id - b.id)

    // Convert to FrameResult format, filtering out failed renders
    const frames: FrameResult[] = []
    for (const result of flatResults) {
      if (result.success && result.data) {
        frames.push({
          startTime: result.startTime,
          endTime: result.endTime,
          dataUrl: result.data
        })
      }
    }

    // Final progress update
    if (onProgress) {
      onProgress(totalTasks, totalTasks)
    }

    return frames
  }

  /**
   * Terminate all workers
   */
  terminate(): void {
    for (const workerState of this.workers) {
      workerState.worker.terminate()
    }
    this.workers = []
    this.initialized = false
  }

  /**
   * Get the number of workers in the pool
   */
  get size(): number {
    return this.poolSize
  }
}

// Singleton instance for reuse
let poolInstance: FrameRenderWorkerPool | null = null

/**
 * Get or create the shared worker pool instance
 */
export function getWorkerPool(): FrameRenderWorkerPool {
  if (!poolInstance) {
    poolInstance = new FrameRenderWorkerPool()
  }
  return poolInstance
}

/**
 * Terminate the shared worker pool
 */
export function terminateWorkerPool(): void {
  if (poolInstance) {
    poolInstance.terminate()
    poolInstance = null
  }
}
