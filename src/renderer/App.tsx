import { useEffect, useState, useCallback, useMemo } from 'react'
import { useProjectStore } from './store/projectStore'
import { useUIStore } from './store/uiStore'
import DropZone from './components/DropZone/DropZone'
import VideoPlayer from './components/VideoPlayer/VideoPlayer'
import Timeline from './components/Timeline/Timeline'
import SubtitleList from './components/SubtitleEditor/SubtitleList'
import StyleEditor from './components/StyleEditor/StyleEditor'
import TranscriptionProgress from './components/TranscriptionProgress/TranscriptionProgress'
import ExportProgress from './components/ExportProgress/ExportProgress'
import ExportDialog from './components/ExportDialog/ExportDialog'
import AnalysisProgress from './components/AnalysisProgress/AnalysisProgress'
import DiffPreview from './components/DiffPreview/DiffPreview'
import TitleBar from './components/TitleBar/TitleBar'
import ModelLoadingScreen from './components/ModelLoadingScreen/ModelLoadingScreen'
import { TooltipProvider } from './components/ui/tooltip'
import { Button } from './components/ui/button'
import { generateExportFrames } from './utils/subtitleFrameRenderer'
import { useAutoSave } from './hooks/useAutoSave'
import { loadGoogleFont } from './utils/fontLoader'
import { PlaybackControllerProvider } from './hooks/usePlaybackController'
import { cn } from './lib/utils'
import { X, AlertCircle } from 'lucide-react'
import type {
  SubtitleFrame,
  TranscriptionProgress as TranscriptionProgressType,
  ExportSettings
} from '../shared/types'

function App() {
  const { project, hasProject } = useProjectStore()
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
  const [isModelLoading, setIsModelLoading] = useState(true)
  const [modelLoadingProgress, setModelLoadingProgress] = useState<TranscriptionProgressType | null>(null)

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

  // Listen for AI model loading progress at app startup
  useEffect(() => {
    // Check if model is already ready (in case we missed the event)
    window.api.whisper.isModelReady().then(({ ready }) => {
      if (ready) {
        setIsModelLoading(false)
      }
    }).catch(console.error)

    // Listen for model loading progress
    const unsubProgress = window.api.whisper.onProgress((progress) => {
      if (progress.stage === 'initializing') {
        setModelLoadingProgress(progress)
      }
    })

    // Listen for model ready event
    const unsubReady = window.api.whisper.onModelReady(({ ready }) => {
      if (ready) {
        // Small delay to show completion
        setTimeout(() => {
          setIsModelLoading(false)
          setModelLoadingProgress(null)
        }, 500)
      }
    })

    return () => {
      unsubProgress()
      unsubReady()
    }
  }, [])

  // Preload default fonts (Poppins is the default, Montserrat also popular)
  useEffect(() => {
    // Load Poppins (default font) and Montserrat in background
    loadGoogleFont('Poppins', [400, 500, 600, 700])
    loadGoogleFont('Montserrat', [400, 500, 700])
  }, [])

  // Listen for AI analysis progress events
  useEffect(() => {
    const unsubscribe = window.api.analysis.onProgress((progress) => {
      setAnalysisProgress(progress)
    })
    return () => unsubscribe()
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

  // Export handler - uses frame-based rendering for pixel-perfect subtitle overlay
  const handleConfirmExport = useCallback(async (settings: ExportSettings) => {
    if (!project) return

    let frameDir: string | undefined

    try {
      // Select output file with user's chosen filename
      const outputPath = await window.api.file.selectOutput(
        `${settings.filename}.mp4`
      )
      if (!outputPath) return

      setIsExporting(true)
      setExportProgress(0)
      setExportError(null)

      // Get video metadata for FPS
      const metadata = await window.api.ffmpeg.getMetadata(project.videoPath)
      const fps = metadata.fps || 30

      // Use target resolution from settings
      const targetWidth = settings.resolution.width
      const targetHeight = settings.resolution.height

      // Phase 1: Render subtitle frames (0-40% progress)
      // Render at target resolution for proper scaling
      const frameInfos = await generateExportFrames(
        project.subtitles,
        project.style,
        targetWidth,
        targetHeight,
        fps,
        (percent) => {
          // Map 0-100% of frame rendering to 0-40% of total progress
          setExportProgress(percent * 0.4)
        }
      )

      if (frameInfos.length === 0) {
        throw new Error('Keine Untertitel zum Exportieren vorhanden')
      }

      // Convert frame infos to SubtitleFrame format for IPC
      const frames: SubtitleFrame[] = frameInfos.map((info, index) => ({
        index,
        startTime: info.startTime,
        endTime: info.endTime,
        // Extract base64 data from data URL
        data: info.dataUrl.replace(/^data:image\/png;base64,/, '')
      }))

      // Phase 2: Save frames to disk (40-50% progress)
      setExportProgress(45)
      const saveResult = await window.api.file.saveSubtitleFrames(frames, fps)

      if (!saveResult.success || !saveResult.frameDir) {
        throw new Error(saveResult.error || 'Failed to save subtitle frames')
      }

      frameDir = saveResult.frameDir

      // Phase 3: Export video with frame overlay (50-100% progress)
      const unsubscribe = window.api.ffmpeg.onProgress((progress) => {
        // Map 0-100% of FFmpeg progress to 50-100% of total progress
        setExportProgress(50 + progress.percent * 0.5)
      })

      // Export using frame-based overlay for pixel-perfect results
      await window.api.ffmpeg.exportVideo(project.videoPath, '', {
        outputPath,
        quality: settings.quality,
        targetWidth,
        targetHeight,
        useFrameRendering: true,
        frameDir
      })

      unsubscribe()

      // Cleanup frames
      if (frameDir) {
        await window.api.file.cleanupSubtitleFrames(frameDir)
      }

      setIsExporting(false)
      alert(`Video exportiert: ${outputPath}`)
    } catch (err) {
      // Cleanup frames on error
      if (frameDir) {
        await window.api.file.cleanupSubtitleFrames(frameDir).catch(() => {})
      }

      setIsExporting(false)
      setExportError(err instanceof Error ? err.message : 'Export fehlgeschlagen')
      console.error('Export error:', err)
    }
  }, [project, setIsExporting, setExportProgress])


  return (
    <TooltipProvider>
      <div
        className={cn(
          'h-screen flex flex-col bg-background',
          'transition-opacity duration-500 ease-smooth',
          isAppMounted ? 'opacity-100' : 'opacity-0'
        )}
      >
        {/* Premium Title Bar */}
        <TitleBar isAppMounted={isAppMounted} onExport={handleOpenExportDialog} />

        {/* Main Content Area with smooth transitions */}
        <main className={cn(
          'flex-1 flex relative',
          hasProject() ? 'overflow-hidden' : 'overflow-y-auto'
        )}>
          {!hasProject() ? (
            // Drop Zone - Full screen centered
            <div className="flex-1 animate-fade-in">
              <DropZone />
            </div>
          ) : (
            // Editor Layout - 3-column + bottom timeline
            // Wrapped with PlaybackControllerProvider for synchronized video/timeline control
            <PlaybackControllerProvider>
            <div
              className={cn(
                'flex-1 flex flex-col overflow-hidden',
                'transition-all duration-500 ease-smooth',
                showEditor ? 'opacity-100' : 'opacity-0'
              )}
            >
              {/* Top Area - 3 Column Layout */}
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Left Column - Subtitle List */}
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
                      Untertitel
                    </h2>
                    <span className="text-xs text-muted-foreground/70 tabular-nums">
                      {project?.subtitles.length || 0} Eintraege
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto scrollbar-thin">
                    <SubtitleList />
                  </div>
                </div>

                {/* Center Column - Video Player */}
                <div
                  className={cn(
                    'flex-1 flex flex-col min-w-0',
                    'transition-all duration-300 ease-smooth'
                  )}
                >
                  <div
                    className={cn(
                      'flex-1 min-h-0 p-4',
                      showEditor && 'animate-fade-in-up'
                    )}
                    style={{ animationDelay: '150ms', animationFillMode: 'both' }}
                  >
                    <div className={cn(
                      'h-full w-full flex items-center justify-center',
                      isPortraitVideo && 'portrait-video-container'
                    )}>
                      <VideoPlayer />
                    </div>
                  </div>
                </div>

                {/* Right Column - Style Editor */}
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
                      Stil-Editor
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

              {/* Bottom - Full-width Timeline */}
              <div
                className={cn(
                  'h-32 border-t border-border',
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

        {/* Model Loading Screen - shown at app startup */}
        {isModelLoading && (
          <ModelLoadingScreen progress={modelLoadingProgress} />
        )}

        {/* Modal Overlays with backdrop blur */}
        {isTranscribing && (
          <TranscriptionProgress progress={transcriptionProgress} />
        )}

        {isExporting && (
          <ExportProgress />
        )}

        {/* Export Dialog */}
        {showExportDialog && (
          <ExportDialog onExport={handleConfirmExport} />
        )}

        {/* AI Analysis Modal */}
        {isAnalyzing && (
          <AnalysisProgress
            progress={analysisProgress}
            onCancel={() => {
              window.api.analysis.cancel()
              setIsAnalyzing(false)
              setAnalysisProgress(null)
            }}
          />
        )}

        {/* Diff Preview Modal */}
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

        {/* Export Error Toast */}
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
              <p className="text-sm font-medium text-foreground">Export fehlgeschlagen</p>
              <p className="text-xs text-muted-foreground">{exportError}</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="ml-2"
              onClick={() => setExportError(null)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}

export default App
