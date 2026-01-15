import { useState, useEffect, useCallback } from 'react'
import { Clock, Film, MoreVertical, Pencil, Trash2, Loader2 } from 'lucide-react'
import type { StoredProjectMeta } from '../../../shared/types'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ProjectBrowserProps {
  onOpenProject: (projectId: string) => void
}

/**
 * Format duration in seconds to human readable format
 */
function formatDuration(seconds: number): string {
  if (!seconds) return '0:00'

  const mins = Math.floor(seconds / 60)
  const secs = Math.floor(seconds % 60)

  return `${mins}:${secs.toString().padStart(2, '0')}`
}

/**
 * Format date to relative time
 */
function formatDate(timestamp: number): string {
  const now = Date.now()
  const diff = now - timestamp

  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 7) {
    return new Date(timestamp).toLocaleDateString('de-DE', {
      day: 'numeric',
      month: 'short'
    })
  }
  if (days > 0) return `vor ${days}d`
  if (hours > 0) return `vor ${hours}h`
  if (minutes > 0) return `vor ${minutes}m`
  return 'gerade eben'
}

export default function ProjectBrowser({ onOpenProject }: ProjectBrowserProps) {
  const [projects, setProjects] = useState<StoredProjectMeta[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [contextMenuId, setContextMenuId] = useState<string | null>(null)

  // Load projects
  const loadProjects = useCallback(async () => {
    try {
      setIsLoading(true)
      const projectList = await window.api.project.list()
      setProjects(projectList)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  // Handle rename
  const handleStartRename = (project: StoredProjectMeta, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingId(project.id)
    setEditName(project.name)
    setContextMenuId(null)
  }

  const handleSaveRename = async () => {
    if (!editingId || !editName.trim()) {
      setEditingId(null)
      return
    }

    try {
      await window.api.project.rename(editingId, editName.trim())
      await loadProjects()
    } catch (error) {
      console.error('Failed to rename project:', error)
    } finally {
      setEditingId(null)
    }
  }

  const handleCancelRename = () => {
    setEditingId(null)
  }

  // Handle delete
  const handleDelete = async (projectId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setContextMenuId(null)

    const confirmed = confirm('Möchtest du dieses Projekt wirklich löschen?')
    if (!confirmed) return

    try {
      await window.api.project.delete(projectId)
      await loadProjects()
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClick = () => setContextMenuId(null)
    window.addEventListener('click', handleClick)
    return () => window.removeEventListener('click', handleClick)
  }, [])

  if (isLoading) {
    return (
      <div className="mt-8 flex justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Projekte laden...</span>
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return null
  }

  return (
    <div className="mt-8 w-full max-w-4xl mx-auto px-4">
      {/* Section header */}
      <div className="flex items-center gap-2 mb-4">
        <Clock className="w-4 h-4 text-muted-foreground" />
        <h2 className="text-sm font-medium text-muted-foreground">Letzte Projekte</h2>
      </div>

      {/* Project grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {projects.map((project) => (
          <div
            key={project.id}
            className="group relative"
            onClick={() => onOpenProject(project.id)}
          >
            {/* Project card */}
            <Card
              className={cn(
                'cursor-pointer overflow-hidden',
                'transition-all duration-200 ease-out',
                'hover:border-muted-foreground/30 hover:shadow-lg hover:scale-[1.02]',
                'active:scale-[0.98]'
              )}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-muted relative">
                {project.thumbnailPath ? (
                  <img
                    src={`media://${project.thumbnailPath}`}
                    alt={project.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Hide broken images
                      (e.target as HTMLImageElement).style.display = 'none'
                    }}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Film className="w-10 h-10 text-muted-foreground/30" />
                  </div>
                )}

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white tabular-nums">
                  {formatDuration(project.duration)}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-primary/0 group-hover:bg-primary/10 transition-colors duration-200" />
              </div>

              {/* Project info */}
              <CardContent className="p-3">
                {editingId === project.id ? (
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveRename()
                      if (e.key === 'Escape') handleCancelRename()
                    }}
                    onBlur={handleSaveRename}
                    onClick={(e) => e.stopPropagation()}
                    className="w-full px-2 py-1 text-sm bg-muted border border-primary rounded focus:outline-none text-foreground"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-sm font-medium text-foreground truncate">{project.name}</h3>
                )}
                <p className="text-xs text-muted-foreground mt-1">
                  {formatDate(project.updatedAt)}
                </p>
              </CardContent>

              {/* Context menu button */}
              <Button
                onClick={(e) => {
                  e.stopPropagation()
                  setContextMenuId(contextMenuId === project.id ? null : project.id)
                }}
                variant="ghost"
                size="icon"
                className={cn(
                  'absolute top-2 right-2 h-8 w-8',
                  'bg-black/50 backdrop-blur-sm',
                  'text-white/70 hover:text-white hover:bg-black/70',
                  'opacity-0 group-hover:opacity-100',
                  'transition-all duration-200'
                )}
              >
                <MoreVertical className="w-4 h-4" />
              </Button>

              {/* Context menu */}
              {contextMenuId === project.id && (
                <Card
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-10 right-2 z-10 py-1 min-w-[120px] shadow-lg"
                >
                  <Button
                    onClick={(e) => handleStartRename(project, e)}
                    variant="ghost"
                    className="w-full justify-start px-3 py-1.5 h-auto text-sm font-normal"
                  >
                    <Pencil className="w-4 h-4 mr-2" />
                    Umbenennen
                  </Button>
                  <Button
                    onClick={(e) => handleDelete(project.id, e)}
                    variant="ghost"
                    className="w-full justify-start px-3 py-1.5 h-auto text-sm font-normal text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Löschen
                  </Button>
                </Card>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  )
}
