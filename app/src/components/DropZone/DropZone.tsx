import { useState, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore } from '@/store/uiStore'
import ProjectBrowser from '@/components/ProjectBrowser/ProjectBrowser'
import { Card } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { ffmpeg, transcription, projects, files } from '@/lib/api'
import { getSettings } from '@/lib/settings'
import { Film, CheckCircle, AlertCircle, ArrowUp } from 'lucide-react'

type LoadingStep = 'metadata' | 'audio' | 'loading-project' | null

const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi']

function isVideoFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext !== undefined && VIDEO_EXTENSIONS.includes(ext)
}

export default function DropZone() {
  const { t } = useTranslation()
  const [isDragging, setIsDragging] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [loadingStep, setLoadingStep] = useState<LoadingStep>(null)
  const [error, setError] = useState<string | null>(null)
  const [isHovering, setIsHovering] = useState(false)
  const [isMounted, setIsMounted] = useState(false)

  const { createProject, loadProject, setVideoMetadata, setAudioPath, setTranscriptionResult } =
    useProjectStore()
  const { setIsTranscribing, setTranscriptionProgress, resetPlaybackState } = useUIStore()

  // Handle opening an existing project
  const handleOpenProject = useCallback(
    async (projectId: string) => {
      setIsLoading(true)
      setLoadingStep('loading-project')
      setError(null)
      resetPlaybackState()

      try {
        const storedProject = await projects.load(projectId)
        if (!storedProject) {
          throw new Error(t('dropZone.projectNotFound'))
        }
        loadProject(storedProject)
        setIsLoading(false)
        setLoadingStep(null)
      } catch (err) {
        setIsLoading(false)
        setLoadingStep(null)
        setError(err instanceof Error ? err.message : t('dropZone.errorLoadingProject'))
        console.error('Error loading project:', err)
      }
    },
    [loadProject, resetPlaybackState, t]
  )

  // Entrance animation
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 50)
    return () => clearTimeout(timer)
  }, [])

  const startTranscription = useCallback(
    async (audioPath: string) => {
      setIsTranscribing(true)
      setTranscriptionProgress({ stage: 'loading', percent: 0, message: t('transcription.starting') })

      try {
        const unsubscribe = transcription.onProgress((progress) => {
          setTranscriptionProgress(progress)
        })

        const settings = await getSettings()
        const language = settings.transcriptionLanguage
        const result = await transcription.transcribe(audioPath, {
          language: language && language !== 'auto' ? language : undefined,
          diarize: settings.autoDiarize ?? false
        })

        unsubscribe()
        setTranscriptionResult(result)
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : t('dropZone.transcriptionFailed')
        console.error('Transcription error:', err)
        setError(String(errorMsg))
      } finally {
        setIsTranscribing(false)
        setTranscriptionProgress(null)
        // Audio file is kept — needed for waveform, AI correction and realignment
      }
    },
    [setIsTranscribing, setTranscriptionProgress, setTranscriptionResult, t]
  )

  const handleFile = useCallback(
    async (filePath: string) => {
      setIsLoading(true)
      setLoadingStep('metadata')
      setError(null)
      resetPlaybackState()

      try {
        const fileName = filePath.split('/').pop() || 'Untitled'
        const projectName = fileName.replace(/\.[^.]+$/, '')

        createProject(filePath, projectName)

        const metadata = await ffmpeg.getMetadata(filePath)
        setVideoMetadata(metadata.duration, metadata.width, metadata.height)

        setLoadingStep('audio')
        const audioPath = await ffmpeg.extractAudio(filePath)
        setAudioPath(audioPath)

        setIsLoading(false)
        setLoadingStep(null)

        await startTranscription(audioPath)
      } catch (err) {
        setIsLoading(false)
        setLoadingStep(null)
        const errorMsg = err instanceof Error ? err.message : t('dropZone.errorLoadingVideo')
        setError(String(errorMsg))
        console.error('Error loading video:', err)
      }
    },
    [createProject, setVideoMetadata, setAudioPath, resetPlaybackState, startTranscription, t]
  )

  // Native drag & drop via Tauri webview events (HTML5 drop has no file paths in Tauri)
  useEffect(() => {
    const webview = getCurrentWebview()
    const unlistenPromise = webview.onDragDropEvent((event) => {
      if (isLoading) return
      if (event.payload.type === 'over') {
        setIsDragging(true)
      } else if (event.payload.type === 'drop') {
        setIsDragging(false)
        const videoPath = event.payload.paths.find(isVideoFile)
        if (videoPath) {
          handleFile(videoPath)
        }
      } else {
        setIsDragging(false)
      }
    })
    return () => {
      unlistenPromise.then((unlisten) => unlisten())
    }
  }, [handleFile, isLoading])

  const handleClick = useCallback(async () => {
    const filePath = await files.selectVideo()
    if (filePath) {
      handleFile(filePath)
    }
  }, [handleFile])

  // Cmd+O shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === 'o') {
        e.preventDefault()
        if (!isLoading) handleClick()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleClick, isLoading])

  const loadingProgress =
    loadingStep === 'metadata' ? 30 : loadingStep === 'audio' ? 70 : loadingStep === 'loading-project' ? 50 : 0

  return (
    <div className="min-h-full flex flex-col items-center p-6 md:p-8 pb-12 overflow-y-auto">
      <div className="flex-1 min-h-8 max-h-32" />

      {/* Main drop zone container */}
      <div
        className={cn(
          'relative w-full max-w-xl transition-all duration-500',
          isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        )}
      >
        {/* Ambient glow behind the drop zone.
            Uses a radial gradient instead of filter:blur — WKWebView clips
            large blurred layers to a hard rectangle after transitions end. */}
        <div
          className={cn(
            'absolute -inset-16 pointer-events-none',
            'transition-opacity duration-500',
            isDragging ? 'opacity-100' : isHovering ? 'opacity-50' : 'opacity-0'
          )}
          style={{
            background:
              'radial-gradient(ellipse 70% 70% at 50% 50%, color-mix(in oklch, var(--primary) 16%, transparent) 0%, transparent 70%)'
          }}
        />

        <Card
          className={cn(
            'relative group aspect-[16/10] p-0',
            'flex flex-col items-center justify-center',
            'cursor-pointer overflow-hidden',
            'transition-all duration-300',
            'border-2 border-dashed',
            isDragging
              ? 'border-primary bg-primary/10 scale-[1.02] glow-primary'
              : isHovering
                ? 'border-muted-foreground/30 bg-card/80 shadow-xl scale-[1.01]'
                : 'border-border/60 bg-card/50',
            isLoading && 'pointer-events-none'
          )}
          onClick={!isLoading ? handleClick : undefined}
          onMouseEnter={() => setIsHovering(true)}
          onMouseLeave={() => setIsHovering(false)}
        >
          {/* Dot pattern background */}
          <div className="absolute inset-0 opacity-[0.03]">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)`,
                backgroundSize: '24px 24px'
              }}
            />
          </div>

          {/* Corner accents */}
          {(['top-3 left-3 border-l-2 border-t-2 rounded-tl-lg',
             'top-3 right-3 border-r-2 border-t-2 rounded-tr-lg',
             'bottom-3 left-3 border-l-2 border-b-2 rounded-bl-lg',
             'bottom-3 right-3 border-r-2 border-b-2 rounded-br-lg'] as const).map((pos) => (
            <div
              key={pos}
              className={cn(
                'absolute transition-all duration-300',
                pos,
                isDragging ? 'border-primary w-12 h-12' : 'border-muted-foreground/30 w-8 h-8'
              )}
            />
          ))}

          {/* Content */}
          <div className="relative z-10 flex flex-col items-center px-6">
            {isLoading ? (
              <div className="flex flex-col items-center animate-fade-in">
                {/* Progress ring */}
                <div className="relative w-16 h-16 mb-6">
                  <div className="absolute inset-0 rounded-full border-2 border-muted/40" />
                  <svg className="absolute inset-0 w-full h-full -rotate-90">
                    <circle
                      cx="32"
                      cy="32"
                      r="30"
                      fill="none"
                      stroke="var(--primary)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeDasharray={`${loadingProgress * 1.88} 188`}
                      className="transition-all duration-500"
                    />
                  </svg>
                  <div className="absolute inset-3 rounded-full bg-primary/20 animate-pulse-soft" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-6 h-6 text-primary animate-pulse-soft" />
                  </div>
                </div>

                <p className="text-foreground font-medium text-center mb-1">
                  {loadingStep === 'metadata' && t('dropZone.analyzingVideo')}
                  {loadingStep === 'audio' && t('dropZone.extractingAudio')}
                  {loadingStep === 'loading-project' && t('dropZone.loadingProject')}
                  {!loadingStep && t('dropZone.videoLoading')}
                </p>
                <p className="text-muted-foreground text-sm text-center">
                  {loadingStep === 'audio'
                    ? t('dropZone.audioExtractionHint')
                    : loadingStep === 'loading-project'
                      ? t('dropZone.projectRestoring')
                      : t('dropZone.pleaseWait')}
                </p>

                <Progress value={loadingProgress} className="w-48 h-1.5 mt-4" />
              </div>
            ) : (
              <>
                {/* Icon */}
                <div
                  className={cn(
                    'relative w-20 h-20 mb-6 transition-all duration-300',
                    isDragging ? 'scale-110' : isHovering ? 'scale-105' : 'scale-100'
                  )}
                >
                  <div
                    className={cn(
                      'absolute -inset-2 rounded-full',
                      'bg-gradient-to-br from-primary/30 to-primary/10',
                      'transition-all duration-300 blur-md',
                      isDragging ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                    )}
                  />
                  <div
                    className={cn(
                      'relative w-full h-full rounded-2xl flex items-center justify-center',
                      'transition-all duration-300',
                      isDragging ? 'bg-primary/20 glow-primary' : 'bg-secondary/60 group-hover:bg-secondary'
                    )}
                  >
                    <Film
                      className={cn(
                        'w-9 h-9 transition-all duration-300',
                        isDragging ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
                      )}
                      strokeWidth={1.5}
                    />
                  </div>
                  <div
                    className={cn(
                      'absolute -bottom-1 left-1/2 -translate-x-1/2',
                      'w-6 h-6 rounded-full bg-primary flex items-center justify-center',
                      'transition-all duration-300',
                      isDragging ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-75'
                    )}
                  >
                    <ArrowUp className="w-3.5 h-3.5 text-primary-foreground" strokeWidth={2.5} />
                  </div>
                </div>

                <h2
                  className={cn(
                    'text-lg font-semibold mb-2 text-center transition-colors duration-300',
                    isDragging ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {isDragging ? t('dropZone.dropToUpload') : t('dropZone.dragVideoHere')}
                </h2>

                <p className="text-muted-foreground text-sm text-center mb-4">
                  {t('dropZone.orClickToSelect')}
                </p>

                <Badge
                  variant="secondary"
                  className="gap-2 px-3 py-1.5 rounded-full bg-secondary/50 border border-border/30"
                >
                  <CheckCircle className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground font-normal">
                    {t('dropZone.supportedFormats')}
                  </span>
                </Badge>

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
        </Card>

        {/* Keyboard hint */}
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
            <span className="ml-1">{t('dropZone.keyboardHint')}</span>
          </div>
        </div>
      </div>

      {/* Recent projects */}
      {!isLoading && <ProjectBrowser onOpenProject={handleOpenProject} />}

      <div className="flex-1 min-h-4" />
    </div>
  )
}
