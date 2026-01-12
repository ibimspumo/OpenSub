import { useState, useEffect, useCallback } from 'react'
import type { StoredProjectMeta } from '../../../shared/types'

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
        <div className="flex items-center gap-2 text-dark-400">
          <div className="w-4 h-4 border-2 border-dark-600 border-t-primary-500 rounded-full animate-spin" />
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
        <svg className="w-4 h-4 text-dark-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <h2 className="text-sm font-medium text-dark-300">Letzte Projekte</h2>
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
            <div
              className={`
                relative cursor-pointer rounded-xl overflow-hidden
                bg-dark-800 border border-dark-700/50
                transition-all duration-200 ease-spring
                hover:border-dark-600 hover:shadow-lg hover:scale-[1.02]
                active:scale-[0.98]
              `}
            >
              {/* Thumbnail */}
              <div className="aspect-video bg-dark-900 relative">
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
                    <svg className="w-10 h-10 text-dark-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                    </svg>
                  </div>
                )}

                {/* Duration badge */}
                <div className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-xs text-white tabular-nums">
                  {formatDuration(project.duration)}
                </div>

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-primary-500/0 group-hover:bg-primary-500/10 transition-colors duration-200" />
              </div>

              {/* Project info */}
              <div className="p-3">
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
                    className="w-full px-2 py-1 text-sm bg-dark-700 border border-primary-500 rounded focus:outline-none text-white"
                    autoFocus
                  />
                ) : (
                  <h3 className="text-sm font-medium text-white truncate">{project.name}</h3>
                )}
                <p className="text-xs text-dark-400 mt-1">
                  {formatDate(project.updatedAt)}
                </p>
              </div>

              {/* Context menu button */}
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setContextMenuId(contextMenuId === project.id ? null : project.id)
                }}
                className={`
                  absolute top-2 right-2 p-1.5 rounded-md
                  bg-black/50 backdrop-blur-sm
                  text-white/70 hover:text-white
                  opacity-0 group-hover:opacity-100
                  transition-all duration-200
                `}
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                </svg>
              </button>

              {/* Context menu */}
              {contextMenuId === project.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute top-10 right-2 z-10 py-1 rounded-lg bg-dark-700 border border-dark-600 shadow-lg min-w-[120px]"
                >
                  <button
                    onClick={(e) => handleStartRename(project, e)}
                    className="w-full px-3 py-1.5 text-left text-sm text-dark-200 hover:bg-dark-600 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    Umbenennen
                  </button>
                  <button
                    onClick={(e) => handleDelete(project.id, e)}
                    className="w-full px-3 py-1.5 text-left text-sm text-red-400 hover:bg-dark-600 flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Löschen
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
