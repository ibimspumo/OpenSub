import type { Project, Subtitle, SubtitleStyle } from '../../shared/types'

/**
 * Generate ASS (Advanced SubStation Alpha) subtitle file content
 * ASS format supports styling and positioning
 */
export function generateASS(project: Project): string {
  const { subtitles, style, resolution } = project

  // Convert hex color to ASS format (&HBBGGRR)
  const toASSColor = (hex: string): string => {
    const r = hex.slice(1, 3)
    const g = hex.slice(3, 5)
    const b = hex.slice(5, 7)
    return `&H00${b}${g}${r}`.toUpperCase()
  }

  // Convert hex color with alpha for outline/shadow
  const toASSColorWithAlpha = (hex: string, alpha: number = 0): string => {
    const alphaHex = Math.round(alpha * 255)
      .toString(16)
      .padStart(2, '0')
    const r = hex.slice(1, 3)
    const g = hex.slice(3, 5)
    const b = hex.slice(5, 7)
    return `&H${alphaHex}${b}${g}${r}`.toUpperCase()
  }

  // Format time to ASS format (h:mm:ss.cc)
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    const cs = Math.floor((seconds % 1) * 100)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}.${cs.toString().padStart(2, '0')}`
  }

  // Calculate vertical alignment
  let alignment: number
  switch (style.position) {
    case 'top':
      alignment = 8 // Top center
      break
    case 'center':
      alignment = 5 // Middle center
      break
    case 'bottom':
    default:
      alignment = 2 // Bottom center
  }

  // Build ASS content
  const lines: string[] = []

  // Script Info
  lines.push('[Script Info]')
  lines.push('Title: OpenSub Export')
  lines.push('ScriptType: v4.00+')
  lines.push(`PlayResX: ${resolution.width}`)
  lines.push(`PlayResY: ${resolution.height}`)
  lines.push('WrapStyle: 0')
  lines.push('ScaledBorderAndShadow: yes')
  lines.push('')

  // Styles
  lines.push('[V4+ Styles]')
  lines.push(
    'Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding'
  )

  // Default style
  const fontWeight = style.fontWeight === 'bold' ? -1 : 0
  const primaryColor = toASSColor(style.color)
  const secondaryColor = toASSColor(style.highlightColor)
  const outlineColor = toASSColor(style.outlineColor)
  const shadowColor = toASSColorWithAlpha(style.shadowColor, 0.5)

  lines.push(
    `Style: Default,${style.fontFamily.split(',')[0].trim()},${style.fontSize},${primaryColor},${secondaryColor},${outlineColor},${shadowColor},${fontWeight},0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowBlur > 0 ? 1 : 0},${alignment},10,10,30,1`
  )

  // Highlight style for karaoke
  lines.push(
    `Style: Highlight,${style.fontFamily.split(',')[0].trim()},${style.fontSize},${secondaryColor},${primaryColor},${outlineColor},${shadowColor},${fontWeight},0,0,0,100,100,0,0,1,${style.outlineWidth},${style.shadowBlur > 0 ? 1 : 0},${alignment},10,10,30,1`
  )
  lines.push('')

  // Events
  lines.push('[Events]')
  lines.push('Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text')

  // Generate dialogue lines based on animation type
  for (const subtitle of subtitles) {
    const start = formatTime(subtitle.startTime)
    const end = formatTime(subtitle.endTime)

    if (style.animation === 'karaoke' && subtitle.words.length > 0) {
      // Karaoke mode: use \k tags for word-by-word highlighting
      let karaokeText = ''
      for (let i = 0; i < subtitle.words.length; i++) {
        const word = subtitle.words[i]
        // Calculate centiseconds for this word
        const wordDuration = Math.round((word.endTime - word.startTime) * 100)
        karaokeText += `{\\kf${wordDuration}}${word.text} `
      }
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${karaokeText.trim()}`)
    } else if (style.animation === 'fade') {
      // Fade in/out effect
      const fadeMs = 300
      lines.push(
        `Dialogue: 0,${start},${end},Default,,0,0,0,,{\\fad(${fadeMs},${fadeMs})}${subtitle.text}`
      )
    } else {
      // Static text
      lines.push(`Dialogue: 0,${start},${end},Default,,0,0,0,,${subtitle.text}`)
    }
  }

  return lines.join('\n')
}

/**
 * Generate SRT subtitle file content (simpler format)
 */
export function generateSRT(project: Project): string {
  const { subtitles } = project

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
    lines.push(subtitle.text)
    lines.push('')
  })

  return lines.join('\n')
}
