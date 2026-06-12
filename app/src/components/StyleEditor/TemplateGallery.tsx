import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Plus, RotateCcw, Save, Trash2 } from 'lucide-react'
import type { SubtitleStyle } from '@/lib/types'
import { STYLE_TEMPLATES } from '@/lib/templates'
import { useStyleProfileStore } from '@/store/styleProfileStore'
import { ensureFontLoaded } from '@/utils/fontLoader'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import StylePreview from './StylePreview'

const CARD_W = 124
const PREVIEW_H = 64

interface GalleryItem {
  id: string
  name: string
  previewText: string
  style: SubtitleStyle
  kind: 'builtin' | 'profile'
  isOverridden: boolean
}

interface TemplateGalleryProps {
  currentStyle: SubtitleStyle
  onApplyTemplate: (style: SubtitleStyle) => void
}

/**
 * Unified style gallery: built-in templates and user profiles in one row,
 * every card editable (overwrite with the current style), plus-card to save
 * the current style as a new template. Previews render through the exact
 * same canvas code as the video preview and export.
 */
export default function TemplateGallery({ currentStyle, onApplyTemplate }: TemplateGalleryProps) {
  const { t } = useTranslation()
  const {
    profiles,
    templateOverrides,
    createProfile,
    updateProfile,
    deleteProfile,
    setTemplateOverride,
    clearTemplateOverride
  } = useStyleProfileStore()

  const [appliedId, setAppliedId] = useState<string | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  // Shared animation tick so all previews highlight words in sync
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => setTick((v) => v + 1), 700)
    return () => clearInterval(interval)
  }, [])

  const items = useMemo<GalleryItem[]>(() => {
    const builtins: GalleryItem[] = STYLE_TEMPLATES.map((template) => {
      const override = templateOverrides[template.id]
      return {
        id: template.id,
        name: template.name,
        previewText: template.previewText,
        style: override ?? template.style,
        kind: 'builtin',
        isOverridden: Boolean(override)
      }
    })
    const userProfiles: GalleryItem[] = profiles.map((profile) => ({
      id: profile.id,
      name: profile.name,
      previewText: profile.name,
      style: profile.style,
      kind: 'profile',
      isOverridden: false
    }))
    return [...builtins, ...userProfiles]
  }, [profiles, templateOverrides])

  // Preload all gallery fonts so canvas previews render correctly
  useEffect(() => {
    for (const item of items) {
      ensureFontLoaded(item.style.fontFamily).catch(() => {})
    }
  }, [items])

  const handleApply = async (item: GalleryItem) => {
    await ensureFontLoaded(item.style.fontFamily).catch(() => {})
    // The style defines the look — font size stays tied to the video resolution
    const { fontSize: _size, ...styleWithoutSize } = item.style
    onApplyTemplate(styleWithoutSize as SubtitleStyle)
    setAppliedId(item.id)
    setTimeout(() => setAppliedId(null), 1200)
  }

  const handleOverwrite = (item: GalleryItem) => {
    if (item.kind === 'builtin') {
      setTemplateOverride(item.id, currentStyle)
    } else {
      updateProfile(item.id, { style: currentStyle })
    }
  }

  const handleCreate = () => {
    const name = newName.trim()
    if (!name) return
    createProfile(name, currentStyle)
    setNewName('')
    setIsCreating(false)
  }

  return (
    <div className="space-y-2">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/80 pt-1">
        {t('templates.title')}
      </h3>

      {/* py gives scaled/hovered cards room — prevents top clipping */}
      <div className="flex gap-2 overflow-x-auto scrollbar-thin py-1.5 -mx-1 px-1">
        {items.map((item) => {
          const isApplied = appliedId === item.id

          return (
            <div
              key={item.id}
              className={cn(
                'group relative flex-shrink-0 rounded-lg overflow-hidden cursor-pointer',
                'border bg-black transition-all duration-200',
                'hover:border-primary/50 hover:-translate-y-0.5',
                isApplied ? 'border-primary ring-1 ring-primary/40' : 'border-white/[0.08]'
              )}
              style={{ width: CARD_W }}
              onClick={() => handleApply(item)}
            >
              {/* Preview — same renderer as video & export */}
              <div
                className="relative flex items-center justify-center overflow-hidden bg-gradient-to-br from-zinc-800 to-zinc-950"
                style={{ height: PREVIEW_H }}
              >
                <StylePreview
                  style={item.style}
                  text={item.previewText}
                  width={CARD_W}
                  height={PREVIEW_H}
                  tick={tick}
                />

                {/* Hover actions */}
                <div
                  className={cn(
                    'absolute top-1 right-1 flex items-center gap-0.5',
                    'opacity-0 group-hover:opacity-100 transition-opacity duration-150'
                  )}
                >
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        className="pressable w-5 h-5 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleOverwrite(item)
                        }}
                      >
                        <Save className="w-3 h-3" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom">{t('templates.overwrite')}</TooltipContent>
                  </Tooltip>

                  {item.kind === 'builtin' && item.isOverridden && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="pressable w-5 h-5 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-foreground transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            clearTemplateOverride(item.id)
                          }}
                        >
                          <RotateCcw className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{t('templates.resetOverride')}</TooltipContent>
                    </Tooltip>
                  )}

                  {item.kind === 'profile' && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          className="pressable w-5 h-5 rounded-md bg-black/60 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-destructive transition-colors"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteProfile(item.id)
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom">{t('common.delete')}</TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Applied check */}
                {isApplied && (
                  <div className="absolute inset-0 bg-primary/15 flex items-center justify-center animate-fade-in">
                    <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 text-primary-foreground" />
                    </div>
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="px-2 py-1 border-t border-white/[0.06] flex items-center justify-center gap-1">
                {item.isOverridden && <span className="w-1 h-1 rounded-full bg-primary/70 shrink-0" />}
                <p className="text-[10px] font-medium text-muted-foreground group-hover:text-foreground truncate text-center transition-colors">
                  {item.name}
                </p>
              </div>
            </div>
          )
        })}

        {/* Plus card: save the current style as a new template */}
        <div
          className={cn(
            'flex-shrink-0 rounded-lg border border-dashed transition-all duration-200',
            isCreating
              ? 'border-primary/40 bg-white/[0.03]'
              : 'border-white/[0.12] hover:border-primary/40 hover:bg-white/[0.03] cursor-pointer'
          )}
          style={{ width: CARD_W, minHeight: PREVIEW_H + 26 }}
          onClick={() => !isCreating && setIsCreating(true)}
        >
          {isCreating ? (
            <div className="h-full flex flex-col items-stretch justify-center gap-1.5 p-2">
              <Input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t('templates.namePlaceholder')}
                className="h-7 text-[11px] bg-white/[0.04] border-white/[0.08]"
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate()
                  if (e.key === 'Escape') {
                    setIsCreating(false)
                    setNewName('')
                  }
                }}
                onBlur={() => {
                  if (!newName.trim()) setIsCreating(false)
                }}
              />
              <button
                className="pressable h-6 rounded-md bg-primary text-primary-foreground text-[10px] font-semibold disabled:opacity-40"
                disabled={!newName.trim()}
                onClick={(e) => {
                  e.stopPropagation()
                  handleCreate()
                }}
              >
                {t('common.save')}
              </button>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-1 text-muted-foreground hover:text-foreground transition-colors py-3">
              <Plus className="w-4 h-4" />
              <span className="text-[9px] font-medium text-center px-1 leading-tight">
                {t('templates.addProfile')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
