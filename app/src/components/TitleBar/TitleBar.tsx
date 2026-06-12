import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import { useUpdateStore } from '@/store/updateStore'
import SaveIndicator from '@/components/SaveIndicator/SaveIndicator'
import { appWindow } from '@/lib/api'
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
import {
  Plus,
  Upload,
  AlertTriangle,
  Settings,
  PanelLeft,
  PanelRight,
  Download,
  RefreshCw,
  Loader2
} from 'lucide-react'

/** Brand mark — caption bubble matching the app icon */
function BrandMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect
        x="3" y="4" width="18" height="13" rx="4.5"
        stroke="var(--primary)" strokeWidth="1.8"
      />
      <path
        d="M8 17v3.2L12.2 17"
        stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      />
      <line x1="7.5" y1="9.2" x2="16.5" y2="9.2" stroke="var(--primary)" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="7.5" y1="12.6" x2="12.5" y2="12.6" stroke="rgba(255,255,255,0.6)" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

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
  const { hasUnsavedChanges, leftPanelOpen, rightPanelOpen, toggleLeftPanel, toggleRightPanel } =
    useUIStore()
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const updateStatus = useUpdateStore((s) => s.status)
  const availableVersion = useUpdateStore((s) => s.availableVersion)
  const downloadPercent = useUpdateStore((s) => s.downloadPercent)
  const installUpdate = useUpdateStore((s) => s.install)
  const restartApp = useUpdateStore((s) => s.restart)

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
        onDoubleClick={() => appWindow.toggleMaximize()}
        className={cn(
          'h-12 drag-region flex items-center',
          'glass-subtle border-b border-white/[0.06]',
          'transition-all duration-300 [transition-timing-function:cubic-bezier(0.25,0.1,0.25,1)]',
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
                  'w-5 h-5 flex items-center justify-center',
                  'no-drag transition-transform duration-200 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)]',
                  hasProject() && 'hover:scale-110 cursor-pointer'
                )}
                disabled={!hasProject()}
              >
                <BrandMark className="w-4.5 h-4.5" />
              </button>
            </TooltipTrigger>
            {hasProject() && (
              <TooltipContent side="bottom">
                <p>{t('app.toHome')}</p>
              </TooltipContent>
            )}
          </Tooltip>

          {/* App name and project name */}
          <h1 className="text-sm font-medium text-foreground/80 tracking-wide select-none">
            {project?.name ? (
              <span className="flex items-center gap-2">
                {/* Clickable OpenSub text */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={handleLogoClick}
                      className="text-muted-foreground no-drag hover:text-foreground/80 transition-colors duration-150"
                    >
                      OpenSub
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p>{t('app.toHome')}</p>
                  </TooltipContent>
                </Tooltip>
                <span className="text-muted-foreground/50">/</span>
                {/* Inline editable project name */}
                <InlineProjectNameEditor name={project.name} onSave={handleProjectRename} />
                <span className="text-muted-foreground/50 mx-0.5">·</span>
                <SaveIndicator />
              </span>
            ) : (
              'OpenSub'
            )}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex items-center justify-end gap-1 pr-3 no-drag">
          {hasProject() && (
            <>
              {/* Panel toggles */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleLeftPanel}
                    className={cn(
                      'h-7 w-7 transition-all duration-150',
                      leftPanelOpen
                        ? 'text-foreground/80 bg-white/[0.06]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                    )}
                  >
                    <PanelLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('titleBar.toggleTranscript')}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleRightPanel}
                    className={cn(
                      'h-7 w-7 transition-all duration-150',
                      rightPanelOpen
                        ? 'text-foreground/80 bg-white/[0.06]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-white/[0.06]'
                    )}
                  >
                    <PanelRight className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('titleBar.toggleInspector')}</p>
                </TooltipContent>
              </Tooltip>

              <div className="w-px h-4 bg-white/[0.08] mx-1" />

              {/* New Project Button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNewProject}
                    className={cn(
                      'h-7 w-7 text-muted-foreground hover:text-foreground',
                      'hover:bg-white/[0.06] transition-all duration-150',
                      '[&_svg]:transition-transform [&_svg]:duration-150',
                      'hover:[&_svg]:rotate-90'
                    )}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>{t('titleBar.newProject')}</p>
                </TooltipContent>
              </Tooltip>
            </>
          )}

          {/* Update indicator — visible while an update is available / downloading / ready */}
          {(updateStatus === 'available' ||
            updateStatus === 'downloading' ||
            updateStatus === 'ready') && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    if (updateStatus === 'available') installUpdate()
                    else if (updateStatus === 'ready') restartApp()
                  }}
                  disabled={updateStatus === 'downloading'}
                  className={cn(
                    'pressable mr-1 h-7 px-2.5 rounded-full',
                    'flex items-center gap-1.5',
                    'text-[11px] font-semibold no-drag',
                    'border border-primary/40 bg-primary/15 text-primary',
                    'transition-all duration-200',
                    updateStatus !== 'downloading' &&
                      'hover:bg-primary/25 hover:shadow-[0_0_12px_color-mix(in_oklch,var(--primary)_35%,transparent)]',
                    'disabled:opacity-70'
                  )}
                >
                  {updateStatus === 'downloading' ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} />
                      {Math.round(downloadPercent)}%
                    </>
                  ) : updateStatus === 'ready' ? (
                    <>
                      <RefreshCw className="h-3 w-3" strokeWidth={2.5} />
                      {t('updater.restart')}
                    </>
                  ) : (
                    <>
                      <Download className="h-3 w-3" strokeWidth={2.5} />
                      {t('updater.badge')}
                    </>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom">
                <p>
                  {updateStatus === 'ready'
                    ? t('updater.ready')
                    : updateStatus === 'downloading'
                      ? t('updater.downloading')
                      : t('updater.available', { version: availableVersion })}
                </p>
              </TooltipContent>
            </Tooltip>
          )}

          {/* Settings Button - always visible */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettingsModal(true)}
                className={cn(
                  'h-7 w-7 text-muted-foreground hover:text-foreground',
                  'hover:bg-white/[0.06] transition-all duration-150',
                  '[&_svg]:transition-transform [&_svg]:duration-150',
                  'hover:[&_svg]:rotate-45'
                )}
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              <p>{t('titleBar.settings')}</p>
            </TooltipContent>
          </Tooltip>

          {/* Export — the primary action, a real labeled button */}
          {hasProject() && (
            <button
              onClick={onExport}
              disabled={project?.subtitles.length === 0}
              className={cn(
                'pressable ml-1.5 h-7 px-3 rounded-full',
                'flex items-center gap-1.5',
                'text-[11px] font-semibold',
                'bg-primary text-primary-foreground',
                'transition-all duration-200',
                'hover:brightness-110 hover:shadow-[0_0_14px_color-mix(in_oklch,var(--primary)_40%,transparent)]',
                'disabled:opacity-35 disabled:pointer-events-none'
              )}
            >
              <Upload className="h-3 w-3" strokeWidth={2.5} />
              {t('titleBar.export')}
            </button>
          )}
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
