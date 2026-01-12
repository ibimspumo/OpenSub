import { useEffect, useRef, useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useUIStore } from '../store/uiStore'

const AUTO_SAVE_INTERVAL = 30000 // 30 seconds

/**
 * Hook that automatically saves the project every 30 seconds
 * and provides manual save functionality
 */
export function useAutoSave() {
  const { project } = useProjectStore()
  const { setSaveStatus, setLastSavedAt, setHasUnsavedChanges } = useUIStore()

  const lastSavedDataRef = useRef<string | null>(null)
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Save function
  const saveProject = useCallback(async () => {
    if (!project) return

    const currentData = JSON.stringify(project)

    // Don't save if nothing has changed
    if (currentData === lastSavedDataRef.current) {
      return
    }

    try {
      setSaveStatus('saving')

      await window.api.project.save(project)

      // Generate thumbnail if this is a new project (no thumbnail yet)
      // This is done in background, we don't wait for it
      window.api.project.generateThumbnail(project.id, project.videoPath).catch(console.warn)

      lastSavedDataRef.current = currentData
      const now = Date.now()
      setLastSavedAt(now)
      setSaveStatus('saved')
      setHasUnsavedChanges(false)

      // Reset to idle after 2 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 2000)
    } catch (error) {
      console.error('Auto-save failed:', error)
      setSaveStatus('error')

      // Reset to idle after 3 seconds
      setTimeout(() => {
        setSaveStatus('idle')
      }, 3000)
    }
  }, [project, setSaveStatus, setLastSavedAt, setHasUnsavedChanges])

  // Set up auto-save interval
  useEffect(() => {
    if (!project) return

    // Initial save when project is created/loaded
    saveProject()

    // Set up interval
    saveTimeoutRef.current = setInterval(() => {
      saveProject()
    }, AUTO_SAVE_INTERVAL)

    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current)
      }
    }
  }, [project?.id, saveProject])

  // Track unsaved changes when project data changes
  useEffect(() => {
    if (!project) {
      lastSavedDataRef.current = null
      setHasUnsavedChanges(false)
      return
    }

    const currentData = JSON.stringify(project)

    // If we have saved data to compare against, check if there are unsaved changes
    if (lastSavedDataRef.current !== null) {
      const hasChanges = currentData !== lastSavedDataRef.current
      setHasUnsavedChanges(hasChanges)
    }
  }, [project, setHasUnsavedChanges])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearInterval(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    saveProject,
    isNewProject: lastSavedDataRef.current === null
  }
}
