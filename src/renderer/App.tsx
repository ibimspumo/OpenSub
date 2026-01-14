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
import AnalysisProgress from './components/AnalysisProgress/AnalysisProgress'
import DiffPreview from './components/DiffPreview/DiffPreview'
import TitleBar from './components/TitleBar/TitleBar'
import { generateExportFrames } from './utils/subtitleFrameRenderer'
import { useAutoSave } from './hooks/useAutoSave'
import { loadGoogleFont } from './utils/fontLoader'
import { PlaybackControllerProvider } from './hooks/usePlaybackController'
import type { SubtitleFrame } from '../shared/types'

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
    setPendingChanges
  } = useUIStore()
  const [exportError, setExportError] = useState<string | null>(null)
  const [isAppMounted, setIsAppMounted] = useState(false)
  const [showEditor, setShowEditor] = useState(false)

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

  // Export handler - uses frame-based rendering for pixel-perfect subtitle overlay
  const handleExport = useCallback(async () => {
    if (!project) return

    let frameDir: string | undefined

    try {
      // Select output file
      const outputPath = await window.api.file.selectOutput(
        `${project.name}_subtitled.mp4`
      )
      if (!outputPath) return

      setIsExporting(true)
      setExportProgress(0)
      setExportError(null)

      // Get video metadata for FPS
      const metadata = await window.api.ffmpeg.getMetadata(project.videoPath)
      const fps = metadata.fps || 30

      // Phase 1: Render subtitle frames (0-40% progress)
      // This renders each subtitle frame as a PNG for pixel-perfect overlay
      const frameInfos = await generateExportFrames(
        project.subtitles,
        project.style,
        project.resolution.width,
        project.resolution.height,
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
        quality: 'high',
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop whisper service when app closes
      if (window.api?.whisper) {
        window.api.whisper.stop().catch(console.error)
      }
    }
  }, [])

  return (
    <div
      className={`
        h-screen flex flex-col bg-dark-950
        transition-opacity duration-500 ease-smooth
        ${isAppMounted ? 'opacity-100' : 'opacity-0'}
      `}
    >
      {/* Premium Title Bar with Glassmorphism */}
      <TitleBar isAppMounted={isAppMounted} onExport={handleExport} />

      {/* Main Content Area with smooth transitions */}
      <main className="flex-1 flex overflow-hidden relative">
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
            className={`
              flex-1 flex flex-col overflow-hidden
              transition-all duration-500 ease-smooth
              ${showEditor ? 'opacity-100' : 'opacity-0'}
            `}
          >
            {/* Top Area - 3 Column Layout */}
            <div className="flex-1 flex min-h-0 overflow-hidden">
              {/* Left Column - Subtitle List */}
              <div
                className={`
                  w-80 min-w-[280px] flex flex-col
                  border-r border-white/[0.06]
                  bg-gradient-to-l from-dark-900/30 to-transparent
                  ${showEditor ? 'animate-slide-in-left' : ''}
                `}
                style={{ animationDelay: '100ms', animationFillMode: 'both' }}
              >
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
                    Untertitel
                  </h2>
                  <span className="text-xs text-dark-500 tabular-nums">
                    {project?.subtitles.length || 0} Einträge
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <SubtitleList />
                </div>
              </div>

              {/* Center Column - Video Player */}
              <div
                className={`
                  flex-1 flex flex-col min-w-0
                  transition-all duration-300 ease-smooth
                `}
              >
                <div
                  className={`
                    flex-1 min-h-0 p-4
                    ${showEditor ? 'animate-fade-in-up' : ''}
                  `}
                  style={{ animationDelay: '150ms', animationFillMode: 'both' }}
                >
                  <div className={`
                    h-full w-full flex items-center justify-center
                    ${isPortraitVideo ? 'portrait-video-container' : ''}
                  `}>
                    <VideoPlayer />
                  </div>
                </div>
              </div>

              {/* Right Column - Style Editor */}
              <div
                className={`
                  w-80 min-w-[280px] flex flex-col
                  border-l border-white/[0.06]
                  bg-gradient-to-r from-dark-900/30 to-transparent
                  ${showEditor ? 'animate-slide-in-right' : ''}
                `}
                style={{ animationDelay: '100ms', animationFillMode: 'both' }}
              >
                <div className="px-4 py-3 border-b border-white/[0.04] flex items-center justify-between">
                  <h2 className="text-xs font-semibold text-dark-400 uppercase tracking-wider">
                    Stil-Editor
                  </h2>
                  <div className="w-4 h-4 rounded-full bg-dark-800 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary-500/60" />
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto scrollbar-thin">
                  <StyleEditor />
                </div>
              </div>
            </div>

            {/* Bottom - Full-width Timeline */}
            <div
              className={`
                h-32 border-t border-white/[0.06]
                bg-gradient-to-b from-dark-900/50 to-transparent
                ${showEditor ? 'animate-slide-in-up' : ''}
              `}
              style={{ animationDelay: '200ms', animationFillMode: 'both' }}
            >
              <Timeline />
            </div>
          </div>
          </PlaybackControllerProvider>
        )}
      </main>

      {/* Modal Overlays with backdrop blur */}
      {isTranscribing && (
        <TranscriptionProgress progress={transcriptionProgress} />
      )}

      {isExporting && (
        <ExportProgress />
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

      {/* Export Error Toast (if needed) */}
      {exportError && (
        <div
          className="
            fixed bottom-4 right-4
            glass-dark-heavy rounded-xl px-4 py-3
            animate-slide-in-up shadow-elevated
            flex items-center gap-3
          "
        >
          <div className="w-8 h-8 rounded-full bg-red-500/20 flex items-center justify-center">
            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Export fehlgeschlagen</p>
            <p className="text-xs text-dark-400">{exportError}</p>
          </div>
          <button
            onClick={() => setExportError(null)}
            className="ml-2 p-1 hover:bg-white/10 rounded transition-colors"
          >
            <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}

export default App
