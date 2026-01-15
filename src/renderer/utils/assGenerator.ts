import type { Project, Subtitle, SubtitleStyle } from '../../shared/types'
import {
  RENDERING_CONSTANTS,
  ANIMATION_CONSTANTS,
  UI_CONSTANTS,
  getFontNameForASS,
  getASSAlignment
} from '../../shared/styleConstants'

/**
 * Apply text transform (uppercase) if configured
 */
function applyTextTransform(text: string, style: SubtitleStyle): string {
  if (style.textTransform === 'uppercase') {
    return text.toUpperCase()
  }
  return text
}

/**
 * Wrap text to fit within maxWidth, respecting maxLines limit.
 * Uses \N for hard line breaks in ASS format.
 * Note: Subtitles are pre-split at the store level, so truncation is no longer needed.
 * This function now simply wraps text without losing any content.
 * @param text - The text to wrap
 * @param maxWidth - Maximum width in pixels
 * @param fontSize - Font size for estimating character width
 * @param maxLines - Maximum number of lines allowed
 * @returns Text with \N line breaks inserted
 */
function wrapTextForASS(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number
): string {
  // Approximate character width (average for proportional fonts)
  const avgCharWidth = fontSize * RENDERING_CONSTANTS.CHARACTER_WIDTH_ESTIMATE
  const maxCharsPerLine = Math.floor(maxWidth / avgCharWidth)

  if (maxCharsPerLine <= 0 || text.length <= maxCharsPerLine) {
    return text
  }

  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ''

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word

    if (testLine.length <= maxCharsPerLine) {
      currentLine = testLine
    } else {
      if (currentLine) {
        lines.push(currentLine)
        // Since subtitles are pre-split, we should rarely exceed maxLines.
        // But if we do, continue wrapping to avoid losing text.
        if (lines.length >= maxLines) {
          const remainingWords = words.slice(words.indexOf(word))
          lines.push(remainingWords.join(' '))
          return lines.join('\\N')
        }
      }
      currentLine = word
    }
  }

  // Add the last line
  if (currentLine) {
    lines.push(currentLine)
  }

  // Join with ASS hard line break
  return lines.join('\\N')
}

/**
 * Generate ASS (Advanced SubStation Alpha) subtitle file content
 * ASS format supports styling and positioning
 */
export function generateASS(project: Project): string {
  const { subtitles, style, resolution } = project

  // Parse color string (hex or rgba) to RGB components
  const parseColor = (color: string): { r: number; g: number; b: number; a: number } => {
    // Handle rgba format: rgba(r, g, b, a)
    const rgbaMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/)
    if (rgbaMatch) {
      return {
        r: parseInt(rgbaMatch[1], 10),
        g: parseInt(rgbaMatch[2], 10),
        b: parseInt(rgbaMatch[3], 10),
        a: rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1
      }
    }

    // Handle hex format: #RRGGBB or #RGB
    if (color.startsWith('#')) {
      let hex = color.slice(1)
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
      }
      return {
        r: parseInt(hex.slice(0, 2), 16),
        g: parseInt(hex.slice(2, 4), 16),
        b: parseInt(hex.slice(4, 6), 16),
        a: 1
      }
    }

    // Default to black
    return { r: 0, g: 0, b: 0, a: 1 }
  }

  // Convert color to ASS format (&HBBGGRR)
  const toASSColor = (color: string): string => {
    const { r, g, b } = parseColor(color)
    const rHex = r.toString(16).padStart(2, '0')
    const gHex = g.toString(16).padStart(2, '0')
    const bHex = b.toString(16).padStart(2, '0')
    return `&H00${bHex}${gHex}${rHex}`.toUpperCase()
  }

  // Convert color with alpha for outline/shadow (&HAABBGGRR)
  const toASSColorWithAlpha = (color: string, alphaOverride?: number): string => {
    const { r, g, b, a } = parseColor(color)
    // Use override alpha if provided, otherwise use color's alpha
    // ASS alpha: 00 = opaque, FF = transparent (inverted!)
    const alpha = alphaOverride !== undefined ? alphaOverride : a
    const alphaHex = Math.round((1 - alpha) * 255).toString(16).padStart(2, '0')
    const rHex = r.toString(16).padStart(2, '0')
    const gHex = g.toString(16).padStart(2, '0')
    const bHex = b.toString(16).padStart(2, '0')
    return `&H${alphaHex}${bHex}${gHex}${rHex}`.toUpperCase()
  }

  // Format time to ASS format (h:mm:ss.cc)
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const cs = Math.floor((seconds % 1) * 100)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  // Calculate vertical alignment using centralized constants
  const alignment = getASSAlignment(style.position)

  // Calculate margins based on maxWidth for text box constraints
  // MarginL and MarginR together define the text box width
  const maxWidthPercent = style.maxWidth || 0.85
  const sideMarginPercent = (1 - maxWidthPercent) / 2
  const marginLR = Math.round(sideMarginPercent * resolution.width)

  // Build ASS content
  const lines: string[] = []

  // Script Info
  lines.push('[Script Info]')
  lines.push('Title: OpenSub Export')
  lines.push('ScriptType: v4.00+')
  lines.push(`PlayResX: ${resolution.width}`)
  lines.push(`PlayResY: ${resolution.height}`)
  // WrapStyle 2: No automatic word wrapping - we control line breaks explicitly
  // This allows the SubtitleCanvas text wrapping to be preserved in ASS export
  lines.push('WrapStyle: 2')
  lines.push('ScaledBorderAndShadow: yes')
  lines.push('')

  // Styles
  lines.push('[V4+ Styles]')
  lines.push(
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding'
  )

  // Default style
  // ASS uses -1 for bold, 0 for normal
  // For numeric weights, consider >= BOLD_WEIGHT_THRESHOLD as bold (Semi Bold and above)
  const isBold = typeof style.fontWeight === 'number'
    ? style.fontWeight >= RENDERING_CONSTANTS.BOLD_WEIGHT_THRESHOLD
    : style.fontWeight === 'bold'
  const fontWeight = isBold ? -1 : 0
  // In ASS karaoke: PrimaryColor is for words not yet highlighted (upcoming)
  // SecondaryColor is for words during/after highlight
  // For non-karaoke modes, primaryColor is the normal text color
  const primaryColor = style.animation === 'karaoke' && style.upcomingColor
    ? toASSColor(style.upcomingColor)
    : toASSColor(style.color)
  const secondaryColor = toASSColor(style.highlightColor)
  const outlineColor = toASSColor(style.outlineColor)
  const shadowColor = toASSColorWithAlpha(style.shadowColor, 0.5)

  // Calculate vertical margin based on position
  // For custom position, convert positionY (0-1) to margin from bottom
  let marginV = UI_CONSTANTS.DEFAULT_MARGIN_V
  if (style.position === 'custom' && typeof style.positionY === 'number') {
    // positionY is from top (0 = top, 1 = bottom)
    // MarginV in ASS is from the alignment edge
    // For bottom alignment (2), margin is from bottom
    // For top alignment (8), margin is from top
    if (alignment === 2) {
      // Bottom alignment: margin from bottom
      marginV = Math.round((1 - style.positionY) * resolution.height)
    } else if (alignment === 8) {
      // Top alignment: margin from top
      marginV = Math.round(style.positionY * resolution.height)
    }
  }

  // Get the proper font name for ASS (libass needs actual font names, not CSS aliases)
  const fontName = getFontNameForASS(style.fontFamily)

  // Calculate shadow depth for ASS style (uses the larger of X/Y offset, or blur if no offset)
  const shadowOffsetX = style.shadowOffsetX ?? 0
  const shadowOffsetY = style.shadowOffsetY ?? 0
  const hasShadow = style.shadowBlur > 0 || shadowOffsetX !== 0 || shadowOffsetY !== 0
  // ASS shadow depth is a single value - use the diagonal of the offset vector, minimum 1 if shadow is enabled
  const shadowDepth = hasShadow
    ? Math.max(1, Math.round(Math.sqrt(shadowOffsetX * shadowOffsetX + shadowOffsetY * shadowOffsetY) / 2))
    : 0

  lines.push(
    `Style: Default,${fontName},${style.fontSize},${primaryColor},${secondaryColor},${outlineColor},${shadowColor},${fontWeight},0,0,0,100,100,0,0,1,${style.outlineWidth},${shadowDepth},${alignment},${marginLR},${marginLR},${marginV},1`
  )

  // Highlight style for karaoke
  lines.push(
    `Style: Highlight,${fontName},${style.fontSize},${secondaryColor},${primaryColor},${outlineColor},${shadowColor},${fontWeight},0,0,0,100,100,0,0,1,${style.outlineWidth},${shadowDepth},${alignment},${marginLR},${marginLR},${marginV},1`
  )
  lines.push('')

  // Events
  lines.push('[Events]')
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text')

  // Calculate actual max width in pixels for text wrapping
  const textBoxWidth = resolution.width * maxWidthPercent
  const maxLines = style.maxLines || 2

  // Generate dialogue lines based on animation type
  for (const subtitle of subtitles) {
    const start = formatTime(subtitle.startTime)
    const end = formatTime(subtitle.endTime)

    // \q2 override tag ensures no automatic word wrapping for this dialogue
    // Combined with WrapStyle: 2 in Script Info, this gives us full control over line breaks
    // \xshad and \yshad set the shadow X/Y offsets
    const shadowTags = (shadowOffsetX !== 0 || shadowOffsetY !== 0)
      ? `\\xshad${shadowOffsetX}\\yshad${shadowOffsetY}`
      : ''
    const wrapTag = `{\\q2${shadowTags}}`

    if (style.animation === 'karaoke' && subtitle.words.length > 0) {
      // Karaoke mode: use \k tags for word-by-word highlighting
      // For karaoke, we need to preserve word timings, so we wrap the words differently
      let karaokeText = ''
      let currentLineLength = 0
      let lineCount = 1
      const avgCharWidth = style.fontSize * RENDERING_CONSTANTS.CHARACTER_WIDTH_ESTIMATE
      const maxCharsPerLine = Math.floor(textBoxWidth / avgCharWidth)

      // Karaoke box styling using \bord\shad technique
      // When enabled, the highlighted word gets a colored border/shadow that acts as a background box
      const karaokeBoxEnabled = style.karaokeBoxEnabled ?? false
      const karaokeBoxColor = style.karaokeBoxColor ?? '#32CD32'
      const karaokeBoxPadding = style.karaokeBoxPadding ?? 4

      // Convert karaoke box color to ASS format for use in override tags
      const boxColorASS = toASSColor(karaokeBoxColor)

      // Build karaoke box override tags
      // \3c sets border color, \4c sets shadow color
      // \bord sets border thickness (acts as padding), \shad adds shadow depth
      // \xbord and \ybord can control horizontal and vertical border separately
      const boxStartTag = karaokeBoxEnabled
        ? `\\3c${boxColorASS}\\4c${boxColorASS}\\bord${karaokeBoxPadding}\\shad0`
        : ''

      // Reset tags to restore normal styling after highlighted word
      const boxEndTag = karaokeBoxEnabled
        ? `\\3c${outlineColor}\\4c${shadowColor}\\bord${style.outlineWidth}\\shad${shadowDepth}${shadowTags}`
        : ''

      for (let i = 0; i < subtitle.words.length; i++) {
        const word = subtitle.words[i]
        // Apply text transform to word
        const transformedWord = applyTextTransform(word.text, style)
        const wordWithSpace = transformedWord + ' '
        const wordDuration = Math.round((word.endTime - word.startTime) * 100)

        // Check if we need to wrap to next line
        if (currentLineLength + wordWithSpace.length > maxCharsPerLine && currentLineLength > 0 && lineCount < maxLines) {
          karaokeText += '\\N'
          currentLineLength = 0
          lineCount++
        }

        // Apply karaoke box styling: the \kf tag triggers highlight,
        // and the box styling creates a background effect behind the highlighted word
        if (karaokeBoxEnabled) {
          // Use transform tags to apply box styling when word becomes highlighted
          // \t applies transformation over time, coordinated with \kf timing
          karaokeText += `{\\kf${wordDuration}${boxStartTag}}${transformedWord}{${boxEndTag}} `
        } else {
          karaokeText += `{\\kf${wordDuration}}${transformedWord} `
        }
        currentLineLength += wordWithSpace.length
      }
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${wrapTag}${karaokeText.trim()}`)
    } else if (style.animation === 'fade') {
      // Fade in/out effect with text wrapping
      const fadeMs = ANIMATION_CONSTANTS.FADE_MS
      // Apply text transform before wrapping
      const transformedText = applyTextTransform(subtitle.text, style)
      const wrappedText = wrapTextForASS(transformedText, textBoxWidth, style.fontSize, maxLines)
      lines.push(
        `Dialogue: 0,${start},${end},Default,,0,0,0,,${wrapTag}{\\fad(${fadeMs},${fadeMs})}${wrappedText}`
      )
    } else {
      // Static text with wrapping
      // Apply text transform before wrapping
      const transformedText = applyTextTransform(subtitle.text, style)
      const wrappedText = wrapTextForASS(transformedText, textBoxWidth, style.fontSize, maxLines)
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${wrapTag}${wrappedText}`)
    }
  }

  return lines.join('\n')
}

/**
 * Generate SRT subtitle file content (simpler format)
 */
export function generateSRT(project: Project): string {
  const { subtitles, style } = project

  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const ms = Math.floor((seconds % 1) * 1000)
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')},${ms.toString().padStart(3, '0')}`
  }

  const lines: string[] = []

  subtitles.forEach((subtitle, index) => {
    lines.push(`${index + 1}`)
    lines.push(`${formatTime(subtitle.startTime)} --> ${formatTime(subtitle.endTime)}`)
    // Apply text transform if configured
    lines.push(applyTextTransform(subtitle.text, style))
    lines.push('')
  })

  return lines.join('\n')
}
