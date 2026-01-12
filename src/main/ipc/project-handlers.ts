import { ipcMain } from 'electron'
import { join } from 'path'
import { existsSync, unlinkSync } from 'fs'
import { IPC_CHANNELS } from '../../shared/types'
import type { Project, StoredProjectMeta, StoredProject } from '../../shared/types'
import {
  saveProject,
  loadProject,
  deleteProject,
  renameProject,
  listProjects,
  updateProjectThumbnail,
  getThumbnailsPath,
  closeDatabase
} from '../services/ProjectDatabase'
import { generateThumbnail } from '../services/FFmpegService'

/**
 * Register all project-related IPC handlers
 */
export function registerProjectHandlers(): void {
  // Save project
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_SAVE,
    async (_event, project: Project): Promise<StoredProjectMeta> => {
      try {
        return saveProject(project)
      } catch (error) {
        console.error('Error saving project:', error)
        throw error
      }
    }
  )

  // Load project by ID
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_LOAD,
    async (_event, id: string): Promise<StoredProject | null> => {
      try {
        return loadProject(id)
      } catch (error) {
        console.error('Error loading project:', error)
        throw error
      }
    }
  )

  // Delete project by ID
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_DELETE,
    async (_event, id: string): Promise<boolean> => {
      try {
        // Load project to get thumbnail path
        const project = loadProject(id)
        if (project?.thumbnailPath && existsSync(project.thumbnailPath)) {
          try {
            unlinkSync(project.thumbnailPath)
          } catch (e) {
            console.warn('Could not delete thumbnail:', e)
          }
        }
        return deleteProject(id)
      } catch (error) {
        console.error('Error deleting project:', error)
        throw error
      }
    }
  )

  // Rename project
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_RENAME,
    async (_event, id: string, newName: string): Promise<boolean> => {
      try {
        return renameProject(id, newName)
      } catch (error) {
        console.error('Error renaming project:', error)
        throw error
      }
    }
  )

  // List all projects
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_LIST,
    async (): Promise<StoredProjectMeta[]> => {
      try {
        return listProjects()
      } catch (error) {
        console.error('Error listing projects:', error)
        throw error
      }
    }
  )

  // Generate thumbnail for a project
  ipcMain.handle(
    IPC_CHANNELS.PROJECT_GENERATE_THUMBNAIL,
    async (_event, projectId: string, videoPath: string): Promise<string | null> => {
      try {
        // Check if video file exists
        if (!existsSync(videoPath)) {
          console.warn('Video file not found for thumbnail generation:', videoPath)
          return null
        }

        const thumbnailsDir = getThumbnailsPath()
        const thumbnailPath = join(thumbnailsDir, `${projectId}.jpg`)

        // Generate thumbnail at 1 second into the video
        await generateThumbnail(videoPath, thumbnailPath, 1)

        // Update the project with the thumbnail path
        updateProjectThumbnail(projectId, thumbnailPath)

        return thumbnailPath
      } catch (error) {
        console.error('Error generating thumbnail:', error)
        return null
      }
    }
  )
}

/**
 * Cleanup project handlers
 */
export function cleanupProjectHandlers(): void {
  closeDatabase()
}
