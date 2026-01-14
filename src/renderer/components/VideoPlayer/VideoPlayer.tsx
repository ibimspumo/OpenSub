import { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { usePlaybackController } from '../../hooks/usePlaybackController'
import SubtitleCanvas from './SubtitleCanvas'

export default function VideoPlayer() {
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const { project } = useProjectStore()
  const controller = usePlaybackController()

  // UI state
  const [showControls, setShowControls] = useState(true)
  const [isHoveringProgress, setIsHoveringProgress] = useState(false)
  const [isDraggingProgress, setIsDraggingProgress] = useState(false)
  const [isHoveringVolume, setIsHoveringVolume] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [volume, setVolume] = useState(1)
  const [previousVolume, setPreviousVolume] = useState(1)
  const [playAnimationKey, setPlayAnimationKey] = useState(0)
  const controlsTimeoutRef = useRef<NodeJS.Timeout>()

  // Detect if video is portrait format
  const isPortrait = useMemo(() => {
    if (!project?.resolution) return false
    return project.resolution.height > project.resolution.width
  }, [project?.resolution])

  // Calculate aspect ratio style
  const aspectRatioStyle = useMemo(() => {
    if (!project?.resolution) return {}
    const { width, height } = project.resolution
    return { aspectRatio: `${width}/${height}` }
  }, [project?.resolution])

  // Register video element with controller
  const videoCallbackRef = useCallback((video: HTMLVideoElement | null) => {
    controller.registerVideo(video)
  }, [controller])

  // Handle play/pause with animation
  const handleTogglePlay = useCallback(() => {
    setPlayAnimationKey((prev) => prev + 1)
    controller.toggle()
  }, [controller])

  // Handle mute toggle
  const toggleMute = useCallback(() => {
    const video = controller.videoRef.current
    if (isMuted) {
      setVolume(previousVolume)
      if (video) video.volume = previousVolume
      setIsMuted(false)
    } else {
      setPreviousVolume(volume)
      setVolume(0)
      if (video) video.volume = 0
      setIsMuted(true)
    }
  }, [isMuted, previousVolume, volume, controller.videoRef])

  // Auto-hide controls
  const resetControlsTimeout = useCallback(() => {
    setShowControls(true)
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current)
    }
    if (controller.isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false)
      }, 3000)
    }
  }, [controller.isPlaying])

  // Show controls on mouse movement
  const handleMouseMove = useCallback(() => {
    resetControlsTimeout()
  }, [resetControlsTimeout])

  // Keep controls visible when not playing
  useEffect(() => {
    if (!controller.isPlaying) {
      setShowControls(true)
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    } else {
      resetControlsTimeout()
    }
    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current)
      }
    }
  }, [controller.isPlaying, resetControlsTimeout])

  // Progress bar click handler
  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!progressRef.current || !project) return
      const rect = progressRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const newTime = percent * project.duration
      controller.seek(newTime)
    },
    [project, controller]
  )

  // Progress bar drag handlers
  const handleProgressDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      setIsDraggingProgress(true)
      handleProgressClick(e)
    },
    [handleProgressClick]
  )

  useEffect(() => {
    if (!isDraggingProgress) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!progressRef.current || !project) return
      const rect = progressRef.current.getBoundingClientRect()
      const percent = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      const newTime = percent * project.duration
      controller.seek(newTime)
    }

    const handleMouseUp = () => {
      setIsDraggingProgress(false)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDraggingProgress, project, controller])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          handleTogglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          controller.skip(-5)
          break
        case 'ArrowRight':
          e.preventDefault()
          controller.skip(5)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTogglePlay, controller])

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!project) return null

  // Calculate progress percentage
  const progressPercent = project.duration > 0 ? (controller.currentTime / project.duration) * 100 : 0

  // Volume icon based on level
  const VolumeIcon = () => {
    if (isMuted || volume === 0) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
        </svg>
      )
    }
    if (volume < 0.5) {
      return (
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.5 12c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM5 9v6h4l5 5V4L9 9H5z" />
        </svg>
      )
    }
    return (
      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      </svg>
    )
  }

  return (
    <div
      className={`
        h-full flex flex-col group/player
        ${isPortrait ? 'max-h-full w-auto mx-auto' : 'w-full'}
      `}
      style={isPortrait ? aspectRatioStyle : undefined}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setShowControls(true)}
    >
      {/* Video Container */}
      <div
        ref={containerRef}
        className={`
          flex-1 relative overflow-hidden
          rounded-xl
          bg-gradient-to-b from-dark-900/50 to-black
          shadow-dark-lg
          ring-1 ring-white/[0.06]
          transition-all duration-300 ease-smooth
        `}
        style={isPortrait ? aspectRatioStyle : undefined}
      >
        {/* Inner glow effect */}
        <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/[0.03] pointer-events-none z-10" />

        {/* Video Element - Simplified */}
        <video
          ref={videoCallbackRef}
          src={`media://${encodeURIComponent(project.videoPath)}`}
          className="w-full h-full object-contain transition-transform duration-500 ease-smooth"
          onEnded={controller.handleEnded}
          onError={(e) => controller.handleError(e.currentTarget.error)}
          onClick={handleTogglePlay}
        />

        {/* Subtitle Canvas Overlay */}
        <SubtitleCanvas
          currentTime={controller.currentTime}
          subtitles={project.subtitles}
          style={project.style}
          videoWidth={project.resolution.width}
          videoHeight={project.resolution.height}
          videoRef={controller.videoRef}
        />

        {/* Play/Pause Center Overlay Animation */}
        <div
          key={playAnimationKey}
          className={`
            absolute inset-0 flex items-center justify-center
            pointer-events-none z-20
            ${playAnimationKey > 0 ? 'animate-fade-out' : 'opacity-0'}
          `}
          style={{ animationDuration: '500ms' }}
        >
          <div
            className={`
              w-16 h-16 rounded-full
              bg-black/40 backdrop-blur-sm
              flex items-center justify-center
              ${playAnimationKey > 0 ? 'animate-scale-bounce' : ''}
            `}
          >
            {controller.isPlaying ? (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            ) : (
              <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            )}
          </div>
        </div>

        {/* Bottom Gradient Overlay */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 h-32
            bg-gradient-to-t from-black/80 via-black/40 to-transparent
            pointer-events-none
            transition-opacity duration-300 ease-smooth
            ${showControls ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Inline Progress Bar */}
        <div
          className={`
            absolute bottom-0 left-0 right-0 px-4 pb-3
            transition-all duration-300 ease-smooth
            ${showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
          `}
        >
          <div
            ref={progressRef}
            className={`
              relative h-1 rounded-full overflow-visible
              bg-white/20 backdrop-blur-sm
              cursor-pointer group/progress
              transition-all duration-200 ease-spring
              ${isHoveringProgress || isDraggingProgress ? 'h-1.5' : 'h-1'}
            `}
            onMouseDown={handleProgressDragStart}
            onMouseEnter={() => setIsHoveringProgress(true)}
            onMouseLeave={() => setIsHoveringProgress(false)}
          >
            <div
              className="absolute inset-y-0 left-0 bg-white/10 rounded-full"
              style={{ width: '100%' }}
            />
            <div
              className={`
                absolute inset-y-0 left-0 rounded-full
                bg-gradient-to-r from-primary-500 to-primary-400
                transition-all duration-75 ease-out
                ${isHoveringProgress || isDraggingProgress ? 'shadow-glow-blue' : ''}
              `}
              style={{ width: `${progressPercent}%` }}
            />
            <div
              className={`
                absolute top-1/2 -translate-y-1/2
                w-3 h-3 rounded-full
                bg-white shadow-md
                transition-all duration-150 ease-spring
                ${isHoveringProgress || isDraggingProgress ? 'opacity-100 scale-100' : 'opacity-0 scale-75'}
              `}
              style={{
                left: `${progressPercent}%`,
                transform: `translateX(-50%) translateY(-50%)`,
              }}
            />
          </div>

          <div className="flex items-center justify-between mt-2">
            <span className="text-[10px] font-medium text-white/70 tabular-nums">
              {formatTime(controller.currentTime)}
            </span>
            <span className="text-[10px] font-medium text-white/50 tabular-nums">
              {formatTime(project.duration)}
            </span>
          </div>
        </div>
      </div>

      {/* External Controls Bar */}
      <div
        className={`
          mt-3 flex items-center gap-3
          transition-all duration-300 ease-smooth
          ${showControls ? 'opacity-100 translate-y-0' : 'opacity-50'}
        `}
      >
        {/* Play/Pause Button */}
        <button
          onClick={handleTogglePlay}
          className={`
            relative w-10 h-10 rounded-full
            bg-gradient-to-br from-primary-500 to-primary-600
            hover:from-primary-400 hover:to-primary-500
            flex items-center justify-center
            shadow-md shadow-primary-500/25
            transition-all duration-200 ease-spring
            hover:scale-105 hover:shadow-lg hover:shadow-primary-500/30
            active:scale-95
            focus-ring
          `}
        >
          <div className="absolute inset-[1px] rounded-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none" />
          <div className="relative">
            {controller.isPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </div>
        </button>

        {/* Skip Backward */}
        <button
          onClick={() => controller.skip(-5)}
          className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/[0.06] transition-all duration-150 ease-spring hover:scale-105 active:scale-95"
          title="5 Sekunden zurück"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.334 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z" />
          </svg>
        </button>

        {/* Skip Forward */}
        <button
          onClick={() => controller.skip(5)}
          className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/[0.06] transition-all duration-150 ease-spring hover:scale-105 active:scale-95"
          title="5 Sekunden vor"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z" />
          </svg>
        </button>

        <div className="flex-1" />

        {/* Time Display */}
        <div className="hidden sm:flex items-center gap-1 text-xs text-dark-400 font-mono tabular-nums">
          <span className="text-dark-300">{formatTime(controller.currentTime)}</span>
          <span className="text-dark-600">/</span>
          <span>{formatTime(project.duration)}</span>
        </div>

        {/* Volume Control */}
        <div
          className="flex items-center gap-1"
          onMouseEnter={() => setIsHoveringVolume(true)}
          onMouseLeave={() => setIsHoveringVolume(false)}
        >
          <button
            onClick={toggleMute}
            className="p-2 rounded-lg text-dark-400 hover:text-white hover:bg-white/[0.06] transition-all duration-150 ease-spring hover:scale-105 active:scale-95"
          >
            <VolumeIcon />
          </button>

          <div
            className={`
              overflow-hidden transition-all duration-200 ease-spring
              ${isHoveringVolume ? 'w-20 opacity-100' : 'w-0 opacity-0'}
            `}
          >
            <div className="relative h-1 w-20 bg-dark-700 rounded-full group/vol">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary-500 to-primary-400 rounded-full transition-all duration-75"
                style={{ width: `${volume * 100}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white shadow-sm transition-opacity duration-150 group-hover/vol:opacity-100 opacity-0"
                style={{
                  left: `${volume * 100}%`,
                  transform: `translateX(-50%) translateY(-50%)`,
                }}
              />
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={volume}
                onChange={(e) => {
                  const newVolume = parseFloat(e.target.value)
                  setVolume(newVolume)
                  setIsMuted(newVolume === 0)
                  if (controller.videoRef.current) {
                    controller.videoRef.current.volume = newVolume
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
