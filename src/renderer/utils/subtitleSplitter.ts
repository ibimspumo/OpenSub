/**
 * Subtitle Splitter Utility
 *
 * Handles automatic splitting and merging of subtitles based on
 * text overflow constraints (maxWidth, maxLines, fontSize).
 */

import { v4 as uuidv4 } from 'uuid'
import type { Subtitle, Word, SubtitleStyle } from '../../shared/types'
import { getTextMeasurer } from './textMeasurement'

/**
 * Result of split calculation
 */
export interface SplitSegment {
  words: Word[]
  startTime: number
  endTime: number
}

export interface SplitResult {
  segments: SplitSegment[]
  wasSplit: boolean
}

/**
 * Calculate optimal split points for a subtitle based on style constraints.
 * Uses word-level timing to create properly-timed segments.
 */
export function calculateSplitPoints(
  subtitle: Subtitle,
  style: SubtitleStyle,
  videoWidth: number
): SplitResult {
  if (subtitle.words.length === 0) {
    return { segments: [], wasSplit: false }
  }

  const measurer = getTextMeasurer()
  measurer.setFont(style)

  const maxWidthPx = videoWidth * style.maxWidth
  const { maxLines } = style

  const segments: SplitSegment[] = []
  let currentWords: Word[] = []
  let currentLineCount = 1
  let currentLineText = ''

  for (const word of subtitle.words) {
    // Apply text transform for measurement
    const wordText = measurer.applyTextTransform(word.text, style)
    const testLine = currentLineText ? `${currentLineText} ${wordText}` : wordText
    const testWidth = measurer.measureText(testLine)

    if (testWidth > maxWidthPx && currentLineText) {
      // Word would overflow current line
      currentLineCount++

      if (currentLineCount > maxLines) {
        // Max lines reached - create new segment
        if (currentWords.length > 0) {
          segments.push({
            words: [...currentWords],
            startTime: currentWords[0].startTime,
            endTime: currentWords[currentWords.length - 1].endTime
          })
        }
        currentWords = [word]
        currentLineCount = 1
        currentLineText = wordText
      } else {
        // Start new line within same segment
        currentWords.push(word)
        currentLineText = wordText
      }
    } else {
      currentWords.push(word)
      currentLineText = testLine
    }
  }

  // Add remaining words as final segment
  if (currentWords.length > 0) {
    segments.push({
      words: currentWords,
      startTime: currentWords[0].startTime,
      endTime: currentWords[currentWords.length - 1].endTime
    })
  }

  return {
    segments,
    wasSplit: segments.length > 1
  }
}

/**
 * Split a single subtitle into multiple segments if needed.
 * Preserves word-level timing accuracy.
 */
export function splitSubtitle(
  subtitle: Subtitle,
  style: SubtitleStyle,
  videoWidth: number
): Subtitle[] {
  const result = calculateSplitPoints(subtitle, style, videoWidth)

  if (!result.wasSplit) {
    // No split needed - return original without split metadata
    return [
      {
        ...subtitle,
        splitGroupId: undefined,
        splitIndex: undefined,
        isAutoSplit: undefined
      }
    ]
  }

  // Generate a group ID for this split (reuse existing if present)
  const groupId = subtitle.splitGroupId || uuidv4()

  return result.segments.map((segment, index) => ({
    // Keep original ID for first segment, generate new for others
    id: index === 0 ? subtitle.id : uuidv4(),
    startTime: segment.startTime,
    endTime: segment.endTime,
    text: segment.words.map((w) => w.text).join(' '),
    words: segment.words,
    splitGroupId: groupId,
    splitIndex: index,
    isAutoSplit: true
  }))
}

/**
 * Process all subtitles and split as needed.
 * Returns a new array with split subtitles.
 */
export function splitAllSubtitles(
  subtitles: Subtitle[],
  style: SubtitleStyle,
  videoWidth: number
): Subtitle[] {
  return subtitles.flatMap((sub) => splitSubtitle(sub, style, videoWidth))
}

/**
 * Merge auto-split subtitles back into their original form.
 * Called when style changes make more space available.
 */
export function mergeAutoSplitSubtitles(subtitles: Subtitle[]): Subtitle[] {
  const groups = new Map<string, Subtitle[]>()
  const nonSplit: Subtitle[] = []

  // Group by splitGroupId
  for (const sub of subtitles) {
    if (sub.splitGroupId && sub.isAutoSplit) {
      const group = groups.get(sub.splitGroupId) || []
      group.push(sub)
      groups.set(sub.splitGroupId, group)
    } else {
      nonSplit.push(sub)
    }
  }

  // Merge each group
  const merged: Subtitle[] = [...nonSplit]

  for (const group of groups.values()) {
    // Sort by splitIndex to maintain word order
    const sorted = group.sort((a, b) => (a.splitIndex || 0) - (b.splitIndex || 0))

    // Combine all words from split segments
    const allWords = sorted.flatMap((s) => s.words)

    if (allWords.length === 0) continue

    merged.push({
      id: sorted[0].id, // Use first segment's ID
      startTime: allWords[0].startTime,
      endTime: allWords[allWords.length - 1].endTime,
      text: allWords.map((w) => w.text).join(' '),
      words: allWords,
      // Clear split metadata after merge
      splitGroupId: undefined,
      splitIndex: undefined,
      isAutoSplit: undefined
    })
  }

  // Sort by start time
  return merged.sort((a, b) => a.startTime - b.startTime)
}

/**
 * Check if any subtitles need splitting with current style.
 * Useful for determining if re-split is necessary.
 */
export function hasOverflowingSubtitles(
  subtitles: Subtitle[],
  style: SubtitleStyle,
  videoWidth: number
): boolean {
  const measurer = getTextMeasurer()

  for (const subtitle of subtitles) {
    if (measurer.needsSplitting(subtitle, style, videoWidth)) {
      return true
    }
  }

  return false
}
