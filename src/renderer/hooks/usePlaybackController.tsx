import { useRef, useCallback, useEffect, createContext, useContext, ReactNode, useMemo } from 'react'
import { useUIStore } from '../store/uiStore'
import { useProjectStore } from '../store/projectStore'

// Debug logging - set to true to enable detailed console output
const DEBUG = true
const log = (...args: unknown[]) => {
  if (DEBUG) console.log('%c[PlaybackController]', 'color: #00bcd4; font-weight: bold', ...args)
}

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
  const isAwaitingSeekRef = useRef(false)

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
    let frameCount = 0

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

        // Log first 5 frames to debug
        if (frameCount < 5) {
          log(`RAF tick #${frameCount}`, {
            videoTime,
            storeTime,
            diff: Math.abs(videoTime - storeTime),
            paused: video.paused
          })
        }
        frameCount++

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

    log('startPlaybackLoop() called')

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
   * Updates store immediately, then syncs video with event-based completion
   */
  const seek = useCallback((time: number) => {
    const clampedTime = Math.max(0, Math.min(time, duration))
    log('seek() called', { requestedTime: time, clampedTime, duration })

    // Mark as seeking to prevent RAF from overwriting
    isSeekingRef.current = true

    // Update store first (source of truth during seek)
    setCurrentTime(clampedTime)

    const video = videoRef.current
    if (video) {
      log('seek() video state', {
        readyState: video.readyState,
        HAVE_METADATA: HTMLMediaElement.HAVE_METADATA,
        hasMetadata: video.readyState >= HTMLMediaElement.HAVE_METADATA,
        currentTime: video.currentTime
      })

      // Only set currentTime if video has metadata loaded
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        // Wait for seeked event instead of fixed timeout
        const onSeeked = () => {
          log('seek() - seeked event received', { videoCurrentTime: video.currentTime })
          video.removeEventListener('seeked', onSeeked)
          isSeekingRef.current = false
        }
        video.addEventListener('seeked', onSeeked)
        video.currentTime = clampedTime
        log('seek() - set video.currentTime, now:', video.currentTime)

        // Fallback timeout in case seeked never fires
        setTimeout(() => {
          video.removeEventListener('seeked', onSeeked)
          isSeekingRef.current = false
        }, 200)
      } else {
        log('seek() - video not ready, skipping video seek')
        // Video not ready yet, just clear the flag
        isSeekingRef.current = false
      }
    } else {
      log('seek() - no video element')
      isSeekingRef.current = false
    }
  }, [duration, setCurrentTime])

  /**
   * Execute play on video element (helper function)
   * Called after ensuring video is at correct position
   */
  const executePlay = useCallback((video: HTMLVideoElement) => {
    log('executePlay() called', {
      videoCurrentTime: video.currentTime,
      readyState: video.readyState,
      paused: video.paused,
      networkState: video.networkState
    })

    const playPromise = video.play()
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          log('executePlay() SUCCESS - video.play() resolved', {
            videoCurrentTime: video.currentTime
          })
          setIsPlaying(true)
          startPlaybackLoop()
        })
        .catch((error) => {
          if (error.name !== 'AbortError') {
            console.error('Play failed:', error)
            setIsPlaying(false)
          } else {
            log('executePlay() AbortError (ignored)')
          }
        })
    }
  }, [setIsPlaying, startPlaybackLoop])

  /**
   * Start playback
   * Waits for seeked event before playing to ensure correct position
   */
  const play = useCallback(() => {
    const video = videoRef.current
    log('play() called', {
      hasVideo: !!video,
      videoRef: videoRef.current
    })

    if (!video) {
      log('play() ABORTED - no video element')
      return
    }

    const storeTime = useUIStore.getState().currentTime
    log('play() state check', {
      storeTime,
      videoCurrentTime: video.currentTime,
      diff: Math.abs(video.currentTime - storeTime),
      readyState: video.readyState,
      paused: video.paused
    })

    // If video is already at correct position (within 50ms), play immediately
    if (Math.abs(video.currentTime - storeTime) < 0.05) {
      log('play() - video already at correct position, playing immediately')
      executePlay(video)
      return
    }

    // Otherwise, seek first and wait for seeked event before playing
    log('play() - need to seek first, setting up seeked listener')
    isAwaitingSeekRef.current = true

    const onSeeked = () => {
      log('play() - seeked event received!', {
        videoCurrentTime: video.currentTime,
        expectedTime: storeTime
      })
      video.removeEventListener('seeked', onSeeked)
      isAwaitingSeekRef.current = false
      executePlay(video)
    }

    video.addEventListener('seeked', onSeeked)
    log('play() - setting video.currentTime to', storeTime)
    video.currentTime = storeTime
    log('play() - video.currentTime after assignment:', video.currentTime)

    // Timeout fallback if seeked event never fires (e.g., network issues)
    setTimeout(() => {
      if (isAwaitingSeekRef.current) {
        log('play() - TIMEOUT: seeked event never fired, forcing play', {
          videoCurrentTime: video.currentTime
        })
        video.removeEventListener('seeked', onSeeked)
        isAwaitingSeekRef.current = false
        executePlay(video)
      }
    }, 500)
  }, [executePlay])

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
    const wasPlaying = useUIStore.getState().isPlaying
    log('toggle() called', { wasPlaying })
    if (wasPlaying) {
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
   * Ensures proper time sync when video is ready
   */
  const registerVideo = useCallback((video: HTMLVideoElement | null) => {
    log('registerVideo() called', {
      hasVideo: !!video,
      previousVideo: !!videoRef.current
    })
    videoRef.current = video

    if (video) {
      log('registerVideo() video details', {
        src: video.src,
        readyState: video.readyState,
        currentTime: video.currentTime,
        duration: video.duration
      })

      const syncTime = () => {
        const storeTime = useUIStore.getState().currentTime
        log('registerVideo() syncTime called', {
          storeTime,
          videoCurrentTime: video.currentTime,
          diff: Math.abs(video.currentTime - storeTime)
        })
        if (storeTime > 0 && Math.abs(video.currentTime - storeTime) > 0.1) {
          log('registerVideo() syncing video to store time')
          video.currentTime = storeTime
        }
      }

      // Sync immediately if metadata is already loaded, otherwise wait
      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        log('registerVideo() - metadata already loaded, syncing now')
        syncTime()
      } else {
        log('registerVideo() - waiting for loadedmetadata event')
        video.addEventListener('loadedmetadata', syncTime, { once: true })
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
    log('handleLoadedMetadata() called', {
      hasVideo: !!video,
      videoCurrentTime: video?.currentTime,
      videoDuration: video?.duration,
      readyState: video?.readyState
    })

    if (!video) return

    // Sync video to current store time when metadata is ready
    const storeTime = useUIStore.getState().currentTime
    log('handleLoadedMetadata() store state', { storeTime })

    if (storeTime > 0) {
      log('handleLoadedMetadata() syncing video to', storeTime)
      video.currentTime = storeTime
      log('handleLoadedMetadata() video.currentTime after sync:', video.currentTime)
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

  // Memoize context value to prevent unnecessary re-renders of consumers
  // The functions are stable (useCallback), so we only need to update when
  // isPlaying, currentTime, or duration actually change
  const value: PlaybackControllerState = useMemo(
    () => ({
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
    }),
    [
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
      handleEnded,
      handleError,
      handleLoadedMetadata,
    ]
  )

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
