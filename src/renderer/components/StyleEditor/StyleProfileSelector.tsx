import { useState, useCallback } from 'react'
import { useStyleProfileStore } from '../../store/styleProfileStore'
import type { SubtitleStyle } from '../../../shared/types'

// Icons
const SaveIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
  </svg>
)

const TrashIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
)

const ImportIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
  </svg>
)

const ExportIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
  </svg>
)

const ProfileIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
)

const CheckIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
)

const CloseIcon = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
)

interface StyleProfileSelectorProps {
  currentStyle: SubtitleStyle
  onApplyProfile: (style: SubtitleStyle) => void
}

export default function StyleProfileSelector({
  currentStyle,
  onApplyProfile
}: StyleProfileSelectorProps) {
  const { profiles, createProfile, deleteProfile, exportProfile, importProfile } =
    useStyleProfileStore()

  const [selectedProfileId, setSelectedProfileId] = useState<string>('')
  const [isCreating, setIsCreating] = useState(false)
  const [newProfileName, setNewProfileName] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Show feedback message temporarily
  const showFeedback = useCallback((type: 'success' | 'error', message: string) => {
    setFeedback({ type, message })
    setTimeout(() => setFeedback(null), 3000)
  }, [])

  // Handle profile selection change
  const handleProfileChange = useCallback(
    (profileId: string) => {
      setSelectedProfileId(profileId)
      if (profileId) {
        const profile = profiles.find((p) => p.id === profileId)
        if (profile) {
          onApplyProfile(profile.style)
          showFeedback('success', `Profil "${profile.name}" angewendet`)
        }
      }
    },
    [profiles, onApplyProfile, showFeedback]
  )

  // Handle save new profile
  const handleSaveProfile = useCallback(() => {
    if (!newProfileName.trim()) {
      showFeedback('error', 'Bitte gib einen Namen ein')
      return
    }

    const profile = createProfile(newProfileName.trim(), currentStyle)
    setSelectedProfileId(profile.id)
    setNewProfileName('')
    setIsCreating(false)
    showFeedback('success', `Profil "${profile.name}" gespeichert`)
  }, [newProfileName, currentStyle, createProfile, showFeedback])

  // Handle delete profile
  const handleDeleteProfile = useCallback(() => {
    if (!selectedProfileId) return

    const profile = profiles.find((p) => p.id === selectedProfileId)
    if (!profile) return

    if (confirm(`Möchtest du das Profil "${profile.name}" wirklich löschen?`)) {
      deleteProfile(selectedProfileId)
      setSelectedProfileId('')
      showFeedback('success', `Profil "${profile.name}" gelöscht`)
    }
  }, [selectedProfileId, profiles, deleteProfile, showFeedback])

  // Handle export profile
  const handleExportProfile = useCallback(async () => {
    if (!selectedProfileId) {
      showFeedback('error', 'Bitte wähle zuerst ein Profil aus')
      return
    }

    const profileExport = exportProfile(selectedProfileId)
    if (!profileExport) {
      showFeedback('error', 'Profil nicht gefunden')
      return
    }

    setIsLoading(true)
    try {
      const result = await window.api.file.exportProfile(
        profileExport,
        `${profileExport.profile.name}.json`
      )

      if (result.canceled) {
        // User canceled, no feedback needed
      } else if (result.success) {
        showFeedback('success', 'Profil erfolgreich exportiert')
      } else {
        showFeedback('error', result.error || 'Export fehlgeschlagen')
      }
    } catch (err) {
      showFeedback('error', 'Export fehlgeschlagen')
      console.error('Export error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [selectedProfileId, exportProfile, showFeedback])

  // Handle import profile
  const handleImportProfile = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await window.api.file.importProfile()

      if (result.canceled) {
        // User canceled, no feedback needed
      } else if (result.success && result.profileExport) {
        const imported = importProfile(result.profileExport)
        if (imported) {
          setSelectedProfileId(imported.id)
          showFeedback('success', `Profil "${imported.name}" importiert`)
        } else {
          showFeedback('error', 'Ungültiges Profil-Format')
        }
      } else {
        showFeedback('error', result.error || 'Import fehlgeschlagen')
      }
    } catch (err) {
      showFeedback('error', 'Import fehlgeschlagen')
      console.error('Import error:', err)
    } finally {
      setIsLoading(false)
    }
  }, [importProfile, showFeedback])

  // Cancel creating new profile
  const handleCancelCreate = useCallback(() => {
    setIsCreating(false)
    setNewProfileName('')
  }, [])

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.06] text-dark-400">
          <ProfileIcon />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase text-dark-400">
          Stil-Profile
        </span>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          className={`
            flex items-center gap-2 px-3 py-2 rounded-lg text-xs animate-fade-in
            ${feedback.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
            }
          `}
        >
          {feedback.type === 'success' ? (
            <CheckIcon />
          ) : (
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Profile dropdown */}
      <div className="relative">
        <select
          value={selectedProfileId}
          onChange={(e) => handleProfileChange(e.target.value)}
          disabled={isLoading}
          className={`
            w-full h-9 px-3 pr-8 rounded-lg text-sm
            bg-dark-800/60 text-dark-200
            border border-white/[0.08] hover:border-white/[0.12]
            focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40
            transition-all duration-200 cursor-pointer
            appearance-none
            disabled:opacity-50 disabled:cursor-not-allowed
          `}
        >
          <option value="" className="bg-dark-800">
            — Profil auswählen —
          </option>
          {profiles.map((profile) => (
            <option key={profile.id} value={profile.id} className="bg-dark-800">
              {profile.name}
            </option>
          ))}
        </select>
        {/* Custom dropdown arrow */}
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none">
          <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      {/* Save new profile section */}
      {isCreating ? (
        <div className="space-y-2 animate-fade-in">
          <input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profilname eingeben..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveProfile()
              if (e.key === 'Escape') handleCancelCreate()
            }}
            className={`
              w-full h-9 px-3 rounded-lg text-sm
              bg-dark-800/60 text-dark-200 placeholder-dark-500
              border border-white/[0.08] hover:border-white/[0.12]
              focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500/40
              transition-all duration-200
            `}
          />
          <div className="flex gap-2">
            <button
              onClick={handleSaveProfile}
              className={`
                flex-1 flex items-center justify-center gap-1.5
                h-8 px-3 rounded-lg text-xs font-medium
                bg-primary-600 text-white
                hover:bg-primary-500
                active:scale-[0.98]
                transition-all duration-200
              `}
            >
              <CheckIcon />
              Speichern
            </button>
            <button
              onClick={handleCancelCreate}
              className={`
                flex items-center justify-center
                h-8 w-8 rounded-lg text-xs font-medium
                bg-dark-800/60 text-dark-400
                border border-white/[0.04]
                hover:bg-dark-700/60 hover:text-dark-300
                active:scale-[0.98]
                transition-all duration-200
              `}
            >
              <CloseIcon />
            </button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div className="grid grid-cols-2 gap-2">
          {/* Save as Profile */}
          <button
            onClick={() => setIsCreating(true)}
            disabled={isLoading}
            className={`
              flex items-center justify-center gap-1.5
              h-8 px-2 rounded-lg text-xs font-medium
              bg-primary-600/80 text-white
              hover:bg-primary-500
              active:scale-[0.98]
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <SaveIcon />
            <span>Speichern</span>
          </button>

          {/* Delete Profile */}
          <button
            onClick={handleDeleteProfile}
            disabled={!selectedProfileId || isLoading}
            className={`
              flex items-center justify-center gap-1.5
              h-8 px-2 rounded-lg text-xs font-medium
              bg-dark-800/60 text-dark-400
              border border-white/[0.04]
              hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20
              active:scale-[0.98]
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-dark-800/60 disabled:hover:text-dark-400 disabled:hover:border-white/[0.04]
            `}
          >
            <TrashIcon />
            <span>Löschen</span>
          </button>

          {/* Import Profile */}
          <button
            onClick={handleImportProfile}
            disabled={isLoading}
            className={`
              flex items-center justify-center gap-1.5
              h-8 px-2 rounded-lg text-xs font-medium
              bg-dark-800/60 text-dark-400
              border border-white/[0.04]
              hover:bg-dark-700/60 hover:text-dark-300 hover:border-white/[0.08]
              active:scale-[0.98]
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <ImportIcon />
            <span>Import</span>
          </button>

          {/* Export Profile */}
          <button
            onClick={handleExportProfile}
            disabled={!selectedProfileId || isLoading}
            className={`
              flex items-center justify-center gap-1.5
              h-8 px-2 rounded-lg text-xs font-medium
              bg-dark-800/60 text-dark-400
              border border-white/[0.04]
              hover:bg-dark-700/60 hover:text-dark-300 hover:border-white/[0.08]
              active:scale-[0.98]
              transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
            `}
          >
            <ExportIcon />
            <span>Export</span>
          </button>
        </div>
      )}

      {/* Profile count indicator */}
      {profiles.length > 0 && (
        <p className="text-[10px] text-dark-500 text-center">
          {profiles.length} {profiles.length === 1 ? 'Profil' : 'Profile'} gespeichert
        </p>
      )}
    </div>
  )
}
