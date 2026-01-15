import { useState, useCallback } from 'react'
import { useStyleProfileStore } from '../../store/styleProfileStore'
import type { SubtitleStyle } from '../../../shared/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import {
  Save,
  Trash2,
  Upload,
  Download,
  FolderOpen,
  Check,
  X,
  AlertCircle
} from 'lucide-react'

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

    if (confirm(`Moechtest du das Profil "${profile.name}" wirklich loeschen?`)) {
      deleteProfile(selectedProfileId)
      setSelectedProfileId('')
      showFeedback('success', `Profil "${profile.name}" geloescht`)
    }
  }, [selectedProfileId, profiles, deleteProfile, showFeedback])

  // Handle export profile
  const handleExportProfile = useCallback(async () => {
    if (!selectedProfileId) {
      showFeedback('error', 'Bitte waehle zuerst ein Profil aus')
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
        const { profile: imported, validation } = importProfile(result.profileExport)
        if (imported) {
          setSelectedProfileId(imported.id)

          // Show appropriate feedback based on validation results
          if (validation?.hasIssues) {
            const issues: string[] = []
            if (validation.unknownProperties.length > 0) {
              issues.push(`${validation.unknownProperties.length} nicht unterstuetzte Eigenschaften entfernt`)
            }
            if (validation.missingProperties.length > 0) {
              issues.push(`${validation.missingProperties.length} fehlende Eigenschaften mit Standardwerten ergaenzt`)
            }
            showFeedback('success', `Profil "${imported.name}" importiert (${issues.join(', ')})`)
          } else {
            showFeedback('success', `Profil "${imported.name}" importiert`)
          }
        } else {
          showFeedback('error', 'Ungueltiges Profil-Format')
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
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground">
          <FolderOpen className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          Stil-Profile
        </span>
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-2 rounded-lg text-xs animate-fade-in',
            feedback.type === 'success'
              ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
              : 'bg-destructive/10 border border-destructive/20 text-destructive'
          )}
        >
          {feedback.type === 'success' ? (
            <Check className="w-4 h-4" />
          ) : (
            <AlertCircle className="w-4 h-4" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Profile dropdown using ShadCN Select */}
      <Select
        value={selectedProfileId}
        onValueChange={handleProfileChange}
        disabled={isLoading}
      >
        <SelectTrigger className="w-full h-9 bg-muted/60 border-input hover:border-ring">
          <SelectValue placeholder="— Profil auswaehlen —" />
        </SelectTrigger>
        <SelectContent>
          {profiles.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              Keine Profile vorhanden
            </div>
          ) : (
            profiles.map((profile) => (
              <SelectItem key={profile.id} value={profile.id}>
                {profile.name}
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>

      {/* Save new profile section */}
      {isCreating ? (
        <div className="space-y-2 animate-fade-in">
          <Input
            type="text"
            value={newProfileName}
            onChange={(e) => setNewProfileName(e.target.value)}
            placeholder="Profilname eingeben..."
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveProfile()
              if (e.key === 'Escape') handleCancelCreate()
            }}
            className="h-9 bg-muted/60"
          />
          <div className="flex gap-2">
            <Button
              onClick={handleSaveProfile}
              size="sm"
              className="flex-1 h-8"
            >
              <Check className="w-4 h-4" />
              Speichern
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={handleCancelCreate}
              className="h-8 w-8 bg-muted/60"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        /* Action buttons */
        <div className="grid grid-cols-2 gap-2">
          {/* Save as Profile */}
          <Button
            onClick={() => setIsCreating(true)}
            disabled={isLoading}
            size="sm"
            className="h-8"
          >
            <Save className="w-4 h-4" />
            <span>Speichern</span>
          </Button>

          {/* Delete Profile */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteProfile}
            disabled={!selectedProfileId || isLoading}
            className={cn(
              'h-8 bg-muted/60',
              selectedProfileId && 'hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20'
            )}
          >
            <Trash2 className="w-4 h-4" />
            <span>Loeschen</span>
          </Button>

          {/* Import Profile */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportProfile}
            disabled={isLoading}
            className="h-8 bg-muted/60"
          >
            <Upload className="w-4 h-4" />
            <span>Import</span>
          </Button>

          {/* Export Profile */}
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportProfile}
            disabled={!selectedProfileId || isLoading}
            className="h-8 bg-muted/60"
          >
            <Download className="w-4 h-4" />
            <span>Export</span>
          </Button>
        </div>
      )}

      {/* Profile count indicator */}
      {profiles.length > 0 && (
        <p className="text-[10px] text-muted-foreground text-center">
          {profiles.length} {profiles.length === 1 ? 'Profil' : 'Profile'} gespeichert
        </p>
      )}
    </div>
  )
}
