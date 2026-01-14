import { useRef, useCallback, useEffect, createContext, useContext, ReactNode } from 'react'
import { useUIStore } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'

/**
 * Playback Controller
 *
 * This provides a centralized, single-source-of-truth approach to
 * video/timeline synchronization. It solves race conditions and sync issues
 * by using requestAnimationFrame instead of the unreliable timeupdate event.
 *
 * Architecture:
 * - During PLAYBACK: RAF loop reads video.currentTime and updates store
 * - During SEEKING: Store is updated first, then video seeks to match
 * - All time changes flow through this controller
 */

export interface PlaybackControllerState {
  // State (read from store)
  isPlaying: boolean
  currentTime: number
  duration: number

  // Actions
  play: () => void
  pause: () => void
  toggle: () => void
  seek: (time: number) => void
  skip: (seconds: number) => void
  startScrubbing: () => void
  endScrubbing: (wasPlaying: boolean) => void

  // Video registration
  registerVideo: (video: HTMLVideoElement | null) => void
  videoRef: React.RefObject<HTMLVideoElement | null>

  // Event handlers for video element
  handleEnded: () => void
  handleError: (error: MediaError | null) => void
  handleLoadedMetadata: () => void
}

const PlaybackControllerContext = createContext<PlaybackControllerState | null>(null)

export function PlaybackControllerProvider({ children }: { children: ReactNode }) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const isSeekingRef = useRef(false)

  const { project } = useProjectStore()
  const {
    isPlaying,
    currentTime,
    setIsPlaying,
    setCurrentTime,
    setIsScrubbing
  } = useUIStore()

  const duration = project?.duration ?? 0

  /**
   * RAF-based playback sync loop
   * Runs at 60fps for smooth time updates during playback
   */
  const startPlaybackLoop = useCallback(() => {
    const tick = () => {
      const video = videoRef.current
      if (!video) {
        rafIdRef.current = requestAnimationFrame(tick)
        return
      }

      // Only update store if not currently seeking
      if (!isSeekingRef.current) {
        const videoTime = video.currentTime
        // Use direct store access to avoid stale closure
        const storeTime = useUIStore.getState().currentTime

        // Only update if there's a meaningful difference (> 16ms = 1 frame at 60fps)
        if (Math.abs(videoTime - storeTime) > 0.016) {
          setCurrentTime(videoTime)
        }
      }

      // Continue loop if still playing
      if (useUIStore.getState().isPlaying) {
        rafIdRef.current = requestAnimationFrame(tick)
      }
    }

    // Cancel any existing loop
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }

    rafIdRef.current = requestAnimationFrame(tick)
  }, [setCurrentTime])

  /**
   * Stop the RAF playback loop
   */
  const stopPlaybackLoop = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
      rafIdRef.current = null
    }
  }, [])

  /**
   * Seek to a specific time
   * Updates store immediately, then syncs video
   */
  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration))

    // Mark as seeking to prevent RAF from overwriting
    isSeekingRef.current = true

    // Update store first (source of truth during seek)
    setCurrentTime(clampedTime)

    // Sync video to store - always try to set, even if readyState is low
    // The browser will buffer if needed
    const video = videoRef.current
    if (video) {
      video.currentTime = clampedTime
    }

    // Clear seeking flag after a short delay to allow video to catch up
    setTimeout(() => {
      isSeekingRef.current = false
    }, 50)
  }, [duration, setCurrentTime])

  /**
   * Start playback
   */
  const play = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    // ALWAYS sync video position to store time before playing
    // This is critical - the store is the source of truth
    const storeTime = useUIStore.getState().currentTime
    video.currentTime = storeTime

    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true)
          startPlaybackLoop()
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Play failed:', error)
            setIsPlaying(false)
          }
        })
    }
  }, [setIsPlaying, startPlaybackLoop])

  /**
   * Pause playback
   */
  const pause = useCallback(() => {
    const video = videoRef.current
    if (video && !video.paused) {
      video.pause()
    }
    setIsPlaying(false)
    stopPlaybackLoop()
  }, [setIsPlaying, stopPlaybackLoop])

  /**
   * Toggle play/pause
   */
  const toggle = useCallback(() => {
    if (useUIStore.getState().isPlaying) {
      pause()
    } else {
      play()
    }
  }, [play, pause])

  /**
   * Start scrubbing mode
   * Pauses video but remembers play state for resume
   */
  const startScrubbing = useCallback(() => {
    setIsScrubbing(true)
    stopPlaybackLoop()

    // Pause video during scrub for smoother seeking
    const video = videoRef.current
    if (video && !video.paused) {
      video.pause()
    }
  }, [setIsScrubbing, stopPlaybackLoop])

  /**
   * End scrubbing mode
   * Resumes playback if it was playing before scrub
   */
  const endScrubbing = useCallback((wasPlaying: boolean) => {
    setIsScrubbing(false)

    if (wasPlaying) {
      // Small delay to ensure video is ready after seeking
      setTimeout(() => {
        play()
      }, 50)
    }
  }, [setIsScrubbing, play])

  /**
   * Skip forward/backward by seconds
   */
  const skip = useCallback((seconds: number) => {
    const newTime = useUIStore.getState().currentTime + seconds
    seek(newTime)
  }, [seek])

  /**
   * Register video element
   */
  const registerVideo = useCallback((video: HTMLVideoElement | null) => {
    videoRef.current = video

    if (video) {
      // Sync video to current store time on registration
      const storeTime = useUIStore.getState().currentTime
      if (video.readyState >= 1 && Math.abs(video.currentTime - storeTime) > 0.1) {
        video.currentTime = storeTime
      }
    }
  }, [])

  /**
   * Handle video ended event
   */
  const handleEnded = useCallback(() => {
    pause()
    setCurrentTime(duration)
  }, [pause, setCurrentTime, duration])

  /**
   * Handle video error
   */
  const handleError = useCallback((error: MediaError | null) => {
    if (error) {
      console.error('Video error:', error.code, error.message)
      pause()
    }
  }, [pause])

  /**
   * Handle video metadata loaded - sync video position to store
   */
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current
    if (!video) return

    // Sync video to current store time when metadata is ready
    const storeTime = useUIStore.getState().currentTime
    if (storeTime > 0) {
      video.currentTime = storeTime
    }
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlaybackLoop()
    }
  }, [stopPlaybackLoop])

  // Sync isPlaying state changes (e.g., from keyboard shortcuts elsewhere)
  useEffect(() => {
    if (isPlaying) {
      const video = videoRef.current
      if (video && video.paused) {
        play()
      } else if (video && !video.paused) {
        startPlaybackLoop()
      }
    } else {
      stopPlaybackLoop()
    }
  }, [isPlaying, play, startPlaybackLoop, stopPlaybackLoop])

  const value: PlaybackControllerState = {
    isPlaying,
    currentTime,
    duration,
    play,
    pause,
    toggle,
    seek,
    skip,
    startScrubbing,
    endScrubbing,
    registerVideo,
    videoRef,
    handleEnded,
    handleError,
    handleLoadedMetadata,
  }

  return (
    <PlaybackControllerContext.Provider value={value}>
      {children}
    </PlaybackControllerContext.Provider>
  )
}

export function usePlaybackController(): PlaybackControllerState {
  const context = useContext(PlaybackControllerContext)
  if (!context) {
    throw new Error('usePlaybackController must be used within PlaybackControllerProvider')
  }
  return context
}

export type PlaybackController = PlaybackControllerState
