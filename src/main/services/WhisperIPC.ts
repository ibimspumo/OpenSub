import { Readable, Writable } from 'stream'
import { EventEmitter } from 'events'
import readline from 'readline'

interface PendingRequest {
  resolve: (result: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

export class WhisperIPC extends EventEmitter {
  private stdin: Writable
  private stdout: Readable
  private pendingRequests = new Map<number, PendingRequest>()
  private nextId = 1
  private rl: readline.Interface

  constructor(stdin: Writable, stdout: Readable) {
    super()
    this.stdin = stdin
    this.stdout = stdout

    // Create readline interface for line-by-line JSON parsing
    this.rl = readline.createInterface({
      input: stdout,
      crlfDelay: Infinity
    })

    this.rl.on('line', (line) => {
      this.handleMessage(line)
    })
  }

  /**
   * Send JSON-RPC request and await response
   */
  call<T = unknown>(method: string, params: object, timeout = 300000): Promise<T> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++

      const request = {
        jsonrpc: '2.0',
        method,
        params,
        id
      }

      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(id)
        reject(new Error(`Request timeout: ${method}`))
      }, timeout)

      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout: timeoutHandle
      })

      this.stdin.write(JSON.stringify(request) + '\n')
    })
  }

  /**
   * Send notification (no response expected)
   */
  notify(method: string, params: object): void {
    const notification = {
      jsonrpc: '2.0',
      method,
      params
    }
    this.stdin.write(JSON.stringify(notification) + '\n')
  }

  /**
   * Handle incoming JSON-RPC message
   */
  private handleMessage(line: string): void {
    try {
      const message = JSON.parse(line)

      // Check if it's a response (has id)
      if ('id' in message && message.id !== null) {
        const pending = this.pendingRequests.get(message.id)
        if (pending) {
          clearTimeout(pending.timeout)
          this.pendingRequests.delete(message.id)

          if ('error' in message) {
            pending.reject(new Error(message.error.message))
          } else {
            pending.resolve(message.result)
          }
        }
      }
      // Otherwise it's a notification from Python
      else if ('method' in message) {
        this.emit(message.method, message.params)
      }
    } catch (e) {
      console.error('Failed to parse JSON-RPC message:', line, e)
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.rl.close()
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('IPC destroyed'))
    }
    this.pendingRequests.clear()
  }
}
