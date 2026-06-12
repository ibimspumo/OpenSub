//! Project persistence (SQLite via rusqlite).
//!
//! Projects are stored as a metadata row plus the full project JSON blob —
//! same model as the old Electron ProjectDatabase.

use std::path::PathBuf;
use std::sync::Mutex;

use rusqlite::Connection;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::error::{AppError, AppResult};

pub struct ProjectDb(pub Mutex<Option<Connection>>);

impl Default for ProjectDb {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProjectMeta {
    pub id: String,
    pub name: String,
    pub video_path: String,
    pub thumbnail_path: Option<String>,
    pub duration: f64,
    pub created_at: i64,
    pub updated_at: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredProject {
    #[serde(flatten)]
    pub meta: StoredProjectMeta,
    pub data: serde_json::Value,
}

fn db_path(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::msg(format!("App-Datenverzeichnis nicht verfügbar: {e}")))?;
    std::fs::create_dir_all(&dir)?;
    Ok(dir.join("projects.db"))
}

fn thumbnails_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::msg(format!("App-Datenverzeichnis nicht verfügbar: {e}")))?
        .join("thumbnails");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn with_db<T>(
    app: &AppHandle,
    state: &ProjectDb,
    f: impl FnOnce(&Connection) -> AppResult<T>,
) -> AppResult<T> {
    let mut guard = state.0.lock().unwrap();
    if guard.is_none() {
        let conn = Connection::open(db_path(app)?)?;
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS projects (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                video_path TEXT NOT NULL,
                thumbnail_path TEXT,
                duration REAL NOT NULL DEFAULT 0,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                data TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_projects_updated ON projects(updated_at DESC);",
        )?;
        *guard = Some(conn);
    }
    f(guard.as_ref().unwrap())
}

fn row_to_meta(row: &rusqlite::Row) -> rusqlite::Result<StoredProjectMeta> {
    Ok(StoredProjectMeta {
        id: row.get("id")?,
        name: row.get("name")?,
        video_path: row.get("video_path")?,
        thumbnail_path: row.get("thumbnail_path")?,
        duration: row.get("duration")?,
        created_at: row.get("created_at")?,
        updated_at: row.get("updated_at")?,
    })
}

#[tauri::command]
pub async fn project_save(
    app: AppHandle,
    state: State<'_, ProjectDb>,
    project: serde_json::Value,
) -> AppResult<StoredProjectMeta> {
    let id = project["id"]
        .as_str()
        .ok_or_else(|| AppError::msg("Projekt ohne ID"))?
        .to_string();
    let name = project["name"].as_str().unwrap_or("Untitled").to_string();
    let video_path = project["videoPath"].as_str().unwrap_or("").to_string();
    let duration = project["duration"].as_f64().unwrap_or(0.0);
    let created_at = project["createdAt"].as_i64().unwrap_or(0);
    let updated_at = project["updatedAt"].as_i64().unwrap_or(0);
    let data = serde_json::to_string(&project)?;

    with_db(&app, &state, |conn| {
        conn.execute(
            "INSERT INTO projects (id, name, video_path, duration, created_at, updated_at, data)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)
             ON CONFLICT(id) DO UPDATE SET
               name = excluded.name,
               video_path = excluded.video_path,
               duration = excluded.duration,
               updated_at = excluded.updated_at,
               data = excluded.data",
            rusqlite::params![id, name, video_path, duration, created_at, updated_at, data],
        )?;
        let meta = conn.query_row("SELECT * FROM projects WHERE id = ?1", [&id], row_to_meta)?;
        Ok(meta)
    })
}

#[tauri::command]
pub async fn project_load(
    app: AppHandle,
    state: State<'_, ProjectDb>,
    id: String,
) -> AppResult<Option<StoredProject>> {
    with_db(&app, &state, |conn| {
        let result = conn.query_row("SELECT * FROM projects WHERE id = ?1", [&id], |row| {
            let meta = row_to_meta(row)?;
            let data: String = row.get("data")?;
            Ok((meta, data))
        });
        match result {
            Ok((meta, data)) => Ok(Some(StoredProject {
                meta,
                data: serde_json::from_str(&data)?,
            })),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e.into()),
        }
    })
}

#[tauri::command]
pub async fn project_list(
    app: AppHandle,
    state: State<'_, ProjectDb>,
) -> AppResult<Vec<StoredProjectMeta>> {
    with_db(&app, &state, |conn| {
        let mut stmt = conn.prepare("SELECT * FROM projects ORDER BY updated_at DESC")?;
        let rows = stmt.query_map([], row_to_meta)?;
        Ok(rows.collect::<Result<Vec<_>, _>>()?)
    })
}

#[tauri::command]
pub async fn project_delete(
    app: AppHandle,
    state: State<'_, ProjectDb>,
    id: String,
) -> AppResult<bool> {
    // Remove thumbnail file if present
    let thumb = thumbnails_dir(&app)?.join(format!("{id}.jpg"));
    let _ = std::fs::remove_file(thumb);

    with_db(&app, &state, |conn| {
        let changed = conn.execute("DELETE FROM projects WHERE id = ?1", [&id])?;
        Ok(changed > 0)
    })
}

#[tauri::command]
pub async fn project_rename(
    app: AppHandle,
    state: State<'_, ProjectDb>,
    id: String,
    new_name: String,
) -> AppResult<bool> {
    with_db(&app, &state, |conn| {
        let now = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as i64;
        // Keep the JSON blob's name in sync
        let changed = conn.execute(
            "UPDATE projects SET
               name = ?2,
               updated_at = ?3,
               data = json_set(data, '$.name', ?2, '$.updatedAt', ?3)
             WHERE id = ?1",
            rusqlite::params![id, new_name, now],
        )?;
        Ok(changed > 0)
    })
}

#[tauri::command]
pub async fn project_thumbnail(
    app: AppHandle,
    state: State<'_, ProjectDb>,
    project_id: String,
    video_path: String,
) -> AppResult<Option<String>> {
    let target = thumbnails_dir(&app)?.join(format!("{project_id}.jpg"));

    if !target.exists() {
        if crate::ffmpeg::generate_thumbnail(&app, &video_path, &target).is_err() {
            return Ok(None);
        }
    }

    let path_str = target.to_string_lossy().to_string();
    with_db(&app, &state, |conn| {
        conn.execute(
            "UPDATE projects SET thumbnail_path = ?2 WHERE id = ?1",
            rusqlite::params![project_id, path_str],
        )?;
        Ok(())
    })?;

    Ok(Some(path_str))
}
