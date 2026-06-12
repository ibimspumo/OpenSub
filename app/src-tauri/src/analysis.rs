//! AI subtitle correction via OpenRouter (Gemini with audio input).

use std::sync::Mutex;

use base64::Engine;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tauri::{AppHandle, Emitter, State};
use tauri_plugin_store::StoreExt;

use crate::error::{AppError, AppResult};

#[derive(Default)]
pub struct AnalysisState {
    cancel_tx: Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

// ============================================
// Types
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalyzeParams {
    pub audio_path: String,
    pub subtitles: Vec<SubtitleIn>,
    pub config: AnalysisConfig,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleIn {
    pub id: String,
    pub text: String,
    #[serde(flatten)]
    pub _rest: serde_json::Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisConfig {
    pub model: String,
    pub language: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleChange {
    pub subtitle_id: String,
    pub subtitle_index: usize,
    pub original_text: String,
    pub corrected_text: String,
    pub change_type: String,
    pub confidence: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    pub status: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisSummary {
    pub total_changes: usize,
    pub spelling_fixes: usize,
    pub grammar_fixes: usize,
    pub context_fixes: usize,
    pub punctuation_fixes: usize,
    pub name_fixes: usize,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResult {
    pub changes: Vec<SubtitleChange>,
    pub summary: AnalysisSummary,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WordTimingParams {
    pub audio_path: String,
    pub text: String,
    pub segment_start: f64,
    pub segment_end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeminiWordTiming {
    pub word: String,
    pub start: f64,
    pub end: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct WordTimingResult {
    pub words: Vec<GeminiWordTiming>,
}

// ============================================
// Helpers
// ============================================

fn emit_progress(app: &AppHandle, stage: &str, percent: f64, message: &str) {
    let _ = app.emit(
        "analysis:progress",
        json!({ "stage": stage, "percent": percent, "message": message }),
    );
}

fn api_key(app: &AppHandle) -> AppResult<String> {
    // Same settings.json the frontend writes via tauri-plugin-store
    let store = app
        .store("settings.json")
        .map_err(|e| AppError::msg(format!("Settings nicht lesbar: {e}")))?;
    store
        .get("openRouterApiKey")
        .and_then(|v| v.as_str().map(String::from))
        .filter(|k| !k.is_empty())
        .ok_or_else(|| {
            AppError::msg("Kein OpenRouter API-Key hinterlegt. Bitte in den Einstellungen eintragen.")
        })
}

/// Re-encode the project WAV to a small mono MP3 and return it base64-encoded.
fn audio_as_mp3_base64(app: &AppHandle, audio_path: &str) -> AppResult<String> {
    let mp3_path = crate::ffmpeg::extract_audio_mp3(app, audio_path)?;
    let bytes = std::fs::read(&mp3_path)?;
    let _ = std::fs::remove_file(&mp3_path);
    Ok(base64::engine::general_purpose::STANDARD.encode(bytes))
}

async fn call_openrouter(
    app: &AppHandle,
    state: &AnalysisState,
    model: &str,
    prompt: String,
    audio_base64: String,
) -> AppResult<serde_json::Value> {
    let key = api_key(app)?;

    let body = json!({
        "model": model,
        "messages": [{
            "role": "user",
            "content": [
                { "type": "text", "text": prompt },
                { "type": "input_audio", "input_audio": { "data": audio_base64, "format": "mp3" } }
            ]
        }],
        "response_format": { "type": "json_object" }
    });

    let client = reqwest::Client::new();
    let request = client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .header("Authorization", format!("Bearer {key}"))
        .header("HTTP-Referer", "https://opensub.app")
        .header("X-Title", "OpenSub")
        .json(&body)
        .send();

    // Cancellation: race the request against a oneshot cancel signal
    let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel::<()>();
    *state.cancel_tx.lock().unwrap() = Some(cancel_tx);

    let response = tokio::select! {
        result = request => result?,
        _ = cancel_rx => return Err(AppError::Cancelled),
    };

    *state.cancel_tx.lock().unwrap() = None;

    if !response.status().is_success() {
        let status = response.status();
        let text = response.text().await.unwrap_or_default();
        return Err(AppError::msg(format!("OpenRouter API-Fehler {status}: {text}")));
    }

    let result: serde_json::Value = response.json().await?;
    if let Some(error) = result.get("error").and_then(|e| e.get("message")).and_then(|m| m.as_str()) {
        return Err(AppError::msg(format!("API-Fehler: {error}")));
    }

    let content = result["choices"][0]["message"]["content"]
        .as_str()
        .ok_or_else(|| AppError::msg("Keine Antwort von der KI erhalten"))?;

    serde_json::from_str(content)
        .map_err(|_| AppError::msg("Ungültiges JSON in der KI-Antwort"))
}

fn build_analysis_prompt(subtitles: &[SubtitleIn], language: &str) -> String {
    let subtitle_list = subtitles
        .iter()
        .enumerate()
        .map(|(i, s)| format!("[{i}] {}", s.text))
        .collect::<Vec<_>>()
        .join("\n");

    format!(
        r#"Du bist ein Experte für Untertitel-Korrektur. Ich gebe dir eine Audio-Aufnahme und die automatisch generierte Transkription.

DEINE AUFGABE:
1. Höre dir das Audio genau an und verstehe den Inhalt
2. Vergleiche mit der Transkription
3. Korrigiere NUR wenn nötig:
   - Rechtschreibfehler (changeType: "spelling")
   - Grammatikfehler (changeType: "grammar")
   - Falsch erkannte Wörter basierend auf Kontext (changeType: "context")
   - Namen und Fachbegriffe (changeType: "name")
   - Zeichensetzung (changeType: "punctuation")

WICHTIG:
- Gib NUR Untertitel zurück, die korrigiert werden müssen
- Behalte die Original-Formatierung bei
- Wenn ein Untertitel korrekt ist, lass ihn weg

Sprache: {language}

AKTUELLE TRANSKRIPTION:
{subtitle_list}

ANTWORTE EXAKT IN DIESEM JSON-FORMAT (keine anderen Texte):
{{
  "correctedSubtitles": [
    {{ "index": 0, "text": "korrigierter Text", "reason": "Kurze Erklärung", "changeType": "spelling" }}
  ]
}}"#
    )
}

// ============================================
// Commands
// ============================================

#[tauri::command]
pub async fn analyze_subtitles(
    app: AppHandle,
    state: State<'_, AnalysisState>,
    params: AnalyzeParams,
) -> AppResult<AnalysisResult> {
    emit_progress(&app, "uploading", 10.0, "Audio wird vorbereitet...");
    let audio_base64 = audio_as_mp3_base64(&app, &params.audio_path)?;

    emit_progress(&app, "analyzing", 30.0, "KI analysiert Audio und Text...");
    let prompt = build_analysis_prompt(&params.subtitles, &params.config.language);
    let parsed = match call_openrouter(&app, &state, &params.config.model, prompt, audio_base64).await {
        Ok(parsed) => parsed,
        Err(e) => {
            emit_progress(&app, "error", 0.0, &e.to_string());
            return Err(e);
        }
    };

    emit_progress(&app, "comparing", 80.0, "Änderungen werden ermittelt...");

    let mut changes: Vec<SubtitleChange> = Vec::new();
    if let Some(corrections) = parsed["correctedSubtitles"].as_array() {
        for correction in corrections {
            let Some(index) = correction["index"].as_u64().map(|i| i as usize) else { continue };
            let Some(original) = params.subtitles.get(index) else { continue };
            let corrected_text = correction["text"].as_str().unwrap_or("").to_string();
            if corrected_text.trim().is_empty() || original.text.trim() == corrected_text.trim() {
                continue;
            }
            changes.push(SubtitleChange {
                subtitle_id: original.id.clone(),
                subtitle_index: index,
                original_text: original.text.clone(),
                corrected_text,
                change_type: correction["changeType"].as_str().unwrap_or("context").to_string(),
                confidence: 0.9,
                reason: correction["reason"].as_str().map(String::from),
                status: "pending".into(),
            });
        }
    }

    let count = |kind: &str| changes.iter().filter(|c| c.change_type == kind).count();
    let summary = AnalysisSummary {
        total_changes: changes.len(),
        spelling_fixes: count("spelling"),
        grammar_fixes: count("grammar"),
        context_fixes: count("context"),
        punctuation_fixes: count("punctuation"),
        name_fixes: count("name"),
    };

    emit_progress(&app, "complete", 100.0, "Analyse abgeschlossen");
    Ok(AnalysisResult { changes, summary })
}

#[tauri::command]
pub async fn gemini_word_timings(
    app: AppHandle,
    state: State<'_, AnalysisState>,
    params: WordTimingParams,
) -> AppResult<WordTimingResult> {
    let audio_base64 = audio_as_mp3_base64(&app, &params.audio_path)?;

    let prompt = format!(
        r#"Du analysierst einen Audio-Ausschnitt. Der Text beginnt ungefähr bei {start:.2}s.

Der gesprochene Text ist:
"{text}"

AUFGABE: Höre dir das Audio an und gib für JEDES WORT den exakten Zeitstempel zurück, wann es beginnt und endet.

WICHTIG:
- Die Zeitstempel müssen ABSOLUT sein (bezogen auf den Anfang der Audio-Datei)
- Das erste Wort beginnt ungefähr bei {start:.2}s, die Endzeit kann über {end:.2}s hinausgehen falls nötig
- Gib die Zeiten in Sekunden mit 2 Dezimalstellen an
- Jedes Wort aus dem Text muss einen Eintrag haben

ANTWORTE EXAKT IN DIESEM JSON-FORMAT:
{{
  "words": [
    {{ "word": "Erstes", "start": {start:.2}, "end": {next:.2} }}
  ]
}}"#,
        start = params.segment_start,
        end = params.segment_end,
        next = params.segment_start + 0.3,
        text = params.text
    );

    // Default to a Gemini model with audio input support
    let model = "google/gemini-3-flash-preview";
    let parsed = call_openrouter(&app, &state, model, prompt, audio_base64).await?;

    let words: Vec<GeminiWordTiming> = parsed["words"]
        .as_array()
        .map(|arr| {
            arr.iter()
                .filter_map(|w| {
                    Some(GeminiWordTiming {
                        word: w["word"].as_str()?.to_string(),
                        start: w["start"].as_f64()?,
                        end: w["end"].as_f64()?,
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    Ok(WordTimingResult { words })
}

#[tauri::command]
pub async fn cancel_analysis(state: State<'_, AnalysisState>) -> AppResult<()> {
    if let Some(tx) = state.cancel_tx.lock().unwrap().take() {
        let _ = tx.send(());
    }
    Ok(())
}
