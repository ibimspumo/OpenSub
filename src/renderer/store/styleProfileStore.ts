import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type { StyleProfile, SubtitleStyle, StyleProfileExport } from '../../shared/types'

const STORAGE_KEY = 'opensub-style-profiles'

interface StyleProfileState {
  profiles: StyleProfile[]

  // CRUD Operations
  createProfile: (name: string, style: SubtitleStyle) => StyleProfile
  updateProfile: (id: string, updates: Partial<Pick<StyleProfile, 'name' | 'style'>>) => void
  deleteProfile: (id: string) => void
  getProfile: (id: string) => StyleProfile | undefined

  // Import/Export
  importProfile: (data: StyleProfileExport) => StyleProfile | null
  exportProfile: (id: string) => StyleProfileExport | null

  // Helpers
  hasProfiles: () => boolean
}

export const useStyleProfileStore = create<StyleProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],

      createProfile: (name: string, style: SubtitleStyle) => {
        const now = Date.now()
        const profile: StyleProfile = {
          id: uuidv4(),
          name,
          style: { ...style },
          createdAt: now,
          updatedAt: now
        }

        set((state) => ({
          profiles: [...state.profiles, profile]
        }))

        return profile
      },

      updateProfile: (id: string, updates: Partial<Pick<StyleProfile, 'name' | 'style'>>) => {
        set((state) => ({
          profiles: state.profiles.map((profile) =>
            profile.id === id
              ? {
                  ...profile,
                  ...(updates.name !== undefined && { name: updates.name }),
                  ...(updates.style !== undefined && { style: { ...updates.style } }),
                  updatedAt: Date.now()
                }
              : profile
          )
        }))
      },

      deleteProfile: (id: string) => {
        set((state) => ({
          profiles: state.profiles.filter((profile) => profile.id !== id)
        }))
      },

      getProfile: (id: string) => {
        return get().profiles.find((profile) => profile.id === id)
      },

      importProfile: (data: StyleProfileExport) => {
        // Validate the import data structure
        if (!data || data.version !== 1 || !data.profile) {
          console.error('Invalid profile import data')
          return null
        }

        const { profile } = data

        // Validate required fields
        if (!profile.name || !profile.style) {
          console.error('Invalid profile: missing name or style')
          return null
        }

        // Create a new profile with a fresh ID to avoid duplicates
        const now = Date.now()
        const newProfile: StyleProfile = {
          id: uuidv4(),
          name: profile.name,
          style: { ...profile.style },
          createdAt: now,
          updatedAt: now
        }

        set((state) => ({
          profiles: [...state.profiles, newProfile]
        }))

        return newProfile
      },

      exportProfile: (id: string) => {
        const profile = get().profiles.find((p) => p.id === id)
        if (!profile) {
          return null
        }

        const exportData: StyleProfileExport = {
          version: 1,
          profile: { ...profile }
        }

        return exportData
      },

      hasProfiles: () => {
        return get().profiles.length > 0
      }
    }),
    {
      name: STORAGE_KEY,
      // Only persist the profiles array
      partialize: (state) => ({ profiles: state.profiles })
    }
  )
)
