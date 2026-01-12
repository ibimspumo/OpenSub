import { useRef, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import SubtitleCanvas from './SubtitleCanvas'

export default function VideoPlayer() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const { project } = useProjectStore()
  const { isPlaying, currentTime, volume, setIsPlaying, setCurrentTime, setVolume } =
    useUIStore()

  // Sync video with state
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying && video.paused) {
      video.play()
    } else if (!isPlaying && !video.paused) {
      video.pause()
    }
  }, [isPlaying])

  // Handle time updates from video
  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current
    if (video) {
      setCurrentTime(video.currentTime)
    }
  }, [setCurrentTime])

  // Handle play/pause
  const togglePlay = useCallback(() => {
    setIsPlaying(!isPlaying)
  }, [isPlaying, setIsPlaying])

  // Seek to time
  const seekTo = useCallback(
    (time: number) => {
      const video = videoRef.current
      if (video) {
        video.currentTime = time
        setCurrentTime(time)
      }
    },
    [setCurrentTime]
  )

  // Handle video ended
  const handleEnded = useCallback(() => {
    setIsPlaying(false)
  }, [setIsPlaying])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key) {
        case ' ':
          e.preventDefault()
          togglePlay()
          break
        case 'ArrowLeft':
          e.preventDefault()
          seekTo(Math.max(0, currentTime - 5))
          break
        case 'ArrowRight':
          e.preventDefault()
          seekTo(Math.min(project?.duration || 0, currentTime + 5))
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePlay, seekTo, currentTime, project?.duration])

  // Format time
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (!project) return null

  return (
    <div className="h-full flex flex-col">
      {/* Video Container */}
      <div
        ref={containerRef}
        className="flex-1 video-container rounded-xl overflow-hidden bg-black flex items-center justify-center relative"
      >
        <video
          ref={videoRef}
          src={`media://${encodeURIComponent(project.videoPath)}`}
          className="max-h-full max-w-full object-contain"
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
        />

        {/* Subtitle Canvas Overlay - positioned over video */}
        <SubtitleCanvas
          currentTime={currentTime}
          subtitles={project.subtitles}
          style={project.style}
          videoWidth={project.resolution.width}
          videoHeight={project.resolution.height}
          videoRef={videoRef}
        />
      </div>

      {/* Controls */}
      <div className="h-16 flex items-center gap-4 px-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="w-10 h-10 rounded-full bg-primary-600 hover:bg-primary-700 flex items-center justify-center transition-colors"
        >
          {isPlaying ? (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
            </svg>
          ) : (
            <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Time Display */}
        <div className="text-sm text-dark-300 font-mono">
          {formatTime(currentTime)} / {formatTime(project.duration)}
        </div>

        {/* Progress Bar */}
        <div className="flex-1 h-1 bg-dark-700 rounded-full overflow-hidden cursor-pointer group">
          <div
            className="h-full bg-primary-500 transition-all group-hover:bg-primary-400"
            style={{ width: `${(currentTime / project.duration) * 100}%` }}
          />
        </div>

        {/* Volume */}
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-dark-400" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => {
              const newVolume = parseFloat(e.target.value)
              setVolume(newVolume)
              if (videoRef.current) {
                videoRef.current.volume = newVolume
              }
            }}
            className="w-20 h-1 bg-dark-700 rounded-full appearance-none cursor-pointer"
          />
        </div>
      </div>
    </div>
  )
}
