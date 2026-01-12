import { create } from 'zustand'
import type { TranscriptionProgress } from '../../shared/types'

interface UIState {
  // Video player
  isPlaying: boolean
  currentTime: number
  volume: number

  // Transcription
  isTranscribing: boolean
  transcriptionProgress: TranscriptionProgress | null

  // Export
  isExporting: boolean
  exportProgress: number

  // Selection
  selectedSubtitleId: string | null

  // Timeline
  timelineZoom: number
  timelineScroll: number

  // Actions
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentTime: (time: number) => void
  setVolume: (volume: number) => void

  setIsTranscribing: (isTranscribing: boolean) => void
  setTranscriptionProgress: (progress: TranscriptionProgress | null) => void

  setIsExporting: (isExporting: boolean) => void
  setExportProgress: (progress: number) => void

  setSelectedSubtitleId: (id: string | null) => void

  setTimelineZoom: (zoom: number) => void
  setTimelineScroll: (scroll: number) => void
}

export const useUIStore = create<UIState>((set) => ({
  // Video player
  isPlaying: false,
  currentTime: 0,
  volume: 1,

  // Transcription
  isTranscribing: false,
  transcriptionProgress: null,

  // Export
  isExporting: false,
  exportProgress: 0,

  // Selection
  selectedSubtitleId: null,

  // Timeline
  timelineZoom: 1,
  timelineScroll: 0,

  // Actions
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVolume: (volume) => set({ volume }),

  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setTranscriptionProgress: (transcriptionProgress) => set({ transcriptionProgress }),

  setIsExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),

  setSelectedSubtitleId: (selectedSubtitleId) => set({ selectedSubtitleId }),

  setTimelineZoom: (timelineZoom) => set({ timelineZoom }),
  setTimelineScroll: (timelineScroll) => set({ timelineScroll })
}))
