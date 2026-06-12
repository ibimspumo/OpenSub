import { create } from 'zustand'
import { check, type Update } from '@tauri-apps/plugin-updater'
import { relaunch } from '@tauri-apps/plugin-process'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'upToDate'
  | 'error'

interface UpdateState {
  status: UpdateStatus
  /** Version of the available update (e.g. "1.0.0") */
  availableVersion: string | null
  /** Release notes of the available update */
  releaseNotes: string | null
  downloadPercent: number
  lastCheckedAt: number | null
  /** Toast was dismissed — title bar indicator stays visible */
  toastDismissed: boolean

  checkForUpdates: (opts?: { manual?: boolean }) => Promise<void>
  install: () => Promise<void>
  restart: () => Promise<void>
  dismissToast: () => void
}

/** The Update handle is not serializable — kept outside the store. */
let pendingUpdate: Update | null = null

export const useUpdateStore = create<UpdateState>((set, get) => ({
  status: 'idle',
  availableVersion: null,
  releaseNotes: null,
  downloadPercent: 0,
  lastCheckedAt: null,
  toastDismissed: false,

  checkForUpdates: async ({ manual = false } = {}) => {
    const { status } = get()
    // Never interrupt a running download or a pending restart
    if (status === 'checking' || status === 'downloading' || status === 'ready') return

    if (manual) set({ status: 'checking' })
    try {
      const update = await check()
      if (update) {
        pendingUpdate = update
        set({
          status: 'available',
          availableVersion: update.version,
          releaseNotes: update.body ?? null,
          lastCheckedAt: Date.now()
        })
      } else {
        pendingUpdate = null
        set({
          status: manual ? 'upToDate' : 'idle',
          availableVersion: null,
          releaseNotes: null,
          lastCheckedAt: Date.now()
        })
      }
    } catch (err) {
      // Background checks fail silently (offline, no release yet)
      console.error('Update check failed:', err)
      if (manual) set({ status: 'error', lastCheckedAt: Date.now() })
    }
  },

  install: async () => {
    const update = pendingUpdate
    if (!update || get().status !== 'available') return

    let downloaded = 0
    let total = 0
    set({ status: 'downloading', downloadPercent: 0 })
    try {
      await update.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          total = event.data.contentLength ?? 0
        } else if (event.event === 'Progress') {
          downloaded += event.data.chunkLength
          set({ downloadPercent: total > 0 ? (downloaded / total) * 100 : 0 })
        }
      })
      set({ status: 'ready', downloadPercent: 100 })
    } catch (err) {
      console.error('Update install failed:', err)
      set({ status: 'error' })
    }
  },

  restart: async () => {
    await relaunch()
  },

  dismissToast: () => set({ toastDismissed: true })
}))
