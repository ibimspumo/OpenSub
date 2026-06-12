import { useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useProjectStore } from '@/store/projectStore'
import { useUIStore, type InspectorTab } from '@/store/uiStore'
import { usePlaybackController } from '@/hooks/usePlaybackController'
import type { AnimationType, SubtitlePosition, SubtitleStyle, FontWeight } from '@/lib/types'
import { DEFAULT_SUBTITLE_STYLE, COLOR_PRESETS } from '@/lib/types'
import TemplateGallery from './TemplateGallery'
import FontSelector from './FontSelector'
import { getWeightOptions, getAvailableWeights, ensureFontWeightLoaded } from '@/utils/fontLoader'
import { cn } from '@/lib/utils'
import { Switch } from '@/components/ui/switch'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import {
  StyleSlider,
  StyleColorPicker,
  StyleSelect,
  StyleButtonGroup,
  BoxPaddingInput,
  FieldLabel,
  SectionHeading
} from './controls'
import { RotateCcw } from 'lucide-react'

// Toggle row: label + switch on one line
function ToggleRow({
  label,
  checked,
  onCheckedChange
}: {
  label: string
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <FieldLabel>{label}</FieldLabel>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  )
}

export default function StyleEditor() {
  const { t } = useTranslation()
  const { project, updateStyle } = useProjectStore()
  const { inspectorTab, setInspectorTab, selectedSubtitleId } = useUIStore()
  const controller = usePlaybackController()

  // The video IS the live preview. If no subtitle is visible at the playhead
  // while the user tweaks the style, seek to one so the change shows instantly.
  const ensureSubtitleVisible = useCallback(() => {
    const subtitles = useProjectStore.getState().project?.subtitles
    if (!subtitles || subtitles.length === 0) return
    const time = controller.currentTime
    if (subtitles.some((s) => time >= s.startTime && time < s.endTime)) return

    const target = subtitles.find((s) => s.id === selectedSubtitleId) ?? subtitles[0]
    controller.seek(target.startTime + Math.min(0.15, (target.endTime - target.startTime) / 2))
  }, [controller, selectedSubtitleId])

  const handleUpdateStyle = useCallback(
    (updates: Parameters<typeof updateStyle>[0]) => {
      updateStyle(updates)
      ensureSubtitleVisible()
    },
    [updateStyle, ensureSubtitleVisible]
  )

  // Apply a template/profile style (font size stays tied to video resolution)
  const handleApplyProfile = useCallback(
    (profileStyle: SubtitleStyle) => {
      updateStyle({
        fontFamily: profileStyle.fontFamily,
        fontSize: profileStyle.fontSize,
        fontWeight: profileStyle.fontWeight,
        textTransform: profileStyle.textTransform,
        color: profileStyle.color,
        highlightColor: profileStyle.highlightColor,
        upcomingColor: profileStyle.upcomingColor,
        backgroundColor: profileStyle.backgroundColor,
        outlineColor: profileStyle.outlineColor,
        outlineWidth: profileStyle.outlineWidth,
        shadowColor: profileStyle.shadowColor,
        shadowOpacity: profileStyle.shadowOpacity,
        shadowBlur: profileStyle.shadowBlur,
        shadowOffsetX: profileStyle.shadowOffsetX,
        shadowOffsetY: profileStyle.shadowOffsetY,
        position: profileStyle.position,
        positionX: profileStyle.positionX,
        positionY: profileStyle.positionY,
        animation: profileStyle.animation,
        maxWidth: profileStyle.maxWidth,
        maxLines: profileStyle.maxLines,
        karaokeBoxEnabled: profileStyle.karaokeBoxEnabled,
        karaokeBoxColor: profileStyle.karaokeBoxColor,
        karaokeBoxPadding: profileStyle.karaokeBoxPadding,
        karaokeBoxBorderRadius: profileStyle.karaokeBoxBorderRadius,
        karaokeGlowEnabled: profileStyle.karaokeGlowEnabled,
        karaokeGlowColor: profileStyle.karaokeGlowColor,
        karaokeGlowOpacity: profileStyle.karaokeGlowOpacity,
        karaokeGlowBlur: profileStyle.karaokeGlowBlur
      })
    },
    [updateStyle]
  )

  const handleReset = useCallback(() => {
    handleApplyProfile(DEFAULT_SUBTITLE_STYLE as SubtitleStyle)
  }, [handleApplyProfile])

  const style = project?.style

  const weightOptions = useMemo(() => {
    if (!style) return []
    const options = getWeightOptions(style.fontFamily)
    return options.map((opt) => ({ value: String(opt.value), label: opt.label }))
  }, [style])

  if (!project || !style) return null

  const tabs: { id: InspectorTab; label: string }[] = [
    { id: 'style', label: t('styleEditor.tabStyle') },
    { id: 'animation', label: t('styleEditor.tabAnimation') },
    { id: 'effects', label: t('styleEditor.tabEffects') }
  ]
  const activeIndex = tabs.findIndex((tab) => tab.id === inspectorTab)

  return (
    <div className="h-full flex flex-col">
      {/* Tab bar with sliding pill + reset */}
      <div className="px-3 pt-2.5 pb-2 flex items-center gap-1.5">
        <div className="relative flex-1 grid grid-cols-3 h-7 rounded-lg bg-white/[0.04] p-0.5">
          {/* Sliding pill */}
          <div
            className="absolute top-0.5 bottom-0.5 rounded-md bg-white/[0.1] shadow-sm transition-transform duration-250 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
            style={{
              width: `calc((100% - 4px) / ${tabs.length})`,
              transform: `translateX(calc(${activeIndex} * 100% + 2px))`
            }}
          />
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setInspectorTab(tab.id)}
              className={cn(
                'relative z-10 text-[11px] font-medium rounded-md transition-colors duration-200',
                inspectorTab === tab.id
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground/80'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={handleReset}
              className="pressable w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">{t('styleEditor.resetToDefault')}</TooltipContent>
        </Tooltip>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-3 pb-4">
        {inspectorTab === 'style' && (
          <div key="style" className="space-y-4 animate-fade-in">
            <TemplateGallery currentStyle={style} onApplyTemplate={handleApplyProfile} />

            <div className="space-y-3">
              <SectionHeading>{t('styleEditor.typography')}</SectionHeading>

              <FontSelector
                value={style.fontFamily}
                onChange={(value) => {
                  const availableWeights = getAvailableWeights(value)
                  const currentWeight =
                    typeof style.fontWeight === 'number'
                      ? style.fontWeight
                      : style.fontWeight === 'bold'
                        ? 700
                        : 400

                  const updates: Partial<SubtitleStyle> = { fontFamily: value }
                  if (!availableWeights.includes(currentWeight)) {
                    const closestWeight = availableWeights.reduce((prev, curr) =>
                      Math.abs(curr - currentWeight) < Math.abs(prev - currentWeight) ? curr : prev
                    )
                    updates.fontWeight = closestWeight as FontWeight
                  }
                  handleUpdateStyle(updates)
                }}
              />

              <div className="grid grid-cols-2 gap-3">
                <StyleSlider
                  label={t('styleEditor.fontSize')}
                  value={style.fontSize}
                  min={24}
                  max={144}
                  unit="px"
                  onChange={(value) => handleUpdateStyle({ fontSize: value })}
                />
                <StyleSelect
                  label={t('styleEditor.fontWeight')}
                  value={String(style.fontWeight)}
                  options={weightOptions}
                  onChange={async (value) => {
                    const weight = parseInt(value, 10) as FontWeight
                    await ensureFontWeightLoaded(style.fontFamily, weight as number)
                    handleUpdateStyle({ fontWeight: weight })
                  }}
                />
              </div>

              <ToggleRow
                label={t('styleEditor.uppercase')}
                checked={style.textTransform === 'uppercase'}
                onCheckedChange={(checked) =>
                  handleUpdateStyle({ textTransform: checked ? 'uppercase' : 'none' })
                }
              />
            </div>

            <div className="space-y-3">
              <SectionHeading>{t('styleEditor.colors')}</SectionHeading>

              <div className="grid grid-cols-2 gap-3">
                <StyleColorPicker
                  label={t('styleEditor.textColor')}
                  value={style.color}
                  onChange={(value) => handleUpdateStyle({ color: value })}
                  presets={COLOR_PRESETS.text}
                />
                <StyleColorPicker
                  label={t('styleEditor.highlightColor')}
                  value={style.highlightColor}
                  onChange={(value) => handleUpdateStyle({ highlightColor: value })}
                  presets={COLOR_PRESETS.highlight}
                />
              </div>

              {style.animation === 'karaoke' && (
                <StyleColorPicker
                  label={t('styleEditor.upcomingWords')}
                  value={style.upcomingColor}
                  onChange={(value) => handleUpdateStyle({ upcomingColor: value })}
                  presets={COLOR_PRESETS.upcoming}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <StyleColorPicker
                  label={t('styleEditor.outlineColor')}
                  value={style.outlineColor}
                  onChange={(value) => handleUpdateStyle({ outlineColor: value })}
                  presets={COLOR_PRESETS.outline}
                />
                <StyleSlider
                  label={t('styleEditor.outlineWidth')}
                  value={style.outlineWidth}
                  min={0}
                  max={50}
                  step={1}
                  unit="px"
                  onChange={(value) => handleUpdateStyle({ outlineWidth: value })}
                />
              </div>
            </div>

            <div className="space-y-3">
              <SectionHeading>{t('styleEditor.position')}</SectionHeading>

              <StyleButtonGroup
                value={style.position}
                options={[
                  { value: 'top', label: t('styleEditor.positionTop') },
                  { value: 'center', label: t('styleEditor.positionCenter') },
                  { value: 'bottom', label: t('styleEditor.positionBottom') }
                ]}
                onChange={(value) => handleUpdateStyle({ position: value as SubtitlePosition })}
                columns={3}
              />

              <StyleSlider
                label={t('styleEditor.maxWidth')}
                value={Math.round((style.maxWidth ?? 0.85) * 100)}
                min={50}
                max={100}
                step={5}
                unit="%"
                onChange={(value) => handleUpdateStyle({ maxWidth: value / 100 })}
              />
            </div>
          </div>
        )}

        {inspectorTab === 'animation' && (
          <div key="animation" className="space-y-4 animate-fade-in">
            <div className="space-y-3">
              <SectionHeading>{t('styleEditor.animationType')}</SectionHeading>

              <StyleButtonGroup
                value={style.animation}
                options={[
                  { value: 'karaoke', label: t('styleEditor.animationKaraoke') },
                  { value: 'appear', label: t('styleEditor.animationAppear') },
                  { value: 'fade', label: t('styleEditor.animationFade') },
                  { value: 'scale', label: t('styleEditor.animationScale') },
                  { value: 'none', label: t('styleEditor.animationNone') }
                ]}
                onChange={(value) => handleUpdateStyle({ animation: value as AnimationType })}
                columns={2}
              />

              <p className="text-[10px] text-muted-foreground/80 leading-relaxed px-0.5">
                {style.animation === 'karaoke' && t('styleEditor.animationKaraokeDesc')}
                {style.animation === 'appear' && t('styleEditor.animationAppearDesc')}
                {style.animation === 'fade' && t('styleEditor.animationFadeDesc')}
                {style.animation === 'scale' && t('styleEditor.animationScaleDesc')}
                {style.animation === 'none' && t('styleEditor.animationNoneDesc')}
              </p>
            </div>

            {style.animation === 'karaoke' && (
              <>
                <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                  <ToggleRow
                    label={t('styleEditor.karaokeBox')}
                    checked={style.karaokeBoxEnabled}
                    onCheckedChange={(checked) => handleUpdateStyle({ karaokeBoxEnabled: checked })}
                  />

                  {style.karaokeBoxEnabled && (
                    <div className="space-y-3 animate-fade-in">
                      <StyleColorPicker
                        label={t('styleEditor.karaokeBoxColor')}
                        value={style.karaokeBoxColor}
                        onChange={(value) => handleUpdateStyle({ karaokeBoxColor: value })}
                        presets={COLOR_PRESETS.karaokeBox}
                      />
                      <BoxPaddingInput
                        label={t('styleEditor.karaokeBoxPadding')}
                        value={style.karaokeBoxPadding}
                        onChange={(value) => handleUpdateStyle({ karaokeBoxPadding: value })}
                      />
                      <StyleSlider
                        label={t('styleEditor.karaokeBoxRadius')}
                        value={style.karaokeBoxBorderRadius}
                        min={0}
                        max={300}
                        step={1}
                        unit="px"
                        onChange={(value) => handleUpdateStyle({ karaokeBoxBorderRadius: value })}
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-3 pt-2 border-t border-white/[0.06]">
                  <ToggleRow
                    label={t('styleEditor.karaokeGlow')}
                    checked={style.karaokeGlowEnabled}
                    onCheckedChange={(checked) => handleUpdateStyle({ karaokeGlowEnabled: checked })}
                  />

                  {style.karaokeGlowEnabled && (
                    <div className="space-y-3 animate-fade-in">
                      <StyleColorPicker
                        label={t('styleEditor.karaokeGlowColor')}
                        value={style.karaokeGlowColor}
                        onChange={(value) => handleUpdateStyle({ karaokeGlowColor: value })}
                        presets={COLOR_PRESETS.highlight}
                      />
                      <StyleSlider
                        label={t('styleEditor.karaokeGlowOpacity')}
                        value={style.karaokeGlowOpacity}
                        min={0}
                        max={100}
                        step={1}
                        unit="%"
                        onChange={(value) => handleUpdateStyle({ karaokeGlowOpacity: value })}
                      />
                      <StyleSlider
                        label={t('styleEditor.karaokeGlowBlur')}
                        value={style.karaokeGlowBlur}
                        min={0}
                        max={50}
                        step={1}
                        unit="px"
                        onChange={(value) => handleUpdateStyle({ karaokeGlowBlur: value })}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {inspectorTab === 'effects' && (
          <div key="effects" className="space-y-4 animate-fade-in">
            <div className="space-y-3">
              <SectionHeading>{t('styleEditor.effects')}</SectionHeading>

              <StyleColorPicker
                label={t('styleEditor.shadowColor')}
                value={style.shadowColor}
                onChange={(value) => handleUpdateStyle({ shadowColor: value })}
                presets={COLOR_PRESETS.shadow}
              />

              <div className="grid grid-cols-2 gap-3">
                <StyleSlider
                  label={t('styleEditor.shadowOpacity')}
                  value={style.shadowOpacity}
                  min={0}
                  max={100}
                  step={1}
                  unit="%"
                  onChange={(value) => handleUpdateStyle({ shadowOpacity: value })}
                />
                <StyleSlider
                  label={t('styleEditor.shadowBlur')}
                  value={style.shadowBlur}
                  min={0}
                  max={100}
                  step={1}
                  unit="px"
                  onChange={(value) => handleUpdateStyle({ shadowBlur: value })}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <StyleSlider
                  label={t('styleEditor.shadowOffsetX')}
                  value={style.shadowOffsetX ?? 0}
                  min={-50}
                  max={50}
                  step={1}
                  unit="px"
                  onChange={(value) => handleUpdateStyle({ shadowOffsetX: value })}
                />
                <StyleSlider
                  label={t('styleEditor.shadowOffsetY')}
                  value={style.shadowOffsetY ?? 0}
                  min={-50}
                  max={50}
                  step={1}
                  unit="px"
                  onChange={(value) => handleUpdateStyle({ shadowOffsetY: value })}
                />
              </div>

              <p className="text-[10px] text-muted-foreground/70 leading-relaxed px-0.5">
                {t('styleEditor.livePreviewHint')}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
