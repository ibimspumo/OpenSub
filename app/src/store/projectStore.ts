import { create } from 'zustand'
import { temporal } from 'zundo'
import { useStoreWithEqualityFn } from 'zustand/traditional'
import { v4 as uuidv4 } from 'uuid'
import type {
  Project,
  Subtitle,
  Word,
  Speaker,
  SubtitleStyle,
  TranscriptionResult,
  StoredProject
} from '@/lib/types'
import {
  DEFAULT_SUBTITLE_STYLE,
  SPEAKER_COLORS,
  getDefaultFontSizeForResolution
} from '@/lib/types'
import { splitAllSubtitles, mergeAutoSplitSubtitles } from '@/utils/subtitleSplitter'
import { updateTextWithTimingPreservation } from '@/utils/wordTimingUtils'
import { files } from '@/lib/api'

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

  // Speakers (diarization)
  setSpeakers: (speakers: Speaker[]) => void
  renameSpeaker: (id: string, name: string) => void
  setSpeakerColor: (id: string, color: string) => void
  assignSpeaker: (subtitleId: string, speakerId: string | undefined) => void

  // Style
  updateStyle: (style: Partial<SubtitleStyle>) => void

  // Auto-split
  autoSplitSubtitles: () => void
  remergeSubtitles: () => void

  // Helpers
  hasProject: () => boolean
  clearProject: () => void
}

function touch(project: Project): Project {
  return { ...project, updatedAt: Date.now() }
}

export const useProjectStoreBase = create<ProjectState>()(
  temporal(
    (set, get) => ({
      project: null,

      createProject: (videoPath: string, name: string) => {
        // Clean up old temp audio when replacing a project
        const oldProject = get().project
        if (oldProject?.audioPath) {
          files.deleteTempFile(oldProject.audioPath).catch(() => {})
        }

        const project: Project = {
          id: uuidv4(),
          name,
          videoPath,
          audioPath: '',
          duration: 0,
          resolution: { width: 1080, height: 1920 },
          subtitles: [],
          speakers: [],
          style: { ...DEFAULT_SUBTITLE_STYLE },
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
        set({ project })
        useProjectStoreBase.temporal.getState().clear()
      },

      loadProject: (storedProject: StoredProject) => {
        // Older stored projects may predate the speakers field
        const data = storedProject.data
        set({ project: { ...data, speakers: data.speakers ?? [] } })
        useProjectStoreBase.temporal.getState().clear()
      },

      renameProject: (name: string) => {
        set((state) => ({
          project: state.project ? touch({ ...state.project, name }) : null
        }))
      },

      setVideoMetadata: (duration: number, width: number, height: number) => {
        set((state) => {
          if (!state.project) return { project: null }
          const fontSize = getDefaultFontSizeForResolution(width, height)
          return {
            project: touch({
              ...state.project,
              duration,
              resolution: { width, height },
              style: { ...state.project.style, fontSize }
            })
          }
        })
      },

      setAudioPath: (audioPath: string) => {
        set((state) => ({
          project: state.project ? touch({ ...state.project, audioPath }) : null
        }))
      },

      setTranscriptionResult: (result: TranscriptionResult) => {
        const { project } = get()
        if (!project) return

        // Build speakers from diarization output (if present)
        const speakerIds = new Set<number>()
        for (const segment of result.segments) {
          if (segment.speaker !== undefined) speakerIds.add(segment.speaker)
        }
        const speakers: Speaker[] = [...speakerIds].sort().map((num, i) => ({
          id: `speaker-${num}`,
          name: `Speaker ${num + 1}`,
          color: SPEAKER_COLORS[i % SPEAKER_COLORS.length]
        }))

        const rawSubtitles: Subtitle[] = result.segments.map((segment) => ({
          id: uuidv4(),
          startTime: segment.start,
          endTime: segment.end,
          text: segment.text.trim(),
          speakerId: segment.speaker !== undefined ? `speaker-${segment.speaker}` : undefined,
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
          project: touch({
            ...project,
            subtitles,
            speakers,
            duration: result.duration || project.duration
          })
        })
        useProjectStoreBase.temporal.getState().clear()
      },

      updateSubtitleText: (id: string, text: string) => {
        set((state) => {
          if (!state.project) return state

          const subtitles = state.project.subtitles.map((sub) => {
            if (sub.id !== id) return sub
            // Smart timing redistribution preserves timing integrity when
            // word count changes (e.g., AI corrections)
            const words = updateTextWithTimingPreservation(
              text,
              sub.words,
              sub.startTime,
              sub.endTime
            )
            return { ...sub, text, words }
          })

          return { project: touch({ ...state.project, subtitles }) }
        })
      },

      updateSubtitleWithWords: (id: string, text: string, words: Word[]) => {
        set((state) => {
          if (!state.project) return state

          const subtitles = state.project.subtitles.map((sub) => {
            if (sub.id !== id) return sub
            let startTime = sub.startTime
            let endTime = sub.endTime
            if (words.length > 0) {
              startTime = words[0].startTime
              endTime = words[words.length - 1].endTime
            }
            return { ...sub, text, words, startTime, endTime }
          })

          return { project: touch({ ...state.project, subtitles }) }
        })
      },

      updateSubtitleTiming: (id: string, startTime: number, endTime: number) => {
        set((state) => {
          if (!state.project) return state
          const subtitles = state.project.subtitles.map((sub) =>
            sub.id === id ? { ...sub, startTime, endTime } : sub
          )
          return { project: touch({ ...state.project, subtitles }) }
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
            const fullText = words.map((w) => w.text).join(' ')
            return { ...sub, words, text: fullText }
          })

          return { project: touch({ ...state.project, subtitles }) }
        })
      },

      deleteSubtitle: (id: string) => {
        set((state) => {
          if (!state.project) return state
          return {
            project: touch({
              ...state.project,
              subtitles: state.project.subtitles.filter((sub) => sub.id !== id)
            })
          }
        })
      },

      addSubtitle: (subtitle: Omit<Subtitle, 'id'>) => {
        set((state) => {
          if (!state.project) return state
          const newSubtitle: Subtitle = { ...subtitle, id: uuidv4() }
          const subtitles = [...state.project.subtitles, newSubtitle].sort(
            (a, b) => a.startTime - b.startTime
          )
          return { project: touch({ ...state.project, subtitles }) }
        })
      },

      setSpeakers: (speakers: Speaker[]) => {
        set((state) => ({
          project: state.project ? touch({ ...state.project, speakers }) : null
        }))
      },

      renameSpeaker: (id: string, name: string) => {
        set((state) => {
          if (!state.project) return state
          const speakers = state.project.speakers.map((s) =>
            s.id === id ? { ...s, name } : s
          )
          return { project: touch({ ...state.project, speakers }) }
        })
      },

      setSpeakerColor: (id: string, color: string) => {
        set((state) => {
          if (!state.project) return state
          const speakers = state.project.speakers.map((s) =>
            s.id === id ? { ...s, color } : s
          )
          return { project: touch({ ...state.project, speakers }) }
        })
      },

      assignSpeaker: (subtitleId: string, speakerId: string | undefined) => {
        set((state) => {
          if (!state.project) return state
          const subtitles = state.project.subtitles.map((sub) =>
            sub.id === subtitleId ? { ...sub, speakerId } : sub
          )
          return { project: touch({ ...state.project, subtitles }) }
        })
      },

      updateStyle: (styleUpdates: Partial<SubtitleStyle>) => {
        set((state) => {
          if (!state.project) return state

          const newStyle = { ...state.project.style, ...styleUpdates }

          // Re-split subtitles when layout-relevant properties change
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
            const merged = mergeAutoSplitSubtitles(subtitles)
            subtitles = splitAllSubtitles(merged, newStyle, state.project.resolution.width)
          }

          return { project: touch({ ...state.project, style: newStyle, subtitles }) }
        })
      },

      autoSplitSubtitles: () => {
        const { project } = get()
        if (!project) return
        const merged = mergeAutoSplitSubtitles(project.subtitles)
        const split = splitAllSubtitles(merged, project.style, project.resolution.width)
        set({ project: touch({ ...project, subtitles: split }) })
      },

      remergeSubtitles: () => {
        const { project } = get()
        if (!project) return
        const merged = mergeAutoSplitSubtitles(project.subtitles)
        set({ project: touch({ ...project, subtitles: merged }) })
      },

      hasProject: () => {
        return get().project !== null
      },

      clearProject: () => {
        const currentProject = get().project
        if (currentProject?.audioPath) {
          files.deleteTempFile(currentProject.audioPath).catch(() => {})
        }
        set({ project: null })
        useProjectStoreBase.temporal.getState().clear()
      }
    }),
    {
      // Only the project data participates in undo/redo
      partialize: (state) => ({ project: state.project }),
      limit: 100,
      equality: (pastState, currentState) => pastState.project === currentState.project
    }
  )
)

export const useProjectStore = useProjectStoreBase

/** Hook into the undo/redo history of the project store */
export function useProjectHistory() {
  return useStoreWithEqualityFn(
    useProjectStoreBase.temporal,
    (state) => ({
      undo: state.undo,
      redo: state.redo,
      clear: state.clear,
      canUndo: state.pastStates.length > 0,
      canRedo: state.futureStates.length > 0
    }),
    (a, b) => a.canUndo === b.canUndo && a.canRedo === b.canRedo
  )
}
