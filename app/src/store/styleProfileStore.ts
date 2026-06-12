import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { v4 as uuidv4 } from 'uuid'
import type {
  StyleProfile,
  SubtitleStyle,
  StyleProfileExport,
  StyleValidationResult
} from '@/lib/types'
import { validateAndNormalizeStyle } from '@/lib/types'

const STORAGE_KEY = 'opensub-style-profiles'

// Result of importing a profile
export interface ProfileImportResult {
  profile: StyleProfile | null
  validation: StyleValidationResult | null
}

interface StyleProfileState {
  profiles: StyleProfile[]
  /** User overrides for built-in templates, keyed by template id */
  templateOverrides: Record<string, SubtitleStyle>

  // CRUD Operations
  createProfile: (name: string, style: SubtitleStyle) => StyleProfile
  updateProfile: (id: string, updates: Partial<Pick<StyleProfile, 'name' | 'style'>>) => void
  deleteProfile: (id: string) => void
  getProfile: (id: string) => StyleProfile | undefined

  // Built-in template overrides
  setTemplateOverride: (templateId: string, style: SubtitleStyle) => void
  clearTemplateOverride: (templateId: string) => void

  // Import/Export
  importProfile: (data: StyleProfileExport) => ProfileImportResult
  exportProfile: (id: string) => StyleProfileExport | null

  // Helpers
  hasProfiles: () => boolean
}

export const useStyleProfileStore = create<StyleProfileState>()(
  persist(
    (set, get) => ({
      profiles: [],
      templateOverrides: {},

      setTemplateOverride: (templateId, style) => {
        set((state) => ({
          templateOverrides: { ...state.templateOverrides, [templateId]: { ...style } }
        }))
      },

      clearTemplateOverride: (templateId) => {
        set((state) => {
          const { [templateId]: _removed, ...rest } = state.templateOverrides
          return { templateOverrides: rest }
        })
      },

      createProfile: (name: string, style: SubtitleStyle) => {
        const now = Date.now()
        const profile: StyleProfile = {
          id: uuidv4(),
          name,
          style: { ...style },
          createdAt: now,
          updatedAt: now
        }

        set((state) => ({ profiles: [...state.profiles, profile] }))
        return profile
      },

      updateProfile: (id, updates) => {
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

      deleteProfile: (id) => {
        set((state) => ({
          profiles: state.profiles.filter((profile) => profile.id !== id)
        }))
      },

      getProfile: (id) => {
        return get().profiles.find((profile) => profile.id === id)
      },

      importProfile: (data): ProfileImportResult => {
        if (!data || data.version !== 1 || !data.profile) {
          console.error('Invalid profile import data')
          return { profile: null, validation: null }
        }

        const { profile } = data
        if (!profile.name || !profile.style) {
          console.error('Invalid profile: missing name or style')
          return { profile: null, validation: null }
        }

        const validation = validateAndNormalizeStyle(profile.style as unknown as Record<string, unknown>)

        const now = Date.now()
        const newProfile: StyleProfile = {
          id: uuidv4(),
          name: profile.name,
          style: validation.style,
          createdAt: now,
          updatedAt: now
        }

        set((state) => ({ profiles: [...state.profiles, newProfile] }))
        return { profile: newProfile, validation }
      },

      exportProfile: (id) => {
        const profile = get().profiles.find((p) => p.id === id)
        if (!profile) return null
        return { version: 1, profile: { ...profile } }
      },

      hasProfiles: () => {
        return get().profiles.length > 0
      }
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        profiles: state.profiles,
        templateOverrides: state.templateOverrides
      }),
      // Migrate and validate profiles when loading from storage
      merge: (persistedState, currentState) => {
        const persisted = persistedState as {
          profiles?: StyleProfile[]
          templateOverrides?: Record<string, SubtitleStyle>
        }

        const normalizedProfiles = Array.isArray(persisted?.profiles)
          ? persisted.profiles.map((profile) => {
              if (!profile.style) return profile
              const validation = validateAndNormalizeStyle(profile.style as unknown as Record<string, unknown>)
              return { ...profile, style: validation.style }
            })
          : currentState.profiles

        const normalizedOverrides: Record<string, SubtitleStyle> = {}
        if (persisted?.templateOverrides) {
          for (const [id, style] of Object.entries(persisted.templateOverrides)) {
            const validation = validateAndNormalizeStyle(style as unknown as Record<string, unknown>)
            normalizedOverrides[id] = validation.style
          }
        }

        return { ...currentState, profiles: normalizedProfiles, templateOverrides: normalizedOverrides }
      }
    }
  )
)
