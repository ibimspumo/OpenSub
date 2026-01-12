import { useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'
import SubtitleItem from './SubtitleItem'

export default function SubtitleList() {
  const { project } = useProjectStore()
  const { selectedSubtitleId, setSelectedSubtitleId, setCurrentTime } = useUIStore()

  const handleSelect = useCallback(
    (id: string, startTime: number) => {
      setSelectedSubtitleId(id)
      setCurrentTime(startTime)
    },
    [setSelectedSubtitleId, setCurrentTime]
  )

  if (!project) return null

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-dark-200">
          Untertitel ({project.subtitles.length})
        </h2>
      </div>

      {project.subtitles.length === 0 ? (
        <div className="text-center py-8 text-dark-400">
          <p>Keine Untertitel vorhanden</p>
          <p className="text-sm mt-1">Starte eine Transkription, um Untertitel zu erstellen</p>
        </div>
      ) : (
        <div className="space-y-2">
          {project.subtitles.map((subtitle) => {
            const speaker = project.speakers.find((s) => s.id === subtitle.speakerId)

            return (
              <SubtitleItem
                key={subtitle.id}
                subtitle={subtitle}
                speaker={speaker}
                isSelected={selectedSubtitleId === subtitle.id}
                onSelect={() => handleSelect(subtitle.id, subtitle.startTime)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
