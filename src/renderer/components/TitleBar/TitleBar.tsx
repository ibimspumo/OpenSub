import { useState, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import SaveIndicator from '../SaveIndicator/SaveIndicator'
import InlineProjectNameEditor from './InlineProjectNameEditor'

interface TitleBarProps {
  isAppMounted: boolean
  onExport: () => void
}

/**
 * Title bar component with:
 * - Clickable logo/app name to navigate home (with unsaved changes warning)
 * - Inline project name editing
 * - Save indicator
 * - Export and new project buttons
 */
export default function TitleBar({ isAppMounted, onExport }: TitleBarProps) {
  const { project, hasProject, clearProject, renameProject } = useProjectStore()
  const { hasUnsavedChanges } = useUIStore()
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

  // Handle logo click - navigate home with unsaved warning if needed
  const handleLogoClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation() // Prevent window drag

    if (!hasProject()) return

    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      clearProject()
    }
  }, [hasProject, hasUnsavedChanges, clearProject])

  // Confirm navigation with unsaved changes
  const handleConfirmNavigation = useCallback(() => {
    setShowUnsavedDialog(false)
    clearProject()
  }, [clearProject])

  // Cancel navigation
  const handleCancelNavigation = useCallback(() => {
    setShowUnsavedDialog(false)
  }, [])

  // Handle project rename
  const handleProjectRename = useCallback((newName: string) => {
    renameProject(newName)
  }, [renameProject])

  // Handle new project button click
  const handleNewProject = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      clearProject()
    }
  }, [hasUnsavedChanges, clearProject])

  return (
    <>
      <header
        onDoubleClick={() => window.api.window.toggleMaximize()}
        className={`
          h-12 drag-region flex items-center
          glass-subtle border-b border-white/[0.06]
          transition-all duration-300 ease-smooth
          ${isAppMounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}
        `}
      >
        {/* Spacer for macOS traffic lights */}
        <div className="w-20 flex-shrink-0" />

        {/* Centered Title with clickable logo */}
        <div className="flex-1 flex justify-center items-center gap-2">
          {/* Clickable App Logo/Icon */}
          <button
            onClick={handleLogoClick}
            className={`
              w-5 h-5 rounded-md bg-gradient-to-br from-primary-500 to-primary-700
              flex items-center justify-center shadow-glow-blue/20
              no-drag transition-all duration-150
              ${hasProject() ? 'hover:scale-110 hover:shadow-glow-blue/40 cursor-pointer' : ''}
            `}
            title={hasProject() ? 'Zurück zur Startseite' : undefined}
            disabled={!hasProject()}
          >
            <svg className="w-3 h-3 text-white" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4 6.5A2.5 2.5 0 016.5 4h11A2.5 2.5 0 0120 6.5v11a2.5 2.5 0 01-2.5 2.5h-11A2.5 2.5 0 014 17.5v-11zm2.5-.5a.5.5 0 00-.5.5v11a.5.5 0 00.5.5h11a.5.5 0 00.5-.5v-11a.5.5 0 00-.5-.5h-11z"/>
              <path d="M7 14h10v2H7v-2zm0-4h6v2H7v-2z"/>
            </svg>
          </button>

          {/* App name and project name */}
          <h1 className="text-sm font-medium text-dark-300 tracking-wide select-none">
            {project?.name ? (
              <span className="flex items-center gap-2">
                {/* Clickable OpenSub text */}
                <button
                  onClick={handleLogoClick}
                  className="text-dark-400 no-drag hover:text-dark-300 transition-colors duration-150"
                  title="Zurück zur Startseite"
                >
                  OpenSub
                </button>
                <span className="text-dark-600">/</span>
                {/* Inline editable project name */}
                <InlineProjectNameEditor
                  name={project.name}
                  onSave={handleProjectRename}
                />
                <span className="text-dark-600">·</span>
                <SaveIndicator />
              </span>
            ) : (
              'OpenSub'
            )}
          </h1>
        </div>

        {/* Action Buttons with micro-interactions */}
        <div className="w-20 flex-shrink-0 flex items-center justify-end gap-1 pr-3 no-drag">
          {hasProject() && (
            <>
              {/* New Project Button */}
              <button
                onClick={handleNewProject}
                className="
                  group relative p-2 rounded-lg
                  text-dark-400 hover:text-white
                  hover:bg-white/[0.06] active:bg-white/[0.1]
                  transition-all duration-150 ease-spring
                  hover:scale-105 active:scale-95
                "
                title="Neues Projekt"
              >
                <svg className="w-4 h-4 transition-transform duration-150 group-hover:rotate-90" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>

              {/* Export Button */}
              <button
                onClick={onExport}
                disabled={project?.subtitles.length === 0}
                className="
                  group relative p-2 rounded-lg
                  text-dark-400 hover:text-primary-400
                  hover:bg-primary-500/10 active:bg-primary-500/20
                  transition-all duration-150 ease-spring
                  hover:scale-105 active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed
                  disabled:hover:scale-100 disabled:hover:bg-transparent
                "
                title="Video exportieren"
              >
                <svg className="w-4 h-4 transition-transform duration-150 group-hover:-translate-y-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </header>

      {/* Unsaved Changes Warning Dialog */}
      {showUnsavedDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          onClick={handleCancelNavigation}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

          {/* Dialog */}
          <div
            className="
              relative z-10 w-full max-w-md mx-4
              glass-dark-heavy rounded-2xl p-6
              shadow-elevated animate-fade-in-up
            "
            onClick={(e) => e.stopPropagation()}
          >
            {/* Warning Icon */}
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                <svg
                  className="w-6 h-6 text-amber-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-white text-center mb-2">
              Ungespeicherte Änderungen
            </h2>

            {/* Message */}
            <p className="text-dark-400 text-center mb-6">
              Du hast ungespeicherte Änderungen. Möchtest du wirklich fortfahren?
              Alle Änderungen gehen verloren.
            </p>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleCancelNavigation}
                className="
                  flex-1 px-4 py-2.5 rounded-xl
                  bg-dark-800 hover:bg-dark-700
                  text-dark-300 hover:text-white
                  font-medium transition-all duration-150
                  hover:scale-[1.02] active:scale-[0.98]
                "
              >
                Abbrechen
              </button>
              <button
                onClick={handleConfirmNavigation}
                className="
                  flex-1 px-4 py-2.5 rounded-xl
                  bg-red-500/20 hover:bg-red-500/30
                  text-red-400 hover:text-red-300
                  font-medium transition-all duration-150
                  hover:scale-[1.02] active:scale-[0.98]
                "
              >
                Verwerfen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
