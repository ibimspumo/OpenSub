import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import SaveIndicator from '../SaveIndicator/SaveIndicator'
import InlineProjectNameEditor from './InlineProjectNameEditor'
import SettingsModal from '../Settings/SettingsModal'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { Plus, Upload, AlertTriangle, Subtitles, Settings } from 'lucide-react'

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
  const { t } = useTranslation()
  const { project, hasProject, clearProject, renameProject } = useProjectStore()
  const { hasUnsavedChanges } = useUIStore()
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Handle logo click - navigate home with unsaved warning if needed
  const handleLogoClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation() // Prevent window drag

      if (!hasProject()) return

      if (hasUnsavedChanges) {
        setShowUnsavedDialog(true)
      } else {
        clearProject()
      }
    },
    [hasProject, hasUnsavedChanges, clearProject]
  )

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
  const handleProjectRename = useCallback(
    (newName: string) => {
      renameProject(newName)
    },
    [renameProject]
  )

  // Handle new project button click
  const handleNewProject = useCallback(() => {
    if (hasUnsavedChanges) {
      setShowUnsavedDialog(true)
    } else {
      clearProject()
    }
  }, [hasUnsavedChanges, clearProject])

  return (
    <TooltipProvider delayDuration={300}>
      <header
        onDoubleClick={() => window.api.window.toggleMaximize()}
        className={cn(
          'h-12 drag-region flex items-center',
          'glass-subtle border-b border-white/[0.06]',
          'transition-all duration-300 ease-smooth',
          isAppMounted ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'
        )}
      >
        {/* Spacer for macOS traffic lights */}
        <div className="w-20 flex-shrink-0" />

        {/* Centered Title with clickable logo */}
        <div className="flex-1 flex justify-center items-center gap-2">
          {/* Clickable App Logo/Icon */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={handleLogoClick}
                className={cn(
                  'w-5 h-5 rounded-md bg-gradient-to-br from-primary-500 to-primary-700',
                  'flex items-center justify-center shadow-glow-blue/20',
                  'no-drag transition-all duration-150',
                  hasProject() && 'hover:scale-110 hover:shadow-glow-blue/40 cursor-pointer'
                )}
                disabled={!hasProject()}
              >
                <Subtitles className="w-3 h-3 text-white" />
              </button>
            </TooltipTrigger>
            {hasProject() && (
              <TooltipContent side="bottom">
                <p>{t('app.toHome')}</p>
              </TooltipContent>
            )}
          </Tooltip>

          {/* App name and project name */}
          <h1 className="text-sm font-medium text-dark-300 tracking-wide select-none">
            {project?.name ? (
              <span className="flex items-center gap-2">
                {/* Clickable OpenSub text */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogoClick}
                      className="text-dark-400 no-drag hover:text-dark-300 transition-colors duration-150"
                    >
                      OpenSub
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{t('app.toHome')}</p>
                  </TooltipContent>
                </Tooltip>
                <span className="text-dark-600">/</span>
                {/* Inline editable project name */}
                <InlineProjectNameEditor name={project.name} onSave={handleProjectRename} />
                <span className="text-dark-600 mx-0.5">·</span>
                <SaveIndicator />
              </span>
            ) : (
              'OpenSub'
            )}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="w-28 flex-shrink-0 flex items-center justify-end gap-1 pr-3 no-drag">
          {hasProject() && (
            <>
              {/* New Project Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNewProject}
                    className={cn(
                      'h-8 w-8 text-muted-foreground hover:text-foreground',
                      'hover:bg-white/[0.06] transition-all duration-150',
                      '[&_svg]:transition-transform [&_svg]:duration-150',
                      'hover:[&_svg]:rotate-90'
                    )}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('titleBar.newProject')}</p>
                </TooltipContent>
              </Tooltip>

              {/* Export Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onExport}
                    disabled={project?.subtitles.length === 0}
                    className={cn(
                      'h-8 w-8 text-muted-foreground',
                      'hover:text-primary hover:bg-primary/10',
                      'transition-all duration-150',
                      '[&_svg]:transition-transform [&_svg]:duration-150',
                      'hover:[&_svg]:-translate-y-0.5'
                    )}
                  >
                    <Upload className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('titleBar.exportVideo')}</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Settings Button - always visible */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettingsModal(true)}
                className={cn(
                  'h-8 w-8 text-muted-foreground hover:text-foreground',
                  'hover:bg-white/[0.06] transition-all duration-150',
                  '[&_svg]:transition-transform [&_svg]:duration-150',
                  'hover:[&_svg]:rotate-45'
                )}
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('titleBar.settings')}</p>
            </TooltipContent>
          </Tooltip>
        </div>
      </header>

      {/* Unsaved Changes Warning Dialog */}
      <Dialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20">
              <AlertTriangle className="h-6 w-6 text-amber-400" />
            </div>
            <DialogTitle className="text-center">{t('titleBar.unsavedChanges')}</DialogTitle>
            <DialogDescription className="text-center">
              {t('titleBar.unsavedChangesMessage')}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-row gap-3 sm:justify-center">
            <Button
              variant="secondary"
              onClick={handleCancelNavigation}
              className="flex-1 sm:flex-none"
            >
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={handleConfirmNavigation}
              className="flex-1 sm:flex-none"
            >
              {t('titleBar.discard')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Settings Modal */}
      <SettingsModal open={showSettingsModal} onOpenChange={setShowSettingsModal} />
    </TooltipProvider>
  )
}
