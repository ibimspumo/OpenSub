import { useEffect, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { X, AlertCircle } from 'lucide-react'
import { useProjectStore, useProjectHistory } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import DropZone from '@/components/DropZone/DropZone'
import VideoPlayer from '@/components/VideoPlayer/VideoPlayer'
import Timeline from '@/components/Timeline/Timeline'
import SubtitleList from '@/components/SubtitleEditor/SubtitleList'
import StyleEditor from '@/components/StyleEditor/StyleEditor'
import TranscriptionProgress from '@/components/Progress/TranscriptionProgress'
import ExportProgress from '@/components/Progress/ExportProgress'
import AnalysisProgress from '@/components/Progress/AnalysisProgress'
import ExportDialog from '@/components/ExportDialog/ExportDialog'
import DiffPreview from '@/components/DiffPreview/DiffPreview'
import TitleBar from '@/components/TitleBar/TitleBar'
import SetupWizard from '@/components/Setup/SetupWizard'
import UpdateChecker from '@/components/Updater/UpdateChecker'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Button } from '@/components/ui/button'
import { generateExportFrames } from '@/utils/subtitleFrameRenderer'
import { useAutoSave } from '@/hooks/useAutoSave'
import { loadGoogleFont } from '@/utils/fontLoader'
import { PlaybackControllerProvider } from '@/hooks/usePlaybackController'
import { api, ffmpeg, files, models, analysis } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { SubtitleFrame, ExportSettings } from '@/lib/types'

function App() {
  const { t } = useTranslation()
  const { project, hasProject } = useProjectStore()
  const { undo, redo } = useProjectHistory()
  const {
    isTranscribing,
    transcriptionProgress,
    isExporting,
    setIsExporting,
    setExportProgress,
    isAnalyzing,
    analysisProgress,
    showDiffPreview,
    setIsAnalyzing,
    setAnalysisProgress,
    setShowDiffPreview,
    setPendingChanges,
    showExportDialog,
    setShowExportDialog
  } = useUIStore()
  const [exportError, setExportError] = useState<string | null>(null)
  const [isAppMounted, setIsAppMounted] = useState(false)
  const [showEditor, setShowEditor] = useState(false)
  const [showSetupWizard, setShowSetupWizard] = useState(false)

  // Auto-save hook
  useAutoSave()

  // Detect portrait video aspect ratio
  const isPortraitVideo = useMemo(() => {
    if (!project?.resolution) return false
    const { width, height } = project.resolution
    return height > width
  }, [project?.resolution])

  // App mount animation
  useEffect(() => {
    const timer = setTimeout(() => setIsAppMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  // First-run model gate: show setup wizard until the ASR model is downloaded
  useEffect(() => {
    models
      .status()
      .then((status) => {
        if (!status.asrReady) setShowSetupWizard(true)
      })
      .catch(console.error)
  }, [])

  // Global undo/redo shortcuts (Cmd+Z / Cmd+Shift+Z)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      if (e.metaKey && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) {
          redo()
        } else {
          undo()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [undo, redo])

  // Preload default fonts (Poppins is the default, Montserrat also popular)
  useEffect(() => {
    loadGoogleFont('Poppins', [400, 500, 600, 700, 800])
    loadGoogleFont('Montserrat', [400, 500, 700, 900])
  }, [])

  // Listen for AI analysis progress events
  useEffect(() => {
    const unsubscribe = analysis.onProgress((progress) => {
      setAnalysisProgress(progress)
    })
    return unsubscribe
  }, [setAnalysisProgress])

  // Editor transition when project loads
  useEffect(() => {
    if (project) {
      const timer = setTimeout(() => setShowEditor(true), 100)
      return () => clearTimeout(timer)
    } else {
      setShowEditor(false)
    }
  }, [project])

  // Open export dialog
  const handleOpenExportDialog = useCallback(() => {
    if (!project || project.subtitles.length === 0) return
    setShowExportDialog(true)
  }, [project, setShowExportDialog])

  // Export: render frames in workers, persist to disk, overlay via FFmpeg
  const handleConfirmExport = useCallback(
    async (settings: ExportSettings) => {
      if (!project) return

      let frameDir: string | undefined

      try {
        const outputPath = await files.selectOutput(`${settings.filename}.mp4`)
        if (!outputPath) return

        setIsExporting(true)
        setExportProgress(0)
        setExportError(null)

        const metadata = await ffmpeg.getMetadata(project.videoPath)
        const fps = metadata.fps || 30

        const targetWidth = settings.resolution.width
        const targetHeight = settings.resolution.height

        // Phase 1: render subtitle frames (0-40%)
        const frameInfos = await generateExportFrames(
          project.subtitles,
          project.style,
          targetWidth,
          targetHeight,
          fps,
          (percent) => setExportProgress(percent * 0.4)
        )

        if (frameInfos.length === 0) {
          throw new Error(t('export.noSubtitlesToExport'))
        }

        const frames: SubtitleFrame[] = frameInfos.map((info, index) => ({
          index,
          startTime: info.startTime,
          endTime: info.endTime,
          data: info.dataUrl.replace(/^data:image\/png;base64,/, '')
        }))

        // Phase 2: save frames to disk (40-50%)
        setExportProgress(45)
        frameDir = await files.saveSubtitleFrames(frames, fps)

        // Phase 3: FFmpeg overlay encode (50-100%)
        const unsubscribe = ffmpeg.onProgress((progress) => {
          setExportProgress(50 + progress.percent * 0.5)
        })

        await ffmpeg.exportVideo(project.videoPath, {
          outputPath,
          quality: settings.quality,
          targetWidth,
          targetHeight,
          frameDir,
          fps
        })

        unsubscribe()

        if (frameDir) {
          await files.cleanupSubtitleFrames(frameDir)
        }

        setIsExporting(false)
        alert(t('export.exportSuccess', { path: outputPath }))
      } catch (err) {
        if (frameDir) {
          await files.cleanupSubtitleFrames(frameDir).catch(() => {})
        }
        setIsExporting(false)
        setExportError(err instanceof Error ? err.message : String(err ?? t('export.exportFailed')))
        console.error('Export error:', err)
      }
    },
    [project, setIsExporting, setExportProgress, t]
  )

  return (
    <TooltipProvider>
      <div
        className={cn(
          'h-screen flex flex-col bg-background',
          'transition-opacity duration-500',
          isAppMounted ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Title Bar */}
        <TitleBar isAppMounted={isAppMounted} onExport={handleOpenExportDialog} />

        {/* Main Content */}
        <main
          className={cn(
            'flex-1 flex relative',
            hasProject() ? 'overflow-hidden' : 'overflow-y-auto'
          )}
        >
          {!hasProject() ? (
            <div className="flex-1 animate-fade-in">
              <DropZone />
            </div>
          ) : (
            <PlaybackControllerProvider>
              <div
                className={cn(
                  'flex-1 flex flex-col overflow-hidden',
                  'transition-all duration-500',
                  showEditor ? 'opacity-100' : 'opacity-0'
                )}
              >
                {/* Top: 3-column layout */}
                <div className="flex-1 flex min-h-0 overflow-hidden">
                  {/* Left: subtitle list */}
                  <div
                    className={cn(
                      'w-80 min-w-[280px] flex flex-col',
                      'border-r border-border',
                      'bg-gradient-to-l from-card/30 to-transparent',
                      showEditor && 'animate-slide-in-left'
                    )}
                    style={{ animationDelay: '100ms', animationFillMode: 'both' }}
                  >
                    <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t('app.subtitles')}
                      </h2>
                      <span className="text-xs text-muted-foreground/70 tabular-nums">
                        {t('app.entriesCount', { count: project?.subtitles.length || 0 })}
                      </span>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      <SubtitleList />
                    </div>
                  </div>

                  {/* Center: video player */}
                  <div className="flex-1 flex flex-col min-w-0">
                    <div
                      className={cn('flex-1 min-h-0 p-4', showEditor && 'animate-fade-in-up')}
                      style={{ animationDelay: '150ms', animationFillMode: 'both' }}
                    >
                      <div
                        className={cn(
                          'h-full w-full flex items-center justify-center',
                          isPortraitVideo && 'portrait-video-container'
                        )}
                      >
                        <VideoPlayer />
                      </div>
                    </div>
                  </div>

                  {/* Right: style editor */}
                  <div
                    className={cn(
                      'w-80 min-w-[280px] flex flex-col',
                      'border-l border-border',
                      'bg-gradient-to-r from-card/30 to-transparent',
                      showEditor && 'animate-slide-in-right'
                    )}
                    style={{ animationDelay: '100ms', animationFillMode: 'both' }}
                  >
                    <div className="px-4 py-3 border-b border-border/50 flex items-center justify-between">
                      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {t('app.styleEditor')}
                      </h2>
                      <div className="w-4 h-4 rounded-full bg-secondary flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
                      </div>
                    </div>
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                      <StyleEditor />
                    </div>
                  </div>
                </div>

                {/* Bottom: timeline */}
                <div
                  className={cn(
                    'h-36 border-t border-border',
                    'bg-gradient-to-b from-card/50 to-transparent',
                    showEditor && 'animate-slide-in-up'
                  )}
                  style={{ animationDelay: '200ms', animationFillMode: 'both' }}
                >
                  <Timeline />
                </div>
              </div>
            </PlaybackControllerProvider>
          )}
        </main>

        <UpdateChecker />

        {/* First-run model setup */}
        {showSetupWizard && <SetupWizard onComplete={() => setShowSetupWizard(false)} />}

        {/* Overlays */}
        {isTranscribing && <TranscriptionProgress progress={transcriptionProgress} />}
        {isExporting && <ExportProgress />}
        {showExportDialog && <ExportDialog onExport={handleConfirmExport} />}

        {isAnalyzing && (
          <AnalysisProgress
            progress={analysisProgress}
            onCancel={() => {
              api.analysis.cancel()
              setIsAnalyzing(false)
              setAnalysisProgress(null)
            }}
          />
        )}

        {showDiffPreview && (
          <DiffPreview
            onClose={() => {
              setShowDiffPreview(false)
              setPendingChanges([])
            }}
            onApply={() => {
              setShowDiffPreview(false)
              setPendingChanges([])
            }}
          />
        )}

        {/* Export error toast */}
        {exportError && (
          <div
            className={cn(
              'fixed bottom-4 right-4 z-50',
              'bg-card border border-border rounded-xl px-4 py-3',
              'animate-slide-in-up shadow-lg',
              'flex items-center gap-3'
            )}
          >
            <div className="w-8 h-8 rounded-full bg-destructive/20 flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-destructive" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{t('export.exportFailed')}</p>
              <p className="text-xs text-muted-foreground">{exportError}</p>
            </div>
            <Button variant="ghost" size="icon" className="ml-2" onClick={() => setExportError(null)}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default App
