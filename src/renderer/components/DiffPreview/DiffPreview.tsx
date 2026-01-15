import { useMemo } from 'react'
import { ClipboardList, CheckCircle } from 'lucide-react'
import type { SubtitleChange } from '../../../shared/types'
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
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface DiffPreviewProps {
  onClose: () => void
  onApply: () => void
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

export default function DiffPreview({ onClose, onApply }: DiffPreviewProps) {
  const { pendingChanges, updateChangeStatus, acceptAllChanges, rejectAllChanges } = useUIStore()
  const { project, updateSubtitleText } = useProjectStore()

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

  const handleApply = () => {
    // Apply accepted changes to subtitles
    const acceptedChanges = pendingChanges.filter(c => c.status === 'accepted')

    for (const change of acceptedChanges) {
      updateSubtitleText(change.subtitleId, change.correctedText)
    }

    onApply()
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
              <DialogTitle className="text-lg">KI-Korrektur Vorschau</DialogTitle>
              <DialogDescription>{summary.total} Änderungen gefunden</DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Summary badges */}
        <div className="px-6 py-3 border-b border-border flex flex-wrap gap-2">
          {summary.spelling > 0 && (
            <Badge variant="outline" className="bg-blue-500/20 text-blue-300 border-blue-500/30">
              {summary.spelling} Rechtschreibung
            </Badge>
          )}
          {summary.grammar > 0 && (
            <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
              {summary.grammar} Grammatik
            </Badge>
          )}
          {summary.context > 0 && (
            <Badge variant="outline" className="bg-violet-500/20 text-violet-300 border-violet-500/30">
              {summary.context} Kontext
            </Badge>
          )}
          {summary.name > 0 && (
            <Badge variant="outline" className="bg-emerald-500/20 text-emerald-300 border-emerald-500/30">
              {summary.name} Namen
            </Badge>
          )}
          {summary.punctuation > 0 && (
            <Badge variant="outline" className="bg-rose-500/20 text-rose-300 border-rose-500/30">
              {summary.punctuation} Zeichensetzung
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
            Alle akzeptieren
          </Button>
          <Button
            onClick={rejectAllChanges}
            variant="outline"
            size="sm"
            className="bg-red-600/20 text-red-300 border-red-500/30 hover:bg-red-600/30"
          >
            Alle ablehnen
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {summary.accepted} akzeptiert, {summary.rejected} abgelehnt
          </span>
        </div>

        {/* Changes list */}
        <ScrollArea className="flex-1 max-h-[400px]">
          <div className="px-6 py-4 space-y-3">
            {pendingChanges.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Keine Änderungen gefunden</p>
                <p className="text-xs mt-1">Die Transkription scheint korrekt zu sein</p>
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
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t border-border">
          <Button
            onClick={onClose}
            variant="outline"
          >
            Abbrechen
          </Button>
          <Button
            onClick={handleApply}
            disabled={summary.accepted === 0}
            className={cn(
              summary.accepted > 0
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            {summary.accepted > 0 ? `${summary.accepted} Änderungen übernehmen` : 'Keine Änderungen ausgewählt'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
