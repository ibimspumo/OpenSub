import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Project,
  Subtitle,
  SubtitleStyle,
  TranscriptionResult,
  StoredProject
} from '../../shared/types'
import { DEFAULT_SUBTITLE_STYLE, getDefaultFontSizeForResolution } from '../../shared/types'
import { splitAllSubtitles, mergeAutoSplitSubtitles } from '../utils/subtitleSplitter'
import { updateTextWithTimingPreservation } from '../utils/wordTimingUtils'

interface ProjectState {
  project: Project | null

  // Actions
  createProject: (videoPath: string, name: string) => void
  loadProject: (storedProject: StoredProject) => void
  renameProject: (name: string) => void
  setVideoMetadata: (duration: number, width: number, height: number) => void
  setAudioPath: (audioPath: string) => void

  // Transcription
  setTranscriptionResult: (result: TranscriptionResult) => void

  // Subtitles
  updateSubtitleText: (id: string, text: string) => void
  updateSubtitleWithWords: (id: string, text: string, words: Word[]) => void
  updateSubtitleTiming: (id: string, startTime: number, endTime: number) => void
  updateWordText: (subtitleId: string, wordIndex: number, text: string) => void
  deleteSubtitle: (id: string) => void
  addSubtitle: (subtitle: Omit<Subtitle, 'id'>) => void

  // Style
  updateStyle: (style: Partial<SubtitleStyle>) => void

  // Auto-split
  autoSplitSubtitles: () => void
  remergeSubtitles: () => void

  // Helpers
  hasProject: () => boolean
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,

  createProject: (videoPath: string, name: string) => {
    // Clean up old audio file if exists
    const oldProject = get().project
    if (oldProject?.audioPath) {
      window.api.file.deleteTempFile(oldProject.audioPath)
        .then(result => {
          if (result.success) {
            console.log('Old audio file cleaned up:', oldProject.audioPath)
          }
        })
        .catch(err => console.warn('Failed to clean up old audio file:', err))
    }

    const project: Project = {
      id: uuidv4(),
      name,
      videoPath,
      audioPath: '',
      duration: 0,
      resolution: { width: 1080, height: 1920 }, // Default portrait
      subtitles: [],
      style: { ...DEFAULT_SUBTITLE_STYLE },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    set({ project })
  },

  loadProject: (storedProject: StoredProject) => {
    // Load project from stored data
    set({ project: storedProject.data })
  },

  renameProject: (name: string) => {
    set((state) => ({
      project: state.project
        ? {
            ...state.project,
            name,
            updatedAt: Date.now()
          }
        : null
    }))
  },

  setVideoMetadata: (duration: number, width: number, height: number) => {
    set((state) => {
      if (!state.project) return { project: null }

      // Calculate the default font size based on video resolution
      const fontSize = getDefaultFontSizeForResolution(width, height)

      return {
        project: {
          ...state.project,
          duration,
          resolution: { width, height },
          style: {
            ...state.project.style,
            fontSize
          },
          updatedAt: Date.now()
        }
      }
    })
  },

  setAudioPath: (audioPath: string) => {
    set((state) => ({
      project: state.project
        ? {
            ...state.project,
            audioPath,
            updatedAt: Date.now()
          }
        : null
    }))
  },

  setTranscriptionResult: (result: TranscriptionResult) => {
    const { project } = get()
    if (!project) return

    // Convert transcription segments to subtitles
    const rawSubtitles: Subtitle[] = result.segments.map((segment) => ({
      id: uuidv4(),
      startTime: segment.start,
      endTime: segment.end,
      text: segment.text.trim(),
      words: segment.words.map((w) => ({
        text: w.word,
        startTime: w.start,
        endTime: w.end,
        confidence: w.score
      }))
    }))

    // Apply auto-split on initial transcription
    const subtitles = splitAllSubtitles(rawSubtitles, project.style, project.resolution.width)

    set({
      project: {
        ...project,
        subtitles,
        duration: result.duration,
        updatedAt: Date.now()
      }
    })
  },

  updateSubtitleText: (id: string, text: string) => {
    set((state) => {
      if (!state.project) return state

      const subtitles = state.project.subtitles.map((sub) => {
        if (sub.id !== id) return sub

        // Use smart timing redistribution that preserves timing integrity
        // when word count changes (e.g., AI corrections)
        const words = updateTextWithTimingPreservation(
          text,
          sub.words,
          sub.startTime,
          sub.endTime
        )

        return { ...sub, text, words }
      })

      return {
        project: {
          ...state.project,
          subtitles,
          updatedAt: Date.now()
        }
      }
    })
  },

  updateSubtitleWithWords: (id: string, text: string, words: Word[]) => {
    set((state) => {
      if (!state.project) return state

      const subtitles = state.project.subtitles.map((sub) => {
        if (sub.id !== id) return sub

        // Update startTime and endTime based on word timings
        // This is important when AI corrections change the number of words
        let startTime = sub.startTime
        let endTime = sub.endTime

        if (words.length > 0) {
          // Use the first word's start time and last word's end time
          startTime = words[0].startTime
          endTime = words[words.length - 1].endTime
        }

        return { ...sub, text, words, startTime, endTime }
      })

      return {
        project: {
          ...state.project,
          subtitles,
          updatedAt: Date.now()
        }
      }
    })
  },

  updateSubtitleTiming: (id: string, startTime: number, endTime: number) => {
    set((state) => {
      if (!state.project) return state

      const subtitles = state.project.subtitles.map((sub) =>
        sub.id === id ? { ...sub, startTime, endTime } : sub
      )

      return {
        project: {
          ...state.project,
          subtitles,
          updatedAt: Date.now()
        }
      }
    })
  },

  updateWordText: (subtitleId: string, wordIndex: number, text: string) => {
    set((state) => {
      if (!state.project) return state

      const subtitles = state.project.subtitles.map((sub) => {
        if (sub.id !== subtitleId) return sub

        const words = [...sub.words]
        if (words[wordIndex]) {
          words[wordIndex] = { ...words[wordIndex], text }
        }

        // Update full text
        const fullText = words.map((w) => w.text).join(' ')

        return { ...sub, words, text: fullText }
      })

      return {
        project: {
          ...state.project,
          subtitles,
          updatedAt: Date.now()
        }
      }
    })
  },

  deleteSubtitle: (id: string) => {
    set((state) => {
      if (!state.project) return state

      return {
        project: {
          ...state.project,
          subtitles: state.project.subtitles.filter((sub) => sub.id !== id),
          updatedAt: Date.now()
        }
      }
    })
  },

  addSubtitle: (subtitle: Omit<Subtitle, 'id'>) => {
    set((state) => {
      if (!state.project) return state

      const newSubtitle: Subtitle = {
        ...subtitle,
        id: uuidv4()
      }

      // Insert in correct position (sorted by startTime)
      const subtitles = [...state.project.subtitles, newSubtitle].sort(
        (a, b) => a.startTime - b.startTime
      )

      return {
        project: {
          ...state.project,
          subtitles,
          updatedAt: Date.now()
        }
      }
    })
  },

  updateStyle: (styleUpdates: Partial<SubtitleStyle>) => {
    set((state) => {
      if (!state.project) return state

      const newStyle = { ...state.project.style, ...styleUpdates }

      // Check if split-relevant properties changed
      const splitRelevantKeys: (keyof SubtitleStyle)[] = [
        'fontSize',
        'maxWidth',
        'maxLines',
        'fontFamily',
        'fontWeight',
        'textTransform'
      ]
      const needsResplit = splitRelevantKeys.some((key) => key in styleUpdates)

      let subtitles = state.project.subtitles
      if (needsResplit) {
        // First merge any existing auto-splits, then re-split with new style
        const merged = mergeAutoSplitSubtitles(subtitles)
        subtitles = splitAllSubtitles(merged, newStyle, state.project.resolution.width)
      }

      return {
        project: {
          ...state.project,
          style: newStyle,
          subtitles,
          updatedAt: Date.now()
        }
      }
    })
  },

  autoSplitSubtitles: () => {
    const { project } = get()
    if (!project) return

    // First merge any existing auto-splits, then re-split
    const merged = mergeAutoSplitSubtitles(project.subtitles)
    const split = splitAllSubtitles(merged, project.style, project.resolution.width)

    set({
      project: {
        ...project,
        subtitles: split,
        updatedAt: Date.now()
      }
    })
  },

  remergeSubtitles: () => {
    const { project } = get()
    if (!project) return

    const merged = mergeAutoSplitSubtitles(project.subtitles)

    set({
      project: {
        ...project,
        subtitles: merged,
        updatedAt: Date.now()
      }
    })
  },

  hasProject: () => {
    return get().project !== null
  },

  clearProject: () => {
    const currentProject = get().project
    // Clean up audio file when project is cleared
    if (currentProject?.audioPath) {
      window.api.file.deleteTempFile(currentProject.audioPath)
        .then(result => {
          if (result.success) {
            console.log('Audio file cleaned up:', currentProject.audioPath)
          }
        })
        .catch(err => console.warn('Failed to clean up audio file:', err))
    }
    set({ project: null })
  }
}))
