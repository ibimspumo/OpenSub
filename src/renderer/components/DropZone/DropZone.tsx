import { useState, useCallback, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import ProjectBrowser from '../ProjectBrowser/ProjectBrowser'

type LoadingStep = 'metadata' | 'audio' | 'loading-project' | null

export default function DropZone() {
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const { createProject, loadProject, setVideoMetadata, setAudioPath, setTranscriptionResult } =
    useProjectStore()
  const { setIsTranscribing, setTranscriptionProgress } = useUIStore()

  // Handle opening an existing project
  const handleOpenProject = useCallback(
    async (projectId: string) => {
      setIsLoading(true)
      setLoadingStep('loading-project')
      setError(null)

      try {
        const storedProject = await window.api.project.load(projectId)
        if (!storedProject) {
          throw new Error('Projekt nicht gefunden')
        }

        // Load the project into the store
        loadProject(storedProject)

        setIsLoading(false)
        setLoadingStep(null)
      } catch (err) {
        setIsLoading(false)
        setLoadingStep(null)
        setError(err instanceof Error ? err.message : 'Fehler beim Laden des Projekts')
        console.error('Error loading project:', err)
      }
    },
    [loadProject]
  )

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

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

        // Extract audio to system temp directory
        setLoadingStep('audio')
        const tempDir = await window.api.file.getTempDir()
        const audioPath = `${tempDir}/opensub_audio_${Date.now()}.wav`
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
        language: 'de'
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

      // Clean up temporary audio file
      try {
        const deleteResult = await window.api.file.deleteTempFile(audioPath)
        if (deleteResult.success) {
          console.log('Temporary audio file cleaned up:', audioPath)
        } else {
          console.warn('Failed to delete temp audio file:', deleteResult.error)
        }
      } catch (cleanupErr) {
        console.warn('Error cleaning up temp audio file:', cleanupErr)
      }
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

  // Loading progress percentage simulation
  const loadingProgress = loadingStep === 'metadata' ? 30 : loadingStep === 'audio' ? 70 : loadingStep === 'loading-project' ? 50 : 0

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-6 md:p-8 overflow-y-auto">
      {/* Main drop zone container with entrance animation */}
      <div
        className={`
          relative w-full max-w-xl
          transition-all duration-500 ease-spring
          ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}
        `}
      >
        {/* Ambient glow effect behind the drop zone */}
        <div
          className={`
            absolute -inset-4 rounded-3xl opacity-0 blur-2xl
            bg-gradient-to-br from-primary-500/20 via-primary-600/10 to-transparent
            transition-opacity duration-500
            ${isDragging ? 'opacity-100' : isHovering ? 'opacity-50' : 'opacity-0'}
          `}
        />

        {/* Drop zone card */}
        <div
          className={`
            relative group
            aspect-[4/3] rounded-2xl
            flex flex-col items-center justify-center
            cursor-pointer overflow-hidden
            transition-all duration-300 ease-spring
            border-2 border-dashed
            ${isDragging
              ? 'border-primary-400 bg-primary-500/10 scale-[1.02] shadow-glow-blue'
              : isHovering
                ? 'border-dark-500 bg-dark-800/80 shadow-elevated scale-[1.01]'
                : 'border-dark-600/60 bg-dark-800/50 shadow-dark-md'
            }
            ${isLoading ? 'pointer-events-none' : ''}
          `}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={!isLoading ? handleClick : undefined}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Animated background pattern */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                backgroundSize: '24px 24px'
              }}
            />
          </div>

          {/* Gradient overlay for depth */}
          <div
            className={`
              absolute inset-0
              bg-gradient-to-b from-white/[0.02] via-transparent to-black/10
              transition-opacity duration-300
              ${isDragging ? 'opacity-100' : 'opacity-50'}
            `}
          />

          {/* Animated corner accents */}
          <div className={`
            absolute top-3 left-3 w-8 h-8
            border-l-2 border-t-2 rounded-tl-lg
            transition-all duration-300
            ${isDragging ? 'border-primary-400 w-12 h-12' : 'border-dark-500/40'}
          `} />
          <div className={`
            absolute top-3 right-3 w-8 h-8
            border-r-2 border-t-2 rounded-tr-lg
            transition-all duration-300
            ${isDragging ? 'border-primary-400 w-12 h-12' : 'border-dark-500/40'}
          `} />
          <div className={`
            absolute bottom-3 left-3 w-8 h-8
            border-l-2 border-b-2 rounded-bl-lg
            transition-all duration-300
            ${isDragging ? 'border-primary-400 w-12 h-12' : 'border-dark-500/40'}
          `} />
          <div className={`
            absolute bottom-3 right-3 w-8 h-8
            border-r-2 border-b-2 rounded-br-lg
            transition-all duration-300
            ${isDragging ? 'border-primary-400 w-12 h-12' : 'border-dark-500/40'}
          `} />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {isLoading ? (
              <div className="flex flex-col items-center animate-fade-in">
                {/* Premium loading spinner */}
                <div className="relative w-16 h-16 mb-6">
                  {/* Outer ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-dark-600/40" />
                  {/* Animated progress ring */}
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="url(#loadingGradient)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${loadingProgress * 1.88} 188`}
                      className="transition-all duration-500"
                    />
                    <defs>
                      <linearGradient id="loadingGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#3b82f6" />
                        <stop offset="100%" stopColor="#8b5cf6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Center pulse */}
                  <div className="absolute inset-3 rounded-full bg-primary-500/20 animate-pulse-soft" />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-primary-400 animate-pulse-soft"
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
                </div>

                {/* Loading text */}
                <p className="text-dark-200 font-medium text-center mb-1">
                  {loadingStep === 'metadata' && 'Analysiere Video...'}
                  {loadingStep === 'audio' && 'Extrahiere Audio...'}
                  {loadingStep === 'loading-project' && 'Lade Projekt...'}
                  {!loadingStep && 'Video wird geladen...'}
                </p>
                <p className="text-dark-400 text-sm text-center">
                  {loadingStep === 'audio'
                    ? 'Dies kann bei längeren Videos einen Moment dauern'
                    : loadingStep === 'loading-project'
                    ? 'Deine Arbeit wird wiederhergestellt'
                    : 'Bitte warten...'
                  }
                </p>

                {/* Progress bar */}
                <div className="w-48 h-1 mt-4 rounded-full bg-dark-700 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-400 transition-all duration-500"
                    style={{ width: `${loadingProgress}%` }}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Icon container with hover animation */}
                <div
                  className={`
                    relative w-20 h-20 mb-6
                    transition-all duration-300 ease-spring
                    ${isDragging ? 'scale-110' : isHovering ? 'scale-105' : 'scale-100'}
                  `}
                >
                  {/* Glow ring on drag */}
                  <div
                    className={`
                      absolute -inset-2 rounded-full
                      bg-gradient-to-br from-primary-500/30 to-primary-600/10
                      transition-all duration-300 blur-md
                      ${isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}
                    `}
                  />

                  {/* Icon background */}
                  <div
                    className={`
                      relative w-full h-full rounded-2xl
                      flex items-center justify-center
                      transition-all duration-300
                      ${isDragging
                        ? 'bg-primary-500/20 shadow-glow-blue'
                        : 'bg-dark-700/60 group-hover:bg-dark-700'
                      }
                    `}
                  >
                    {/* Video icon */}
                    <svg
                      className={`
                        w-9 h-9 transition-all duration-300
                        ${isDragging ? 'text-primary-400' : 'text-dark-300 group-hover:text-dark-200'}
                      `}
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

                  {/* Upload arrow indicator on drag */}
                  <div
                    className={`
                      absolute -bottom-1 left-1/2 -translate-x-1/2
                      w-6 h-6 rounded-full bg-primary-500
                      flex items-center justify-center
                      transition-all duration-300 ease-spring
                      ${isDragging
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-2 scale-75'
                      }
                    `}
                  >
                    <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
                    </svg>
                  </div>
                </div>

                {/* Title */}
                <h2
                  className={`
                    text-lg font-semibold mb-2 text-center
                    transition-colors duration-300
                    ${isDragging ? 'text-primary-300' : 'text-white'}
                  `}
                >
                  {isDragging ? 'Zum Hochladen loslassen' : 'Video hierher ziehen'}
                </h2>

                {/* Subtitle */}
                <p className="text-dark-400 text-sm text-center mb-4">
                  oder <span className="text-primary-400 hover:text-primary-300 transition-colors">klicken</span> zum Auswählen
                </p>

                {/* Supported formats badge */}
                <div
                  className={`
                    flex items-center gap-2 px-3 py-1.5 rounded-full
                    bg-dark-700/50 border border-dark-600/30
                    transition-all duration-300
                    ${isHovering ? 'border-dark-500/50' : ''}
                  `}
                >
                  <svg className="w-3.5 h-3.5 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-dark-300">MP4, MOV, AVI, MKV</span>
                </div>

                {/* Error message with animation */}
                {error && (
                  <div className="mt-5 animate-fade-in-up">
                    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
                      <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <p className="text-red-300 text-sm">{error}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Shimmer effect on hover */}
          <div
            className={`
              absolute inset-0 -translate-x-full
              bg-gradient-to-r from-transparent via-white/[0.03] to-transparent
              transition-transform duration-700
              ${isHovering && !isDragging && !isLoading ? 'translate-x-full' : '-translate-x-full'}
            `}
          />
        </div>

        {/* Keyboard shortcut hint */}
        <div
          className={`
            mt-4 flex justify-center transition-all duration-300
            ${isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="flex items-center gap-2 text-dark-500 text-xs">
            <kbd className="px-1.5 py-0.5 rounded bg-dark-700/50 border border-dark-600/30 font-mono">⌘</kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-dark-700/50 border border-dark-600/30 font-mono">O</kbd>
            <span className="ml-1">zum Öffnen</span>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      {!isLoading && (
        <ProjectBrowser onOpenProject={handleOpenProject} />
      )}
    </div>
  )
}
