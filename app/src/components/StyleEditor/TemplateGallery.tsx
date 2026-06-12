import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutGrid, Check } from 'lucide-react'
import type { SubtitleStyle } from '@/lib/types'
import { STYLE_TEMPLATES } from '@/lib/templates'
import { ensureFontLoaded } from '@/utils/fontLoader'
import { cn } from '@/lib/utils'

interface TemplateGalleryProps {
  onApplyTemplate: (style: SubtitleStyle) => void
}

/**
 * Horizontal gallery of curated style templates with an animated
 * karaoke-style live preview per card.
 */
export default function TemplateGallery({ onApplyTemplate }: TemplateGalleryProps) {
  const { t } = useTranslation()
  const [appliedId, setAppliedId] = useState<string | null>(null)
  // Cycle the highlighted word for the karaoke preview effect
  const [highlightTick, setHighlightTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setHighlightTick((v) => v + 1), 700)
    return () => clearInterval(interval)
  }, [])

  // Preload template fonts so previews render correctly
  useEffect(() => {
    for (const template of STYLE_TEMPLATES) {
      ensureFontLoaded(template.style.fontFamily).catch(() => {})
    }
  }, [])

  const handleApply = async (templateId: string) => {
    const template = STYLE_TEMPLATES.find((tpl) => tpl.id === templateId)
    if (!template) return
    await ensureFontLoaded(template.style.fontFamily).catch(() => {})
    // Templates define the look — the font size stays tied to the video
    // resolution of the current project, so we keep the user's current size.
    const { fontSize: _templateFontSize, ...styleWithoutSize } = template.style
    onApplyTemplate(styleWithoutSize as typeof template.style)
    setAppliedId(templateId)
    setTimeout(() => setAppliedId(null), 1500)
  }

  return (
    <div className="pb-3 border-b border-border space-y-2.5">
      <div className="flex items-center gap-2.5">
        <div className="flex items-center justify-center w-7 h-7 rounded-lg bg-muted text-muted-foreground">
          <LayoutGrid className="w-4 h-4" />
        </div>
        <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
          {t('templates.title')}
        </span>
      </div>

      <div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1.5 -mx-1 px-1">
        {STYLE_TEMPLATES.map((template) => {
          const { style } = template
          const words = template.previewText.split(' ')
          const activeWord = highlightTick % words.length
          const isApplied = appliedId === template.id

          return (
            <button
              key={template.id}
              onClick={() => handleApply(template.id)}
              className={cn(
                'group relative flex-shrink-0 w-[104px] rounded-lg overflow-hidden',
                'border border-border/60 bg-black',
                'transition-all duration-200 hover:border-primary/50 hover:scale-[1.03]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                isApplied && 'border-primary ring-1 ring-primary/40'
              )}
            >
              {/* Preview area — simulates video frame */}
              <div className="relative h-14 flex items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 overflow-hidden">
                <div className="flex flex-wrap gap-x-1 items-center justify-center px-1 leading-none">
                  {words.map((word, i) => {
                    const isActive = i === activeWord
                    return (
                      <span
                        key={i}
                        className="text-[11px] transition-all duration-200"
                        style={{
                          fontFamily: style.fontFamily,
                          fontWeight: style.fontWeight as number,
                          color: isActive ? style.highlightColor : style.color,
                          backgroundColor:
                            isActive && style.karaokeBoxEnabled
                              ? style.karaokeBoxColor
                              : 'transparent',
                          borderRadius: 4,
                          padding: isActive && style.karaokeBoxEnabled ? '1px 3px' : '1px 0',
                          textShadow:
                            isActive && style.karaokeGlowEnabled
                              ? `0 0 8px ${style.karaokeGlowColor}`
                              : style.outlineWidth > 0
                                ? `-1px -1px 0 ${style.outlineColor}, 1px -1px 0 ${style.outlineColor}, -1px 1px 0 ${style.outlineColor}, 1px 1px 0 ${style.outlineColor}`
                                : '0 1px 4px rgba(0,0,0,0.8)',
                          transform: isActive && style.animation === 'scale' ? 'scale(1.15)' : 'none'
                        }}
                      >
                        {word}
                      </span>
                    )
                  })}
                </div>

                {/* Applied check overlay */}
                {isApplied && (
                  <div className="absolute inset-0 bg-primary/20 backdrop-blur-[1px] flex items-center justify-center animate-fade-in">
                    <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-4 h-4 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Template name */}
              <div className="px-2 py-1.5 bg-card/80 border-t border-border/40">
                <p className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground truncate text-center transition-colors">
                  {template.name}
                </p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
