import { create } from 'zustand'
import type { TranscriptionProgress, AnalysisProgress, SubtitleChange } from '../../shared/types'

// Save status type
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

interface UIState {
  // Video player
  isPlaying: boolean
  currentTime: number
  volume: number
  isScrubbing: boolean  // True when user is scrubbing the timeline

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

  // Save status
  saveStatus: SaveStatus
  lastSavedAt: number | null
  hasUnsavedChanges: boolean

  // AI Analysis
  isAnalyzing: boolean
  analysisProgress: AnalysisProgress | null
  pendingChanges: SubtitleChange[]
  showDiffPreview: boolean

  // Actions
  setIsPlaying: (isPlaying: boolean) => void
  setCurrentTime: (time: number) => void
  setVolume: (volume: number) => void
  setIsScrubbing: (isScrubbing: boolean) => void

  setIsTranscribing: (isTranscribing: boolean) => void
  setTranscriptionProgress: (progress: TranscriptionProgress | null) => void

  setIsExporting: (isExporting: boolean) => void
  setExportProgress: (progress: number) => void

  setSelectedSubtitleId: (id: string | null) => void

  setTimelineZoom: (zoom: number) => void
  setTimelineScroll: (scroll: number) => void

  setSaveStatus: (status: SaveStatus) => void
  setLastSavedAt: (time: number | null) => void
  setHasUnsavedChanges: (hasUnsavedChanges: boolean) => void

  // Analysis actions
  setIsAnalyzing: (isAnalyzing: boolean) => void
  setAnalysisProgress: (progress: AnalysisProgress | null) => void
  setPendingChanges: (changes: SubtitleChange[]) => void
  setShowDiffPreview: (show: boolean) => void
  updateChangeStatus: (subtitleId: string, status: 'accepted' | 'rejected') => void
  acceptAllChanges: () => void
  rejectAllChanges: () => void
}

export const useUIStore = create<UIState>((set) => ({
  // Video player
  isPlaying: false,
  currentTime: 0,
  volume: 1,
  isScrubbing: false,

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

  // Save status
  saveStatus: 'idle',
  lastSavedAt: null,
  hasUnsavedChanges: false,

  // AI Analysis
  isAnalyzing: false,
  analysisProgress: null,
  pendingChanges: [],
  showDiffPreview: false,

  // Actions
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  setCurrentTime: (currentTime) => set({ currentTime }),
  setVolume: (volume) => set({ volume }),
  setIsScrubbing: (isScrubbing) => set({ isScrubbing }),

  setIsTranscribing: (isTranscribing) => set({ isTranscribing }),
  setTranscriptionProgress: (transcriptionProgress) => set({ transcriptionProgress }),

  setIsExporting: (isExporting) => set({ isExporting }),
  setExportProgress: (exportProgress) => set({ exportProgress }),

  setSelectedSubtitleId: (selectedSubtitleId) => set({ selectedSubtitleId }),

  setTimelineZoom: (timelineZoom) => set({ timelineZoom }),
  setTimelineScroll: (timelineScroll) => set({ timelineScroll }),

  setSaveStatus: (saveStatus) => set({ saveStatus }),
  setLastSavedAt: (lastSavedAt) => set({ lastSavedAt }),
  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),

  // Analysis actions
  setIsAnalyzing: (isAnalyzing) => set({ isAnalyzing }),
  setAnalysisProgress: (analysisProgress) => set({ analysisProgress }),
  setPendingChanges: (pendingChanges) => set({ pendingChanges }),
  setShowDiffPreview: (showDiffPreview) => set({ showDiffPreview }),
  updateChangeStatus: (subtitleId, status) =>
    set((state) => ({
      pendingChanges: state.pendingChanges.map((change) =>
        change.subtitleId === subtitleId ? { ...change, status } : change
      )
    })),
  acceptAllChanges: () =>
    set((state) => ({
      pendingChanges: state.pendingChanges.map((change) => ({ ...change, status: 'accepted' as const }))
    })),
  rejectAllChanges: () =>
    set((state) => ({
      pendingChanges: state.pendingChanges.map((change) => ({ ...change, status: 'rejected' as const }))
    }))
}))
