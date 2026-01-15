import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ClipboardList, CheckCircle, Loader2 } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useProjectStore } from '../../store/projectStore'
import DiffItem from './DiffItem'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { Word, AlignmentSegment, SubtitleChange, TranscriptionWord } from '../../../shared/types'

/**
 * Count words in text (simple split by whitespace)
 */
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(w => w.length > 0).length
}

/**
 * Check if WhisperX alignment result is valid for a segment.
 * Returns false if the word count doesn't match or timing looks broken.
 */
function isAlignmentValid(
  words: TranscriptionWord[] | undefined,
  expectedText: string,
  segmentStart: number,
  segmentEnd: number
): boolean {
  if (!words || words.length === 0) return false

  const expectedWordCount = countWords(expectedText)

  // Allow small difference (WhisperX might split/merge some words)
  const wordCountDiff = Math.abs(words.length - expectedWordCount)
  if (wordCountDiff > Math.max(2, expectedWordCount * 0.3)) {
    console.log(`Word count mismatch: expected ${expectedWordCount}, got ${words.length}`)
    return false
  }

  // Check if all words are within segment bounds (with small tolerance)
  const tolerance = 0.5 // 500ms tolerance
  const allInBounds = words.every(w =>
    w.start >= segmentStart - tolerance &&
    w.end <= segmentEnd + tolerance
  )

  if (!allInBounds) {
    console.log('Some words are out of segment bounds')
    return false
  }

  return true
}

interface DiffPreviewProps {
  onClose: () => void
  onApply: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

interface AlignmentStatus {
  stage: 'idle' | 'extracting' | 'whisperx' | 'validating' | 'gemini' | 'applying' | 'complete'
  message: string
  current?: number
  total?: number
}

export default function DiffPreview({ onClose, onApply }: DiffPreviewProps) {
  const { t } = useTranslation()
  const { pendingChanges, updateChangeStatus, acceptAllChanges, rejectAllChanges } = useUIStore()
  const { project, updateSubtitleWithWords } = useProjectStore()
  const [isAligning, setIsAligning] = useState(false)
  const [alignError, setAlignError] = useState<string | null>(null)
  const [alignStatus, setAlignStatus] = useState<AlignmentStatus>({ stage: 'idle', message: '' })

  const summary = useMemo(() => {
    const accepted = pendingChanges.filter(c => c.status === 'accepted').length
    const rejected = pendingChanges.filter(c => c.status === 'rejected').length
    const pending = pendingChanges.filter(c => c.status === 'pending').length

    return {
      total: pendingChanges.length,
      accepted,
      rejected,
      pending,
      spelling: pendingChanges.filter(c => c.changeType === 'spelling').length,
      grammar: pendingChanges.filter(c => c.changeType === 'grammar').length,
      context: pendingChanges.filter(c => c.changeType === 'context').length,
      name: pendingChanges.filter(c => c.changeType === 'name').length,
      punctuation: pendingChanges.filter(c => c.changeType === 'punctuation').length,
    }
  }, [pendingChanges])

  const handleApply = async () => {
    if (!project) return

    const acceptedChanges = pendingChanges.filter(c => c.status === 'accepted') as SubtitleChange[]
    if (acceptedChanges.length === 0) return

    setIsAligning(true)
    setAlignError(null)
    setAlignStatus({ stage: 'whisperx', message: t('diffPreview.alignment.startingWhisperX'), current: 0, total: acceptedChanges.length })

    let tempAudioPath: string | null = null

    try {
      // Build alignment segments from accepted changes
      const segments: AlignmentSegment[] = acceptedChanges.map(change => {
        const subtitle = project.subtitles.find(s => s.id === change.subtitleId)
        return {
          text: change.correctedText,
          start: subtitle?.startTime ?? 0,
          end: subtitle?.endTime ?? 0
        }
      })

      // Determine audio path - use existing or extract new
      let audioPath = project.audioPath

      // Try alignment with existing audio first, if it fails extract new audio
      let result
      try {
        setAlignStatus({ stage: 'whisperx', message: t('diffPreview.alignment.whisperXSegments', { count: segments.length }), current: 0, total: acceptedChanges.length })
        result = await window.api.whisper.align(audioPath, segments)
      } catch (whisperError) {
        // Audio file might not exist, extract from video
        console.log('Audio file not found, extracting from video...')
        setAlignStatus({ stage: 'extracting', message: t('diffPreview.alignment.extractingAudio'), current: 0, total: acceptedChanges.length })
        const tempDir = await window.api.file.getTempDir()
        tempAudioPath = `${tempDir}/opensub_align_${Date.now()}.wav`
        await window.api.ffmpeg.extractAudio(project.videoPath, tempAudioPath)
        audioPath = tempAudioPath

        // Retry alignment with freshly extracted audio
        setAlignStatus({ stage: 'whisperx', message: t('diffPreview.alignment.whisperXSegments', { count: segments.length }), current: 0, total: acceptedChanges.length })
        result = await window.api.whisper.align(audioPath, segments)
      }

      // Track which segments need Gemini fallback
      const segmentsNeedingGemini: number[] = []

      // Check each alignment result for validity
      setAlignStatus({ stage: 'validating', message: t('diffPreview.alignment.validating'), current: 0, total: acceptedChanges.length })
      for (let i = 0; i < acceptedChanges.length; i++) {
        const change = acceptedChanges[i]
        const subtitle = project.subtitles.find(s => s.id === change.subtitleId)
        const alignedSegment = result.segments[i]

        const isValid = isAlignmentValid(
          alignedSegment?.words,
          change.correctedText,
          subtitle?.startTime ?? 0,
          subtitle?.endTime ?? 0
        )

        if (!isValid) {
          console.log(`Segment ${i} alignment invalid, will use Gemini fallback`)
          segmentsNeedingGemini.push(i)
        }
      }

      // Use Gemini for segments where WhisperX failed
      if (segmentsNeedingGemini.length > 0) {
        console.log(`Using Gemini fallback for ${segmentsNeedingGemini.length} segments`)

        let geminiProcessed = 0
        for (const segmentIndex of segmentsNeedingGemini) {
          const change = acceptedChanges[segmentIndex]
          const subtitle = project.subtitles.find(s => s.id === change.subtitleId)

          if (!subtitle) continue

          geminiProcessed++
          setAlignStatus({
            stage: 'gemini',
            message: t('diffPreview.alignment.geminiSegment', { current: geminiProcessed, total: segmentsNeedingGemini.length }),
            current: geminiProcessed,
            total: segmentsNeedingGemini.length
          })

          try {
            console.log(`Calling Gemini for segment ${segmentIndex}: "${change.correctedText}"`)
            const geminiResult = await window.api.analysis.getWordTimings({
              audioPath: audioPath, // Use the WAV file
              text: change.correctedText,
              segmentStart: subtitle.startTime,
              segmentEnd: subtitle.endTime
            })

            // Store Gemini result in our result object
            if (geminiResult.words && geminiResult.words.length > 0) {
              result.segments[segmentIndex] = {
                start: subtitle.startTime,
                end: subtitle.endTime,
                text: change.correctedText,
                words: geminiResult.words.map(w => ({
                  word: w.word,
                  start: w.start,
                  end: w.end,
                  score: 0.9 // Gemini doesn't provide confidence, use default
                }))
              }
              console.log(`Gemini returned ${geminiResult.words.length} words for segment ${segmentIndex}`)
            }
          } catch (geminiError) {
            console.error(`Gemini fallback failed for segment ${segmentIndex}:`, geminiError)
            // Continue with WhisperX result (even if imperfect)
          }
        }
      }

      // Apply aligned words to each subtitle
      setAlignStatus({ stage: 'applying', message: t('diffPreview.alignment.applyingChanges'), current: 0, total: acceptedChanges.length })
      for (let i = 0; i < acceptedChanges.length; i++) {
        const change = acceptedChanges[i]
        const alignedSegment = result.segments[i]
        const subtitle = project.subtitles.find(s => s.id === change.subtitleId)

        setAlignStatus({ stage: 'applying', message: t('diffPreview.alignment.applyingChange', { current: i + 1, total: acceptedChanges.length }), current: i + 1, total: acceptedChanges.length })

        if (alignedSegment && alignedSegment.words && alignedSegment.words.length > 0) {
          // Find the next subtitle to prevent overlap
          const subtitleIndex = project.subtitles.findIndex(s => s.id === change.subtitleId)
          const nextSubtitle = subtitleIndex < project.subtitles.length - 1
            ? project.subtitles[subtitleIndex + 1]
            : null

          // Calculate max allowed end time
          const GAP_BETWEEN_SUBTITLES = 0.1
          const MAX_BLOCK_DURATION = 4.0
          const maxEndTime = nextSubtitle
            ? Math.min(nextSubtitle.startTime - GAP_BETWEEN_SUBTITLES, subtitle!.startTime + MAX_BLOCK_DURATION)
            : subtitle!.startTime + MAX_BLOCK_DURATION

          // Check if words extend beyond allowed bounds
          const lastWord = alignedSegment.words[alignedSegment.words.length - 1]
          const needsRescaling = lastWord.end > maxEndTime

          // Convert TranscriptionWord to Word format, rescaling if needed
          let words: Word[]

          if (needsRescaling) {
            // Rescale all word timings to fit within allowed bounds
            const originalDuration = lastWord.end - alignedSegment.words[0].start
            const allowedDuration = maxEndTime - subtitle!.startTime
            const scale = allowedDuration / originalDuration

            console.log(`Rescaling words: ${originalDuration.toFixed(2)}s -> ${allowedDuration.toFixed(2)}s (scale: ${scale.toFixed(2)})`)

            words = alignedSegment.words.map(w => ({
              text: w.word,
              startTime: subtitle!.startTime + (w.start - alignedSegment.words[0].start) * scale,
              endTime: subtitle!.startTime + (w.end - alignedSegment.words[0].start) * scale,
              confidence: w.score
            }))
          } else {
            words = alignedSegment.words.map(w => ({
              text: w.word,
              startTime: w.start,
              endTime: w.end,
              confidence: w.score
            }))
          }

          updateSubtitleWithWords(change.subtitleId, change.correctedText, words)
        } else if (subtitle) {
          // Fallback: If alignment failed completely, create estimated word timings
          console.log(`Using estimated timing for segment ${i} (alignment failed)`)
          const textWords = change.correctedText.trim().split(/\s+/).filter(w => w.length > 0)

          // Find the next subtitle to prevent overlap
          const subtitleIndex = project.subtitles.findIndex(s => s.id === change.subtitleId)
          const nextSubtitle = subtitleIndex < project.subtitles.length - 1
            ? project.subtitles[subtitleIndex + 1]
            : null

          // Calculate available time (original duration or until next subtitle, with small gap)
          const GAP_BETWEEN_SUBTITLES = 0.1 // 100ms gap
          const maxEndTime = nextSubtitle
            ? nextSubtitle.startTime - GAP_BETWEEN_SUBTITLES
            : subtitle.endTime + 10 // Allow up to 10s extension if no next subtitle

          // Limit maximum block duration to 4 seconds (reasonable for readability)
          const MAX_BLOCK_DURATION = 4.0
          const availableDuration = Math.min(
            maxEndTime - subtitle.startTime,
            MAX_BLOCK_DURATION
          )

          // Calculate word duration based on available time
          const wordDuration = availableDuration / textWords.length
          const startTime = subtitle.startTime

          const estimatedWords: Word[] = textWords.map((text, idx) => ({
            text,
            startTime: startTime + idx * wordDuration,
            endTime: startTime + (idx + 1) * wordDuration,
            confidence: 0.5 // Low confidence for estimated timing
          }))

          console.log(`Estimated timing: ${textWords.length} words in ${availableDuration.toFixed(2)}s (original: ${(subtitle.endTime - subtitle.startTime).toFixed(2)}s, max: ${maxEndTime.toFixed(2)}s)`)
          updateSubtitleWithWords(change.subtitleId, change.correctedText, estimatedWords)
        }
      }

      setAlignStatus({ stage: 'complete', message: t('diffPreview.alignment.complete'), current: acceptedChanges.length, total: acceptedChanges.length })
      onApply()
    } catch (error) {
      console.error('Alignment failed:', error)
      setAlignError(error instanceof Error ? error.message : t('diffPreview.alignment.alignmentFailed'))
    } finally {
      // Clean up temporary audio file
      if (tempAudioPath) {
        window.api.file.deleteTempFile(tempAudioPath).catch(() => {})
      }
      setIsAligning(false)
      setAlignStatus({ stage: 'idle', message: '' })
    }
  }

  const getSubtitleTime = (subtitleId: string): number => {
    const subtitle = project?.subtitles.find(s => s.id === subtitleId)
    return subtitle?.startTime ?? 0
  }

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-400 flex items-center justify-center">
              <ClipboardList className="w-5 h-5 text-white" />
            </div>
            <div>
              <DialogTitle className="text-lg">{t('diffPreview.title')}</DialogTitle>
              <DialogDescription>{t('diffPreview.changesFound', { count: summary.total })}</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Summary badges */}
        <div className="px-6 py-3 border-b border-border flex flex-wrap gap-2">
          {summary.spelling > 0 && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              {summary.spelling} {t('diffPreview.spelling')}
            </Badge>
          )}
          {summary.grammar > 0 && (
            <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              {summary.grammar} {t('diffPreview.grammar')}
            </Badge>
          )}
          {summary.context > 0 && (
            <Badge variant="outline" className="bg-violet-500/20 text-violet-300 border-violet-500/30">
              {summary.context} {t('diffPreview.context')}
            </Badge>
          )}
          {summary.name > 0 && (
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              {summary.name} {t('diffPreview.name')}
            </Badge>
          )}
          {summary.punctuation > 0 && (
            <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30">
              {summary.punctuation} {t('diffPreview.punctuation')}
            </Badge>
          )}
        </div>

        {/* Bulk actions */}
        <div className="px-6 py-3 border-b border-border flex gap-2 items-center">
          <Button
            onClick={acceptAllChanges}
            variant="outline"
            size="sm"
            className="bg-emerald-600/20 text-emerald-300 border-emerald-500/30 hover:bg-emerald-600/30"
          >
            {t('diffPreview.acceptAll')}
          </Button>
          <Button
            onClick={rejectAllChanges}
            variant="outline"
            size="sm"
            className="bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/30"
          >
            {t('diffPreview.rejectAll')}
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {summary.accepted} {t('diffPreview.accepted')}, {summary.rejected} {t('diffPreview.rejected')}
          </span>
        </div>

        {/* Changes list */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="px-6 py-4 space-y-3">
            {pendingChanges.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">{t('diffPreview.noChanges')}</p>
                <p className="text-xs mt-1">{t('diffPreview.noChangesHint')}</p>
              </div>
            ) : (
              pendingChanges.map((change) => (
                <DiffItem
                  key={change.subtitleId}
                  change={change}
                  time={formatTime(getSubtitleTime(change.subtitleId))}
                  onAccept={() => updateChangeStatus(change.subtitleId, 'accepted')}
                  onReject={() => updateChangeStatus(change.subtitleId, 'rejected')}
                />
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border flex-col gap-2">
          {/* Status indicator during alignment */}
          {isAligning && (
            <div className="w-full bg-muted/50 border border-border rounded-lg p-3">
              <div className="flex items-center gap-3 mb-2">
                {/* Tool indicator */}
                <div className={cn(
                  'w-2 h-2 rounded-full animate-pulse',
                  alignStatus.stage === 'extracting' && 'bg-yellow-500',
                  alignStatus.stage === 'whisperx' && 'bg-blue-500',
                  alignStatus.stage === 'validating' && 'bg-purple-500',
                  alignStatus.stage === 'gemini' && 'bg-emerald-500',
                  alignStatus.stage === 'applying' && 'bg-cyan-500'
                )} />
                <span className="text-sm font-medium">
                  {alignStatus.stage === 'extracting' && `📁 ${t('diffPreview.alignment.ffmpeg')}`}
                  {alignStatus.stage === 'whisperx' && `🎤 ${t('diffPreview.alignment.whisperx')}`}
                  {alignStatus.stage === 'validating' && `🔍 ${t('diffPreview.alignment.validation')}`}
                  {alignStatus.stage === 'gemini' && `✨ ${t('diffPreview.alignment.gemini')}`}
                  {alignStatus.stage === 'applying' && `💾 ${t('diffPreview.alignment.saving')}`}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">{alignStatus.message}</p>
              {alignStatus.total && alignStatus.total > 1 && (
                <div className="mt-2">
                  <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all duration-300',
                        alignStatus.stage === 'extracting' && 'bg-yellow-500',
                        alignStatus.stage === 'whisperx' && 'bg-blue-500',
                        alignStatus.stage === 'validating' && 'bg-purple-500',
                        alignStatus.stage === 'gemini' && 'bg-emerald-500',
                        alignStatus.stage === 'applying' && 'bg-cyan-500'
                      )}
                      style={{ width: `${((alignStatus.current ?? 0) / alignStatus.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
          {alignError && (
            <div className="w-full text-sm text-red-400 bg-red-500/10 border border-red-500/30 rounded-md px-3 py-2">
              {alignError}
            </div>
          )}
          <div className="flex gap-2 w-full justify-end">
            <Button
              onClick={onClose}
              variant="outline"
              disabled={isAligning}
            >
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleApply}
              disabled={summary.accepted === 0 || isAligning}
              className={cn(
                summary.accepted > 0 && !isAligning
                  ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                  : 'bg-muted text-muted-foreground cursor-not-allowed',
                isAligning && 'min-w-[280px]'
              )}
            >
              {isAligning ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin flex-shrink-0" />
                  <span className="text-left truncate">{alignStatus.message}</span>
                </div>
              ) : summary.accepted > 0 ? (
                t('diffPreview.applyChanges', { count: summary.accepted })
              ) : (
                t('diffPreview.noChangesSelected')
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
