import { useMemo, useCallback, useEffect, useRef, useState } from 'react'
import { Upload, Film } from 'lucide-react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import type { ExportSettings, ResolutionPreset } from '../../../shared/types'
import {
  QUALITY_OPTIONS,
  estimateFileSize,
  formatFileSize,
  formatDuration,
  getDefaultResolution,
  getAdjustedPresetsForOrientation,
  getDefaultFilename
} from './exportUtils'

interface ExportDialogProps {
  onExport: (settings: ExportSettings) => void
}

export default function ExportDialog({ onExport }: ExportDialogProps) {
  const { project } = useProjectStore()
  const { showExportDialog, setShowExportDialog, exportSettings, setExportSettings } = useUIStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const [thumbnailLoaded, setThumbnailLoaded] = useState(false)

  // Get adjusted resolution presets based on video orientation
  const resolutionPresets = useMemo(() => {
    if (!project?.resolution) return []
    return getAdjustedPresetsForOrientation(project.resolution.width, project.resolution.height)
  }, [project?.resolution])

  // Initialize export settings when dialog opens
  useEffect(() => {
    if (showExportDialog && project && !exportSettings) {
      const defaultResolution = getDefaultResolution(
        project.resolution.width,
        project.resolution.height
      )
      setExportSettings({
        filename: getDefaultFilename(project.name),
        resolution: defaultResolution,
        quality: 'high'
      })
    }
  }, [showExportDialog, project, exportSettings, setExportSettings])

  // Calculate estimated file size
  const estimatedSize = useMemo(() => {
    if (!project || !exportSettings) return 0
    return estimateFileSize({
      duration: project.duration,
      targetWidth: exportSettings.resolution.width,
      targetHeight: exportSettings.resolution.height,
      quality: exportSettings.quality
    })
  }, [project, exportSettings])

  // Handle resolution change
  const handleResolutionChange = useCallback(
    (resolutionId: string) => {
      if (!exportSettings) return
      const preset = resolutionPresets.find((p) => p.id === resolutionId)
      if (preset) {
        setExportSettings({ ...exportSettings, resolution: preset })
      }
    },
    [exportSettings, resolutionPresets, setExportSettings]
  )

  // Handle quality change
  const handleQualityChange = useCallback(
    (quality: 'high' | 'medium' | 'low') => {
      if (!exportSettings) return
      setExportSettings({ ...exportSettings, quality })
    },
    [exportSettings, setExportSettings]
  )

  // Handle filename change
  const handleFilenameChange = useCallback(
    (filename: string) => {
      if (!exportSettings) return
      setExportSettings({ ...exportSettings, filename })
    },
    [exportSettings, setExportSettings]
  )

  // Handle dialog close
  const handleClose = useCallback(() => {
    setShowExportDialog(false)
    setExportSettings(null)
  }, [setShowExportDialog, setExportSettings])

  // Handle export button click
  const handleExport = useCallback(() => {
    if (!exportSettings) return
    onExport(exportSettings)
    handleClose()
  }, [exportSettings, onExport, handleClose])

  // Check if resolution differs from source
  const isResolutionChanged = useMemo(() => {
    if (!project || !exportSettings) return false
    const sourcePixels = project.resolution.width * project.resolution.height
    const targetPixels = exportSettings.resolution.width * exportSettings.resolution.height
    return Math.abs(sourcePixels - targetPixels) > sourcePixels * 0.1
  }, [project, exportSettings])

  // Find the default/source resolution preset
  const sourceResolutionId = useMemo(() => {
    if (!project) return null
    const defaultRes = getDefaultResolution(project.resolution.width, project.resolution.height)
    return defaultRes.id
  }, [project])

  if (!project || !exportSettings) return null

  return (
    <Dialog open={showExportDialog} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <Film className="h-5 w-5 text-primary" />
            Video exportieren
          </DialogTitle>
          <DialogDescription>
            Waehle Aufloesung und Qualitaet fuer den Export
          </DialogDescription>
        </DialogHeader>

        {/* Two-column layout */}
        <div className="grid grid-cols-[120px_1fr] gap-6 py-2">
          {/* Left: Video Preview (always 9:16 portrait) */}
          <div className="space-y-2">
            <div className="relative aspect-[9/16] bg-black/40 rounded-lg overflow-hidden border border-white/10">
              {/* Video thumbnail */}
              <video
                ref={videoRef}
                src={`media://${encodeURIComponent(project.videoPath)}`}
                className={cn(
                  'w-full h-full object-cover transition-opacity duration-300',
                  thumbnailLoaded ? 'opacity-100' : 'opacity-0'
                )}
                muted
                preload="metadata"
                onLoadedMetadata={() => {
                  if (videoRef.current) {
                    videoRef.current.currentTime = Math.min(1, project.duration / 10)
                  }
                }}
                onSeeked={() => setThumbnailLoaded(true)}
              />

              {/* Fallback placeholder */}
              {!thumbnailLoaded && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <Film className="h-8 w-8 text-muted-foreground/40" />
                </div>
              )}

              {/* Source resolution badge */}
              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-medium text-white/90">
                {project.resolution.width} × {project.resolution.height}
              </div>

              {/* Duration badge */}
              <div className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 bg-black/70 rounded text-[10px] font-mono text-white/90">
                {formatDuration(project.duration)}
              </div>
            </div>
          </div>

          {/* Right: Settings */}
          <div className="space-y-4">
            {/* Filename */}
            <div className="space-y-2">
              <Label htmlFor="filename" className="text-xs font-medium text-muted-foreground">
                Dateiname
              </Label>
              <Input
                id="filename"
                value={exportSettings.filename}
                onChange={(e) => handleFilenameChange(e.target.value)}
                className="h-9 bg-white/5 border-white/10 focus:border-primary/50"
              />
            </div>

            {/* Resolution */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Aufloesung</Label>
              <Select value={exportSettings.resolution.id} onValueChange={handleResolutionChange}>
                <SelectTrigger className="h-9 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {resolutionPresets.map((preset) => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex items-center gap-2">
                        <span>{preset.label}</span>
                        {preset.id === sourceResolutionId && (
                          <span className="text-[10px] text-muted-foreground bg-white/10 px-1.5 py-0.5 rounded">
                            Original
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quality */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">Qualitaet</Label>
              <Select value={exportSettings.quality} onValueChange={handleQualityChange}>
                <SelectTrigger className="h-9 bg-white/5 border-white/10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex flex-col">
                        <span>{option.label}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {option.description}
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* File size estimate */}
        <Separator className="bg-white/10" />
        <div className="flex items-center justify-between py-1">
          <span className="text-sm text-muted-foreground">Geschaetzte Dateigroesse</span>
          <span className="text-lg font-semibold tabular-nums">~{formatFileSize(estimatedSize)}</span>
        </div>

        {/* Resolution change warning */}
        {isResolutionChanged && (
          <p className="text-xs text-amber-400/80 bg-amber-500/10 rounded-lg px-3 py-2">
            Die Aufloesung unterscheidet sich vom Original. Das Video wird skaliert.
          </p>
        )}

        <DialogFooter className="gap-3 sm:gap-3">
          <Button variant="outline" onClick={handleClose} className="flex-1 sm:flex-none">
            Abbrechen
          </Button>
          <Button onClick={handleExport} className="flex-1 sm:flex-none min-w-[140px]">
            <Upload className="h-4 w-4 mr-2" />
            Exportieren
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
