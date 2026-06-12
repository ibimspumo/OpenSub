//! System font enumeration for the font selector.

use std::collections::BTreeSet;

use crate::error::AppResult;

#[tauri::command]
pub async fn list_system_fonts() -> AppResult<Vec<String>> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();

    let families: BTreeSet<String> = db
        .faces()
        .flat_map(|face| face.families.iter().map(|(name, _)| name.clone()))
        .filter(|name| !name.starts_with('.'))
        .collect();

    Ok(families.into_iter().collect())
}
