import { create } from 'zustand'
import { v4 as uuidv4 } from 'uuid'
import type {
  Project,
  Subtitle,
  Speaker,
  SubtitleStyle,
  Word,
  TranscriptionResult
} from '../../shared/types'
import { DEFAULT_SUBTITLE_STYLE, SPEAKER_COLORS } from '../../shared/types'

interface ProjectState {
  project: Project | null

  // Actions
  createProject: (videoPath: string, name: string) => void
  setVideoMetadata: (duration: number, width: number, height: number) => void
  setAudioPath: (audioPath: string) => void

  // Transcription
  setTranscriptionResult: (result: TranscriptionResult) => void

  // Subtitles
  updateSubtitleText: (id: string, text: string) => void
  updateSubtitleTiming: (id: string, startTime: number, endTime: number) => void
  updateWordText: (subtitleId: string, wordIndex: number, text: string) => void
  deleteSubtitle: (id: string) => void
  addSubtitle: (subtitle: Omit<Subtitle, 'id'>) => void

  // Speakers
  updateSpeakerName: (id: string, name: string) => void
  updateSpeakerColor: (id: string, color: string) => void

  // Style
  updateStyle: (style: Partial<SubtitleStyle>) => void

  // Helpers
  hasProject: () => boolean
  clearProject: () => void
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,

  createProject: (videoPath: string, name: string) => {
    const project: Project = {
      id: uuidv4(),
      name,
      videoPath,
      audioPath: '',
      duration: 0,
      resolution: { width: 1080, height: 1920 }, // Default portrait
      subtitles: [],
      speakers: [],
      style: { ...DEFAULT_SUBTITLE_STYLE },
      createdAt: Date.now(),
      updatedAt: Date.now()
    }
    set({ project })
  },

  setVideoMetadata: (duration: number, width: number, height: number) => {
    set((state) => ({
      project: state.project
        ? {
            ...state.project,
            duration,
            resolution: { width, height },
            updatedAt: Date.now()
          }
        : null
    }))
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

    // Create speakers from result
    const speakers: Speaker[] = result.speakers.map((speakerId, index) => ({
      id: speakerId,
      name: `Sprecher ${index + 1}`,
      color: SPEAKER_COLORS[index % SPEAKER_COLORS.length]
    }))

    // Convert transcription segments to subtitles
    const subtitles: Subtitle[] = result.segments.map((segment) => ({
      id: uuidv4(),
      startTime: segment.start,
      endTime: segment.end,
      text: segment.text.trim(),
      speakerId: segment.speaker,
      words: segment.words.map((w) => ({
        text: w.word,
        startTime: w.start,
        endTime: w.end,
        confidence: w.score
      }))
    }))

    set({
      project: {
        ...project,
        subtitles,
        speakers,
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

        // Re-create words from new text (simple split)
        const words: Word[] = text.split(/\s+/).map((word, index) => {
          const oldWord = sub.words[index]
          return {
            text: word,
            startTime: oldWord?.startTime ?? sub.startTime,
            endTime: oldWord?.endTime ?? sub.endTime,
            confidence: oldWord?.confidence ?? 1
          }
        })

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

  updateSpeakerName: (id: string, name: string) => {
    set((state) => {
      if (!state.project) return state

      const speakers = state.project.speakers.map((speaker) =>
        speaker.id === id ? { ...speaker, name } : speaker
      )

      return {
        project: {
          ...state.project,
          speakers,
          updatedAt: Date.now()
        }
      }
    })
  },

  updateSpeakerColor: (id: string, color: string) => {
    set((state) => {
      if (!state.project) return state

      const speakers = state.project.speakers.map((speaker) =>
        speaker.id === id ? { ...speaker, color } : speaker
      )

      return {
        project: {
          ...state.project,
          speakers,
          updatedAt: Date.now()
        }
      }
    })
  },

  updateStyle: (style: Partial<SubtitleStyle>) => {
    set((state) => {
      if (!state.project) return state

      return {
        project: {
          ...state.project,
          style: { ...state.project.style, ...style },
          updatedAt: Date.now()
        }
      }
    })
  },

  hasProject: () => {
    return get().project !== null
  },

  clearProject: () => {
    set({ project: null })
  }
}))
