import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import type { Project, StoredProjectMeta, StoredProject } from '../../shared/types'

// Singleton database instance
let db: Database.Database | null = null

/**
 * Get the path to the database file
 */
function getDatabasePath(): string {
  const userDataPath = app.getPath('userData')
  const dbDir = join(userDataPath, 'data')

  // Ensure the directory exists
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true })
  }

  return join(dbDir, 'projects.db')
}

/**
 * Get the path to the thumbnails directory
 */
export function getThumbnailsPath(): string {
  const userDataPath = app.getPath('userData')
  const thumbnailsDir = join(userDataPath, 'thumbnails')

  // Ensure the directory exists
  if (!existsSync(thumbnailsDir)) {
    mkdirSync(thumbnailsDir, { recursive: true })
  }

  return thumbnailsDir
}

/**
 * Initialize the database connection and create tables if needed
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDatabasePath()
  db = new Database(dbPath)

  // Create the projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      video_path TEXT NOT NULL,
      thumbnail_path TEXT,
      duration REAL DEFAULT 0,
      data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_projects_name ON projects(name);
  `)

  return db
}

/**
 * Close the database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Save or update a project
 */
export function saveProject(project: Project): StoredProjectMeta {
  const database = initDatabase()

  const stmt = database.prepare(`
    INSERT INTO projects (id, name, video_path, thumbnail_path, duration, data, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      video_path = excluded.video_path,
      thumbnail_path = excluded.thumbnail_path,
      duration = excluded.duration,
      data = excluded.data,
      updated_at = excluded.updated_at
  `)

  const now = Date.now()
  const createdAt = project.createdAt || now
  const updatedAt = now

  // Check if project exists to preserve createdAt
  const existing = database.prepare('SELECT created_at, thumbnail_path FROM projects WHERE id = ?').get(project.id) as { created_at: number, thumbnail_path: string | null } | undefined

  stmt.run(
    project.id,
    project.name,
    project.videoPath,
    existing?.thumbnail_path || null,
    project.duration,
    JSON.stringify(project),
    existing?.created_at || createdAt,
    updatedAt
  )

  return {
    id: project.id,
    name: project.name,
    videoPath: project.videoPath,
    thumbnailPath: existing?.thumbnail_path || null,
    duration: project.duration,
    createdAt: existing?.created_at || createdAt,
    updatedAt
  }
}

/**
 * Load a project by ID
 */
export function loadProject(id: string): StoredProject | null {
  const database = initDatabase()

  const row = database.prepare(`
    SELECT id, name, video_path, thumbnail_path, duration, data, created_at, updated_at
    FROM projects WHERE id = ?
  `).get(id) as {
    id: string
    name: string
    video_path: string
    thumbnail_path: string | null
    duration: number
    data: string
    created_at: number
    updated_at: number
  } | undefined

  if (!row) return null

  return {
    id: row.id,
    name: row.name,
    videoPath: row.video_path,
    thumbnailPath: row.thumbnail_path,
    duration: row.duration,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    data: JSON.parse(row.data)
  }
}

/**
 * Delete a project by ID
 */
export function deleteProject(id: string): boolean {
  const database = initDatabase()

  const result = database.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return result.changes > 0
}

/**
 * Rename a project
 */
export function renameProject(id: string, newName: string): boolean {
  const database = initDatabase()

  // Also update the name in the JSON data
  const project = loadProject(id)
  if (!project) return false

  project.data.name = newName

  const result = database.prepare(`
    UPDATE projects SET name = ?, data = ?, updated_at = ? WHERE id = ?
  `).run(newName, JSON.stringify(project.data), Date.now(), id)

  return result.changes > 0
}

/**
 * List all projects (metadata only, sorted by last updated)
 */
export function listProjects(): StoredProjectMeta[] {
  const database = initDatabase()

  const rows = database.prepare(`
    SELECT id, name, video_path, thumbnail_path, duration, created_at, updated_at
    FROM projects
    ORDER BY updated_at DESC
  `).all() as Array<{
    id: string
    name: string
    video_path: string
    thumbnail_path: string | null
    duration: number
    created_at: number
    updated_at: number
  }>

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    videoPath: row.video_path,
    thumbnailPath: row.thumbnail_path,
    duration: row.duration,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }))
}

/**
 * Update the thumbnail path for a project
 */
export function updateProjectThumbnail(id: string, thumbnailPath: string): boolean {
  const database = initDatabase()

  const result = database.prepare(`
    UPDATE projects SET thumbnail_path = ? WHERE id = ?
  `).run(thumbnailPath, id)

  return result.changes > 0
}

/**
 * Check if a project exists
 */
export function projectExists(id: string): boolean {
  const database = initDatabase()

  const row = database.prepare('SELECT 1 FROM projects WHERE id = ?').get(id)
  return !!row
}
