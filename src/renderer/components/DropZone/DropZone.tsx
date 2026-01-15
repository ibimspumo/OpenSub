import { useState, useCallback, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import ProjectBrowser from '../ProjectBrowser/ProjectBrowser'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import {
  Upload,
  Film,
  CheckCircle,
  AlertCircle,
  Loader2,
  ArrowUp
} from 'lucide-react'

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

      window.api.debug.log('info', 'renderer', 'handleFile called', { filePath })

      try {
        // Get video filename for project name
        const fileName = filePath.split('/').pop() || 'Untitled'
        const projectName = fileName.replace(/\.[^.]+$/, '')

        // Create project
        window.api.debug.log('info', 'renderer', 'Creating project', { projectName })
        createProject(filePath, projectName)

        // Get video metadata
        window.api.debug.log('info', 'renderer', 'Getting metadata...')
        const metadata = await window.api.ffmpeg.getMetadata(filePath)
        window.api.debug.log('info', 'renderer', 'Metadata received', { metadata })
        setVideoMetadata(metadata.duration, metadata.width, metadata.height)

        // Extract audio to system temp directory
        setLoadingStep('audio')
        window.api.debug.log('info', 'renderer', 'Extracting audio...')
        const tempDir = await window.api.file.getTempDir()
        const audioPath = `${tempDir}/opensub_audio_${Date.now()}.wav`
        const extractedPath = await window.api.ffmpeg.extractAudio(filePath, audioPath)
        window.api.debug.log('info', 'renderer', 'Audio extracted', { extractedPath })
        setAudioPath(extractedPath)

        setIsLoading(false)
        setLoadingStep(null)

        // Start transcription automatically
        window.api.debug.log('info', 'renderer', 'Starting transcription...')
        await startTranscription(extractedPath)
      } catch (err) {
        setIsLoading(false)
        setLoadingStep(null)
        const errorMsg = err instanceof Error ? err.message : 'Fehler beim Laden des Videos'
        window.api.debug.log('error', 'renderer', 'handleFile error', { error: errorMsg })
        setError(errorMsg)
        console.error('Error loading video:', err)
      }
    },
    [createProject, setVideoMetadata, setAudioPath]
  )

  const startTranscription = async (audioPath: string) => {
    window.api.debug.log('info', 'renderer', 'startTranscription called', { audioPath })
    setIsTranscribing(true)
    setTranscriptionProgress({ stage: 'loading', percent: 0, message: 'Starte...' })

    try {
      // Set up progress listener
      const unsubscribe = window.api.whisper.onProgress((progress) => {
        window.api.debug.log('debug', 'renderer', 'Transcription progress', { progress })
        setTranscriptionProgress(progress)
      })

      // Start whisper service with MLX backend (Apple Silicon GPU)
      window.api.debug.log('info', 'renderer', 'Calling whisper.start...')
      await window.api.whisper.start({
        model: 'large-v3',
        language: 'de',
        device: 'mps'
      })
      window.api.debug.log('info', 'renderer', 'whisper.start completed')

      // Transcribe
      window.api.debug.log('info', 'renderer', 'Calling whisper.transcribe...')
      const result = await window.api.whisper.transcribe(audioPath, {
        language: 'de'
      })
      window.api.debug.log('info', 'renderer', 'whisper.transcribe completed', { segmentCount: result?.segments?.length })

      unsubscribe()

      // Update project with results
      window.api.debug.log('info', 'renderer', 'Setting transcription result...')
      setTranscriptionResult(result)
      window.api.debug.log('info', 'renderer', 'Transcription flow completed successfully')
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Transkription fehlgeschlagen'
      window.api.debug.log('error', 'renderer', 'startTranscription error', { error: errorMsg })
      console.error('Transcription error:', err)
      setError(errorMsg)
    } finally {
      setIsTranscribing(false)
      setTranscriptionProgress(null)
      // Note: Audio file is NOT deleted here - it's needed for AI correction alignment
      // It will be cleaned up when the project is cleared or a new video is loaded
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
  const loadingProgress =
    loadingStep === 'metadata' ? 30 : loadingStep === 'audio' ? 70 : loadingStep === 'loading-project' ? 50 : 0

  return (
    <div className="min-h-full flex flex-col items-center p-6 md:p-8 pb-12">
      {/* Flexible spacer for vertical centering when space allows */}
      <div className="flex-1 min-h-8 max-h-32" />

      {/* Main drop zone container with entrance animation */}
      <div
        className={cn(
          'relative w-full max-w-xl transition-all duration-500 ease-spring',
          isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        {/* Ambient glow effect behind the drop zone */}
        <div
          className={cn(
            'absolute -inset-4 rounded-3xl opacity-0 blur-2xl',
            'bg-gradient-to-br from-primary/30 via-primary/10 to-transparent',
            'transition-opacity duration-500',
            isDragging ? 'opacity-100' : isHovering ? 'opacity-50' : 'opacity-0'
          )}
        />

        {/* Drop zone card using ShadCN Card */}
        <Card
          className={cn(
            'relative group aspect-[4/3] p-0',
            'flex flex-col items-center justify-center',
            'cursor-pointer overflow-hidden',
            'transition-all duration-300 ease-spring',
            'border-2 border-dashed',
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.02] shadow-glow-blue'
              : isHovering
                ? 'border-muted-foreground/30 bg-card/80 shadow-elevated scale-[1.01]'
                : 'border-border/60 bg-card/50 shadow-dark-md',
            isLoading && 'pointer-events-none'
          )}
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
            className={cn(
              'absolute inset-0',
              'bg-gradient-to-b from-white/[0.02] via-transparent to-black/10',
              'transition-opacity duration-300',
              isDragging ? 'opacity-100' : 'opacity-50'
            )}
          />

          {/* Animated corner accents */}
          <div
            className={cn(
              'absolute top-3 left-3 border-l-2 border-t-2 rounded-tl-lg',
              'transition-all duration-300',
              isDragging ? 'border-primary w-12 h-12' : 'border-muted-foreground/30 w-8 h-8'
            )}
          />
          <div
            className={cn(
              'absolute top-3 right-3 border-r-2 border-t-2 rounded-tr-lg',
              'transition-all duration-300',
              isDragging ? 'border-primary w-12 h-12' : 'border-muted-foreground/30 w-8 h-8'
            )}
          />
          <div
            className={cn(
              'absolute bottom-3 left-3 border-l-2 border-b-2 rounded-bl-lg',
              'transition-all duration-300',
              isDragging ? 'border-primary w-12 h-12' : 'border-muted-foreground/30 w-8 h-8'
            )}
          />
          <div
            className={cn(
              'absolute bottom-3 right-3 border-r-2 border-b-2 rounded-br-lg',
              'transition-all duration-300',
              isDragging ? 'border-primary w-12 h-12' : 'border-muted-foreground/30 w-8 h-8'
            )}
          />

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {isLoading ? (
              <div className="flex flex-col items-center animate-fade-in">
                {/* Loading spinner with icon */}
                <div className="relative w-16 h-16 mb-6">
                  {/* Outer ring */}
                  <div className="absolute inset-0 rounded-full border-2 border-muted/40" />
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
                        <stop offset="0%" stopColor="hsl(var(--primary))" />
                        <stop offset="100%" stopColor="hsl(var(--accent))" />
                      </linearGradient>
                    </defs>
                  </svg>
                  {/* Center pulse */}
                  <div className="absolute inset-3 rounded-full bg-primary/20 animate-pulse-soft" />
                  {/* Center icon */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-6 h-6 text-primary animate-pulse-soft" />
                  </div>
                </div>

                {/* Loading text */}
                <p className="text-foreground font-medium text-center mb-1">
                  {loadingStep === 'metadata' && 'Analysiere Video...'}
                  {loadingStep === 'audio' && 'Extrahiere Audio...'}
                  {loadingStep === 'loading-project' && 'Lade Projekt...'}
                  {!loadingStep && 'Video wird geladen...'}
                </p>
                <p className="text-muted-foreground text-sm text-center">
                  {loadingStep === 'audio'
                    ? 'Dies kann bei längeren Videos einen Moment dauern'
                    : loadingStep === 'loading-project'
                      ? 'Deine Arbeit wird wiederhergestellt'
                      : 'Bitte warten...'}
                </p>

                {/* Progress bar using ShadCN Progress */}
                <Progress value={loadingProgress} className="w-48 h-1.5 mt-4" />
              </div>
            ) : (
              <>
                {/* Icon container with hover animation */}
                <div
                  className={cn(
                    'relative w-20 h-20 mb-6',
                    'transition-all duration-300 ease-spring',
                    isDragging ? 'scale-110' : isHovering ? 'scale-105' : 'scale-100'
                  )}
                >
                  {/* Glow ring on drag */}
                  <div
                    className={cn(
                      'absolute -inset-2 rounded-full',
                      'bg-gradient-to-br from-primary/30 to-primary/10',
                      'transition-all duration-300 blur-md',
                      isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                    )}
                  />

                  {/* Icon background */}
                  <div
                    className={cn(
                      'relative w-full h-full rounded-2xl',
                      'flex items-center justify-center',
                      'transition-all duration-300',
                      isDragging
                        ? 'bg-primary/20 shadow-glow-blue'
                        : 'bg-secondary/60 group-hover:bg-secondary'
                    )}
                  >
                    {/* Video icon using Lucide */}
                    <Film
                      className={cn(
                        'w-9 h-9 transition-all duration-300',
                        isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Upload arrow indicator on drag */}
                  <div
                    className={cn(
                      'absolute -bottom-1 left-1/2 -translate-x-1/2',
                      'w-6 h-6 rounded-full bg-primary',
                      'flex items-center justify-center',
                      'transition-all duration-300 ease-spring',
                      isDragging
                        ? 'opacity-100 translate-y-0 scale-100'
                        : 'opacity-0 translate-y-2 scale-75'
                    )}
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                </div>

                {/* Title */}
                <h2
                  className={cn(
                    'text-lg font-semibold mb-2 text-center',
                    'transition-colors duration-300',
                    isDragging ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {isDragging ? 'Zum Hochladen loslassen' : 'Video hierher ziehen'}
                </h2>

                {/* Subtitle */}
                <p className="text-muted-foreground text-sm text-center mb-4">
                  oder{' '}
                  <span className="text-primary hover:text-primary/80 transition-colors cursor-pointer">
                    klicken
                  </span>{' '}
                  zum Auswählen
                </p>

                {/* Supported formats badge using ShadCN Badge */}
                <Badge
                  variant="secondary"
                  className={cn(
                    'gap-2 px-3 py-1.5 rounded-full',
                    'bg-secondary/50 border border-border/30',
                    'transition-all duration-300',
                    isHovering && 'border-border/50'
                  )}
                >
                  <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-normal">MP4, MOV, AVI, MKV</span>
                </Badge>

                {/* Error message with animation */}
                {error && (
                  <div className="mt-5 animate-fade-in-up">
                    <div className="flex items-start gap-2 px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20">
                      <AlertCircle className="w-4 h-4 text-destructive mt-0.5 flex-shrink-0" />
                      <p className="text-destructive text-sm">{error}</p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Shimmer effect on hover */}
          <div
            className={cn(
              'absolute inset-0 -translate-x-full',
              'bg-gradient-to-r from-transparent via-white/[0.03] to-transparent',
              'transition-transform duration-700',
              isHovering && !isDragging && !isLoading ? 'translate-x-full' : '-translate-x-full'
            )}
          />
        </Card>

        {/* Keyboard shortcut hint */}
        <div
          className={cn(
            'mt-4 flex justify-center transition-all duration-300',
            isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          )}
          style={{ transitionDelay: '200ms' }}
        >
          <div className="flex items-center gap-2 text-muted-foreground text-xs">
            <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/30 font-mono text-xs">
              Cmd
            </kbd>
            <span>+</span>
            <kbd className="px-1.5 py-0.5 rounded bg-secondary/50 border border-border/30 font-mono text-xs">
              O
            </kbd>
            <span className="ml-1">zum Öffnen</span>
          </div>
        </div>
      </div>

      {/* Recent Projects */}
      {!isLoading && <ProjectBrowser onOpenProject={handleOpenProject} />}

      {/* Bottom spacer for vertical centering */}
      <div className="flex-1 min-h-4" />
    </div>
  )
}
