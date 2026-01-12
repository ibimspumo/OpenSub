import { useState, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import path from 'path-browserify'

type LoadingStep = 'metadata' | 'audio' | null

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null)
  const [error, setError] = useState<string | null>(null)

  const { createProject, setVideoMetadata, setAudioPath, setTranscriptionResult } =
    useProjectStore()
  const { setIsTranscribing, setTranscriptionProgress } = useUIStore()

  const handleFile = useCallback(
    async (filePath: string) => {
      setIsLoading(true)
      setLoadingStep('metadata')
      setError(null)

      try {
        // Get video filename for project name
        const fileName = filePath.split('/').pop() || 'Untitled'
        const projectName = fileName.replace(/\.[^.]+$/, '')

        // Create project
        createProject(filePath, projectName)

        // Get video metadata
        const metadata = await window.api.ffmpeg.getMetadata(filePath)
        setVideoMetadata(metadata.duration, metadata.width, metadata.height)

        // Extract audio
        setLoadingStep('audio')
        const appPath = await window.api.file.getAppPath()
        const audioPath = `${appPath}/temp_audio_${Date.now()}.wav`
        const extractedPath = await window.api.ffmpeg.extractAudio(filePath, audioPath)
        setAudioPath(extractedPath)

        setIsLoading(false)
        setLoadingStep(null)

        // Ask user if they want to transcribe
        const shouldTranscribe = confirm(
          'Video geladen! Möchtest du jetzt die Transkription starten?'
        )

        if (shouldTranscribe) {
          await startTranscription(extractedPath)
        }
      } catch (err) {
        setIsLoading(false)
        setLoadingStep(null)
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Videos')
        console.error('Error loading video:', err)
      }
    },
    [createProject, setVideoMetadata, setAudioPath]
  )

  const startTranscription = async (audioPath: string) => {
    setIsTranscribing(true)
    setTranscriptionProgress({ stage: 'loading', percent: 0, message: 'Starte...' })

    try {
      // Set up progress listener
      const unsubscribe = window.api.whisper.onProgress((progress) => {
        setTranscriptionProgress(progress)
      })

      // Start whisper service with MLX backend (Apple Silicon GPU)
      await window.api.whisper.start({
        model: 'large-v3',
        language: 'de',
        device: 'mps'
      })

      // Transcribe
      const result = await window.api.whisper.transcribe(audioPath, {
        language: 'de',
        diarize: true
      })

      unsubscribe()

      // Update project with results
      setTranscriptionResult(result)
    } catch (err) {
      console.error('Transcription error:', err)
      setError(err instanceof Error ? err.message : 'Transkription fehlgeschlagen')
    } finally {
      setIsTranscribing(false)
      setTranscriptionProgress(null)
    }
  }

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)

      const files = e.dataTransfer.files
      if (files.length > 0) {
        const file = files[0]
        // Get the file path - in Electron, we can access the path property
        const filePath = (file as File & { path?: string }).path
        if (filePath) {
          handleFile(filePath)
        }
      }
    },
    [handleFile]
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleClick = useCallback(async () => {
    const filePath = await window.api.file.selectVideo()
    if (filePath) {
      handleFile(filePath)
    }
  }, [handleFile])

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div
        className={`
          w-full max-w-2xl aspect-video
          drop-zone rounded-2xl
          flex flex-col items-center justify-center
          cursor-pointer transition-all
          ${isDragging ? 'active' : ''}
          ${isLoading ? 'opacity-50 pointer-events-none' : ''}
        `}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
      >
        {isLoading ? (
          <>
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mb-4" />
            <p className="text-dark-300 font-medium">
              {loadingStep === 'metadata' && 'Video-Metadaten werden gelesen...'}
              {loadingStep === 'audio' && 'Audio wird extrahiert...'}
              {!loadingStep && 'Video wird geladen...'}
            </p>
            <p className="text-dark-500 text-sm mt-2">
              {loadingStep === 'audio' && 'Dies kann bei längeren Videos einige Zeit dauern'}
            </p>
          </>
        ) : (
          <>
            {/* Icon */}
            <div className="w-20 h-20 rounded-full bg-dark-800 flex items-center justify-center mb-6">
              <svg
                className="w-10 h-10 text-dark-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
                />
              </svg>
            </div>

            {/* Text */}
            <h2 className="text-xl font-semibold text-white mb-2">
              Video hierher ziehen
            </h2>
            <p className="text-dark-400 text-center">
              oder klicken zum Auswählen
              <br />
              <span className="text-sm">MP4, MOV, AVI, MKV</span>
            </p>

            {/* Error */}
            {error && (
              <p className="mt-4 text-red-400 text-sm text-center max-w-md">{error}</p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
