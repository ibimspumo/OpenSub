import { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from './store/projectStore'
import { useUIStore } from './store/uiStore'
import DropZone from './components/DropZone/DropZone'
import VideoPlayer from './components/VideoPlayer/VideoPlayer'
import Timeline from './components/Timeline/Timeline'
import SubtitleList from './components/SubtitleEditor/SubtitleList'
import StyleEditor from './components/StyleEditor/StyleEditor'
import TranscriptionProgress from './components/TranscriptionProgress/TranscriptionProgress'
import ExportProgress from './components/ExportProgress/ExportProgress'
import { generateASS } from './utils/assGenerator'

function App() {
  const { project, hasProject, clearProject } = useProjectStore()
  const { isTranscribing, transcriptionProgress, isExporting, setIsExporting, setExportProgress } = useUIStore()
  const [exportError, setExportError] = useState<string | null>(null)

  // Export handler
  const handleExport = useCallback(async () => {
    if (!project) return

    try {
      // Select output file
      const outputPath = await window.api.file.selectOutput(
        `${project.name}_subtitled.mp4`
      )
      if (!outputPath) return

      setIsExporting(true)
      setExportProgress(0)
      setExportError(null)

      // Generate ASS subtitle file
      const assContent = generateASS(project)

      // Write ASS file temporarily
      const appPath = await window.api.file.getAppPath()
      const subtitlePath = `${appPath}/temp_subtitles_${Date.now()}.ass`

      // We need to write the file via main process
      // For now, we'll use a workaround with the export function

      // Set up progress listener
      const unsubscribe = window.api.ffmpeg.onProgress((progress) => {
        setExportProgress(progress.percent)
      })

      // Export video with subtitles
      await window.api.ffmpeg.exportVideo(project.videoPath, subtitlePath, {
        outputPath,
        quality: 'high'
      })

      unsubscribe()
      setIsExporting(false)

      alert(`Video exportiert: ${outputPath}`)
    } catch (err) {
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
    <div className="h-screen flex flex-col bg-dark-950">
      {/* Title Bar (draggable) */}
      <div className="h-12 drag-region flex items-center border-b border-dark-800">
        {/* Spacer for traffic lights */}
        <div className="w-20" />

        {/* Title */}
        <div className="flex-1 flex justify-center">
          <h1 className="text-sm font-medium text-dark-400">
            {project?.name || 'OpenSub'}
          </h1>
        </div>

        {/* Action Buttons */}
        <div className="w-20 flex items-center justify-end gap-2 pr-4 no-drag">
          {hasProject() && (
            <>
              <button
                onClick={() => clearProject()}
                className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors"
                title="Neues Projekt"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
              </button>
              <button
                onClick={handleExport}
                disabled={project?.subtitles.length === 0}
                className="p-2 hover:bg-dark-800 rounded text-dark-400 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Video exportieren"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {!hasProject() ? (
          // No project - show drop zone
          <DropZone />
        ) : (
          // Project loaded - show editor
          <>
            {/* Left Panel - Video Player */}
            <div className="flex-1 flex flex-col min-w-0">
              {/* Video Preview */}
              <div className="flex-1 min-h-0 p-4">
                <VideoPlayer />
              </div>

              {/* Timeline */}
              <div className="h-32 border-t border-dark-800">
                <Timeline />
              </div>
            </div>

            {/* Right Panel - Subtitle Editor & Style Editor */}
            <div className="w-96 flex flex-col border-l border-dark-800">
              {/* Subtitle List */}
              <div className="flex-1 min-h-0 overflow-y-auto">
                <SubtitleList />
              </div>

              {/* Style Editor */}
              <div className="h-80 border-t border-dark-800 overflow-y-auto">
                <StyleEditor />
              </div>
            </div>
          </>
        )}
      </div>

      {/* Transcription Progress Modal */}
      {isTranscribing && <TranscriptionProgress progress={transcriptionProgress} />}

      {/* Export Progress Modal */}
      {isExporting && <ExportProgress />}
    </div>
  )
}

export default App
