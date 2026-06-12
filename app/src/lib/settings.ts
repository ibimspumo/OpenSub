/**
 * App settings backed by tauri-plugin-store (settings.json in app data dir).
 * The Rust backend reads the same file (e.g. for the OpenRouter API key).
 */

import { LazyStore } from '@tauri-apps/plugin-store'
import type { AppSettings } from './types'

const store = new LazyStore('settings.json')

export async function getSettings(): Promise<AppSettings> {
  const entries = await store.entries()
  return Object.fromEntries(entries) as AppSettings
}

export async function getSetting<K extends keyof AppSettings>(
  key: K
): Promise<AppSettings[K] | undefined> {
  return (await store.get(key)) as AppSettings[K] | undefined
}

export async function setSettings(settings: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(settings)) {
    if (value === undefined) {
      await store.delete(key)
    } else {
      await store.set(key, value)
    }
  }
  await store.save()
}
