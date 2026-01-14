import type { Word } from '../../shared/types'

/**
 * Redistributes word timings when text changes.
 * Uses proportional interpolation based on character length to distribute
 * the original time span across the new words.
 *
 * This ensures that when AI corrections change word count (e.g., 2 words → 5 words),
 * the timing remains synchronized with the audio.
 *
 * @param newText - The corrected/new text
 * @param startTime - Start time of the subtitle (in seconds)
 * @param endTime - End time of the subtitle (in seconds)
 * @param originalWords - Original words array (used for confidence fallback)
 * @returns Array of Word objects with redistributed timing
 */
export function redistributeWordTimings(
  newText: string,
  startTime: number,
  endTime: number,
  originalWords: Word[] = []
): Word[] {
  // Split text into words, filtering out empty strings
  const wordTexts = newText.split(/\s+/).filter((w) => w.length > 0)

  if (wordTexts.length === 0) {
    return []
  }

  // If only one word, it takes the full duration
  if (wordTexts.length === 1) {
    return [
      {
        text: wordTexts[0],
        startTime,
        endTime,
        confidence: originalWords[0]?.confidence ?? 1
      }
    ]
  }

  const totalDuration = endTime - startTime

  // Calculate total character count (used for proportional distribution)
  const totalChars = wordTexts.reduce((sum, word) => sum + word.length, 0)

  // Calculate average original confidence for fallback
  const avgConfidence =
    originalWords.length > 0
      ? originalWords.reduce((sum, w) => sum + w.confidence, 0) / originalWords.length
      : 1

  // Distribute timing proportionally based on character length
  // Longer words get more time (natural speech pattern)
  const words: Word[] = []
  let currentTime = startTime

  for (let i = 0; i < wordTexts.length; i++) {
    const wordText = wordTexts[i]

    // Calculate this word's duration based on its character proportion
    const charProportion = wordText.length / totalChars
    const wordDuration = totalDuration * charProportion

    // Add small gap between words (5% of word duration, max 50ms)
    const gap = i > 0 ? Math.min(wordDuration * 0.05, 0.05) : 0

    const wordStartTime = currentTime + gap
    const wordEndTime = wordStartTime + wordDuration - gap

    words.push({
      text: wordText,
      startTime: wordStartTime,
      endTime: Math.min(wordEndTime, endTime), // Don't exceed subtitle end
      confidence: avgConfidence
    })

    currentTime = wordEndTime
  }

  // Ensure last word ends exactly at subtitle end time
  if (words.length > 0) {
    words[words.length - 1].endTime = endTime
  }

  return words
}

/**
 * Updates subtitle text while preserving timing integrity.
 * If the word count changes, redistributes timing proportionally.
 * If word count stays the same, tries to preserve original word timings.
 *
 * @param newText - The new/corrected text
 * @param originalWords - Original words with timing
 * @param subtitleStartTime - Subtitle start time
 * @param subtitleEndTime - Subtitle end time
 * @returns Array of Word objects with appropriate timing
 */
export function updateTextWithTimingPreservation(
  newText: string,
  originalWords: Word[],
  subtitleStartTime: number,
  subtitleEndTime: number
): Word[] {
  const newWordTexts = newText.split(/\s+/).filter((w) => w.length > 0)

  // If word count is the same, preserve original timing where possible
  if (newWordTexts.length === originalWords.length) {
    return newWordTexts.map((text, index) => ({
      text,
      startTime: originalWords[index].startTime,
      endTime: originalWords[index].endTime,
      confidence: originalWords[index].confidence
    }))
  }

  // Word count changed - use proportional redistribution
  return redistributeWordTimings(
    newText,
    subtitleStartTime,
    subtitleEndTime,
    originalWords
  )
}
