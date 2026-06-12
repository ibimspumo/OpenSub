//! Parakeet TDT 0.6b v3 ASR engine (ONNX, in-process).
//!
//! Replaces the old bundled-Python WhisperX service entirely. A dedicated
//! worker thread owns the loaded models (they stay cached in memory between
//! jobs); commands talk to it via channels. Long audio is split into ~60 s
//! chunks at the quietest point to bound memory usage.

use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex};

use parakeet_rs::sortformer::{DiarizationConfig, Sortformer};
use parakeet_rs::{ParakeetTDT, TimestampMode, Transcriber};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::{AppError, AppResult};

const SAMPLE_RATE: usize = 16_000;
const MAX_CHUNK_SECS: f64 = 60.0;
/// Search for a quiet split point within the last N seconds of a chunk
const SPLIT_SEARCH_SECS: f64 = 15.0;

const ASR_REPO: &str = "https://huggingface.co/istupakov/parakeet-tdt-0.6b-v3-onnx/resolve/main";
const ASR_FILES: &[(&str, u64)] = &[
    ("encoder-model.int8.onnx", 652_000_000),
    ("decoder_joint-model.int8.onnx", 18_200_000),
    ("vocab.txt", 90_000),
];
const DIAR_URL: &str =
    "https://huggingface.co/altunenes/parakeet-rs/resolve/main/diar_streaming_sortformer_4spk-v2.1.onnx";
const DIAR_FILE: &str = "diar_streaming_sortformer_4spk-v2.1.onnx";

// ============================================
// Types (mirror src/lib/types.ts)
// ============================================

#[derive(Debug, Clone, Deserialize, Default)]
#[serde(rename_all = "camelCase", default)]
pub struct TranscriptionOptions {
    pub language: Option<String>,
    pub diarize: Option<bool>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionWord {
    pub word: String,
    pub start: f64,
    pub end: f64,
    pub score: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionSegment {
    pub start: f64,
    pub end: f64,
    pub text: String,
    pub words: Vec<TranscriptionWord>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speaker: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionResult {
    pub segments: Vec<TranscriptionSegment>,
    pub language: String,
    pub duration: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptionProgress {
    pub stage: String,
    pub percent: f64,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelStatus {
    pub asr_ready: bool,
    pub diarization_ready: bool,
    pub asr_size_bytes: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelDownloadProgress {
    pub model: String,
    pub file: String,
    pub percent: f64,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub status: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

// ============================================
// Worker
// ============================================

enum Job {
    Transcribe {
        audio_path: String,
        options: TranscriptionOptions,
        reply: tokio::sync::oneshot::Sender<AppResult<TranscriptionResult>>,
    },
    Realign {
        audio_path: String,
        start: f64,
        end: f64,
        reply: tokio::sync::oneshot::Sender<AppResult<Vec<TranscriptionWord>>>,
    },
}

pub struct AsrState {
    job_tx: Mutex<Option<mpsc::Sender<Job>>>,
    cancel: Arc<AtomicBool>,
    download_cancel: Arc<AtomicBool>,
}

impl Default for AsrState {
    fn default() -> Self {
        Self {
            job_tx: Mutex::new(None),
            cancel: Arc::new(AtomicBool::new(false)),
            download_cancel: Arc::new(AtomicBool::new(false)),
        }
    }
}

pub fn models_dir(app: &AppHandle) -> AppResult<PathBuf> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| AppError::msg(format!("App-Datenverzeichnis nicht verfügbar: {e}")))?
        .join("models");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn asr_model_dir(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(models_dir(app)?.join("parakeet-tdt-0.6b-v3"))
}

fn diar_model_path(app: &AppHandle) -> AppResult<PathBuf> {
    Ok(models_dir(app)?.join("sortformer").join(DIAR_FILE))
}

fn asr_ready(app: &AppHandle) -> bool {
    let Ok(dir) = asr_model_dir(app) else { return false };
    ASR_FILES.iter().all(|(name, min_size)| {
        dir.join(name)
            .metadata()
            .map(|m| m.len() >= min_size / 2)
            .unwrap_or(false)
    })
}

/// Ensure the worker thread exists and return a job sender.
fn ensure_worker(app: &AppHandle, state: &AsrState) -> mpsc::Sender<Job> {
    let mut guard = state.job_tx.lock().unwrap();
    if let Some(tx) = guard.as_ref() {
        return tx.clone();
    }

    let (tx, rx) = mpsc::channel::<Job>();
    let app = app.clone();
    let cancel = state.cancel.clone();

    std::thread::spawn(move || {
        let mut engine: Option<ParakeetTDT> = None;
        let mut diarizer: Option<Sortformer> = None;

        while let Ok(job) = rx.recv() {
            match job {
                Job::Transcribe { audio_path, options, reply } => {
                    cancel.store(false, Ordering::SeqCst);
                    let result = run_transcription(
                        &app,
                        &mut engine,
                        &mut diarizer,
                        &audio_path,
                        &options,
                        &cancel,
                    );
                    let _ = reply.send(result);
                }
                Job::Realign { audio_path, start, end, reply } => {
                    cancel.store(false, Ordering::SeqCst);
                    let result = run_realign(&app, &mut engine, &audio_path, start, end);
                    let _ = reply.send(result);
                }
            }
        }
    });

    *guard = Some(tx.clone());
    tx
}

fn emit_progress(app: &AppHandle, stage: &str, percent: f64, message: impl Into<String>) {
    let _ = app.emit(
        "transcription:progress",
        TranscriptionProgress {
            stage: stage.to_string(),
            percent,
            message: message.into(),
        },
    );
}

fn load_engine(app: &AppHandle, engine: &mut Option<ParakeetTDT>) -> AppResult<()> {
    if engine.is_some() {
        return Ok(());
    }
    if !asr_ready(app) {
        return Err(AppError::msg(
            "KI-Modell nicht heruntergeladen. Bitte zuerst das Modell im Setup laden.",
        ));
    }
    emit_progress(app, "initializing", 5.0, "Lade Parakeet-Modell...");
    let dir = asr_model_dir(app)?;
    let loaded = ParakeetTDT::from_pretrained(&dir, None)
        .map_err(|e| AppError::msg(format!("Modell konnte nicht geladen werden: {e}")))?;
    *engine = Some(loaded);
    emit_progress(app, "initializing", 100.0, "Modell geladen");
    Ok(())
}

fn load_wav(audio_path: &str) -> AppResult<Vec<f32>> {
    let mut reader = hound::WavReader::open(audio_path)
        .map_err(|e| AppError::msg(format!("Audio konnte nicht gelesen werden: {e}")))?;
    let spec = reader.spec();
    if spec.sample_rate as usize != SAMPLE_RATE {
        return Err(AppError::msg(format!(
            "Unerwartete Samplerate {} (erwartet 16000)",
            spec.sample_rate
        )));
    }
    let samples: Vec<f32> = match spec.sample_format {
        hound::SampleFormat::Float => reader.samples::<f32>().map(|s| s.unwrap_or(0.0)).collect(),
        hound::SampleFormat::Int => reader
            .samples::<i16>()
            .map(|s| s.unwrap_or(0) as f32 / 32768.0)
            .collect(),
    };
    // Down-mix if somehow not mono
    if spec.channels > 1 {
        let ch = spec.channels as usize;
        return Ok(samples
            .chunks(ch)
            .map(|c| c.iter().sum::<f32>() / ch as f32)
            .collect());
    }
    Ok(samples)
}

/// Split audio into chunks of at most MAX_CHUNK_SECS, cutting at the quietest
/// 200 ms window within the final SPLIT_SEARCH_SECS of each chunk.
fn chunk_boundaries(samples: &[f32]) -> Vec<(usize, usize)> {
    let max_chunk = (MAX_CHUNK_SECS * SAMPLE_RATE as f64) as usize;
    let search = (SPLIT_SEARCH_SECS * SAMPLE_RATE as f64) as usize;
    let window = SAMPLE_RATE / 5; // 200 ms

    let mut chunks = Vec::new();
    let mut start = 0usize;

    while samples.len() - start > max_chunk {
        let hard_end = start + max_chunk;
        let search_start = hard_end - search;

        // Find quietest 200 ms window in [search_start, hard_end]
        let mut best_pos = hard_end;
        let mut best_energy = f64::MAX;
        let mut pos = search_start;
        while pos + window <= hard_end {
            let energy: f64 = samples[pos..pos + window]
                .iter()
                .map(|s| (*s as f64) * (*s as f64))
                .sum();
            if energy < best_energy {
                best_energy = energy;
                best_pos = pos + window / 2;
            }
            pos += window / 2;
        }

        chunks.push((start, best_pos));
        start = best_pos;
    }
    if start < samples.len() {
        chunks.push((start, samples.len()));
    }
    chunks
}

fn transcribe_chunk(
    engine: &mut ParakeetTDT,
    samples: &[f32],
    offset_secs: f64,
) -> AppResult<Vec<TranscriptionWord>> {
    let result = engine
        .transcribe_samples(samples.to_vec(), SAMPLE_RATE as u32, 1, Some(TimestampMode::Words))
        .map_err(|e| AppError::msg(format!("Transkription fehlgeschlagen: {e}")))?;

    // Build words, merging punctuation-only tokens into the preceding word
    let mut words: Vec<TranscriptionWord> = Vec::new();
    for token in &result.tokens {
        let text = token.text.trim();
        if text.is_empty() {
            continue;
        }
        let is_punctuation = text.chars().all(|c| !c.is_alphanumeric());
        if is_punctuation {
            if let Some(last) = words.last_mut() {
                last.word.push_str(text);
                last.end = last.end.max(token.end as f64 + offset_secs);
                continue;
            }
        }
        words.push(TranscriptionWord {
            word: text.to_string(),
            start: token.start as f64 + offset_secs,
            end: token.end as f64 + offset_secs,
            score: 1.0,
        });
    }
    Ok(words)
}

/// Group words into subtitle segments: break on sentence-ending punctuation,
/// long pauses, or when a segment grows too long.
fn segment_words(words: Vec<TranscriptionWord>) -> Vec<TranscriptionSegment> {
    const MAX_SEGMENT_SECS: f64 = 7.0;
    const MAX_GAP_SECS: f64 = 1.0;

    let mut segments: Vec<TranscriptionSegment> = Vec::new();
    let mut current: Vec<TranscriptionWord> = Vec::new();

    let flush = |current: &mut Vec<TranscriptionWord>, segments: &mut Vec<TranscriptionSegment>| {
        if current.is_empty() {
            return;
        }
        let text = current
            .iter()
            .map(|w| w.word.as_str())
            .collect::<Vec<_>>()
            .join(" ");
        segments.push(TranscriptionSegment {
            start: current.first().unwrap().start,
            end: current.last().unwrap().end,
            text,
            words: std::mem::take(current),
            speaker: None,
        });
    };

    for word in words {
        if let Some(last) = current.last() {
            let gap = word.start - last.end;
            let duration = word.end - current.first().unwrap().start;
            if gap >= MAX_GAP_SECS || duration >= MAX_SEGMENT_SECS {
                flush(&mut current, &mut segments);
            }
        }

        let ends_sentence = word
            .word
            .chars()
            .last()
            .map(|c| matches!(c, '.' | '!' | '?' | '…'))
            .unwrap_or(false);

        current.push(word);

        if ends_sentence {
            flush(&mut current, &mut segments);
        }
    }
    flush(&mut current, &mut segments);
    segments
}

fn run_transcription(
    app: &AppHandle,
    engine: &mut Option<ParakeetTDT>,
    diarizer: &mut Option<Sortformer>,
    audio_path: &str,
    options: &TranscriptionOptions,
    cancel: &AtomicBool,
) -> AppResult<TranscriptionResult> {
    load_engine(app, engine)?;
    let engine = engine.as_mut().unwrap();

    emit_progress(app, "loading", 0.0, "Lade Audio-Datei...");
    let samples = load_wav(audio_path)?;
    let duration = samples.len() as f64 / SAMPLE_RATE as f64;

    if cancel.load(Ordering::SeqCst) {
        return Err(AppError::Cancelled);
    }

    let chunks = chunk_boundaries(&samples);
    let total_chunks = chunks.len();
    let mut all_words: Vec<TranscriptionWord> = Vec::new();

    for (i, (start, end)) in chunks.iter().enumerate() {
        if cancel.load(Ordering::SeqCst) {
            return Err(AppError::Cancelled);
        }
        let percent = 5.0 + (i as f64 / total_chunks as f64) * 80.0;
        emit_progress(
            app,
            "transcribing",
            percent,
            format!("Transkribiere Abschnitt {} von {}...", i + 1, total_chunks),
        );

        let offset = *start as f64 / SAMPLE_RATE as f64;
        let words = transcribe_chunk(engine, &samples[*start..*end], offset)?;
        all_words.extend(words);
    }

    let mut segments = segment_words(all_words);

    // Optional speaker diarization
    if options.diarize.unwrap_or(false) {
        if cancel.load(Ordering::SeqCst) {
            return Err(AppError::Cancelled);
        }
        emit_progress(app, "diarizing", 88.0, "Erkenne Sprecher...");
        match run_diarization(app, diarizer, &samples) {
            Ok(speaker_segments) => assign_speakers(&mut segments, &speaker_segments),
            Err(e) => {
                // Diarization is best-effort: log but don't fail the transcription
                eprintln!("Diarization failed: {e}");
            }
        }
    }

    emit_progress(app, "complete", 100.0, "Transkription abgeschlossen");

    Ok(TranscriptionResult {
        segments,
        language: options.language.clone().unwrap_or_else(|| "auto".into()),
        duration,
    })
}

fn run_diarization(
    app: &AppHandle,
    diarizer: &mut Option<Sortformer>,
    samples: &[f32],
) -> AppResult<Vec<(usize, f64, f64)>> {
    if diarizer.is_none() {
        let path = diar_model_path(app)?;
        if !path.exists() {
            return Err(AppError::msg("Diarization-Modell nicht heruntergeladen"));
        }
        let loaded = Sortformer::with_config(&path, None, DiarizationConfig::callhome())
            .map_err(|e| AppError::msg(format!("Sortformer konnte nicht geladen werden: {e}")))?;
        *diarizer = Some(loaded);
    }

    let segments = diarizer
        .as_mut()
        .unwrap()
        .diarize(samples.to_vec(), SAMPLE_RATE as u32, 1)
        .map_err(|e| AppError::msg(format!("Diarization fehlgeschlagen: {e}")))?;

    Ok(segments
        .iter()
        .map(|s| {
            (
                s.speaker_id,
                s.start as f64 / SAMPLE_RATE as f64,
                s.end as f64 / SAMPLE_RATE as f64,
            )
        })
        .collect())
}

/// Assign each transcript segment the speaker with the largest time overlap.
fn assign_speakers(
    segments: &mut [TranscriptionSegment],
    speakers: &[(usize, f64, f64)],
) {
    for segment in segments.iter_mut() {
        let mut overlap_by_speaker: std::collections::HashMap<usize, f64> =
            std::collections::HashMap::new();
        for (speaker, start, end) in speakers {
            let overlap = (segment.end.min(*end) - segment.start.max(*start)).max(0.0);
            if overlap > 0.0 {
                *overlap_by_speaker.entry(*speaker).or_insert(0.0) += overlap;
            }
        }
        segment.speaker = overlap_by_speaker
            .into_iter()
            .max_by(|a, b| a.1.total_cmp(&b.1))
            .map(|(speaker, _)| speaker);
    }
}

fn run_realign(
    app: &AppHandle,
    engine: &mut Option<ParakeetTDT>,
    audio_path: &str,
    start: f64,
    end: f64,
) -> AppResult<Vec<TranscriptionWord>> {
    load_engine(app, engine)?;
    let engine = engine.as_mut().unwrap();

    let samples = load_wav(audio_path)?;
    let from = ((start * SAMPLE_RATE as f64) as usize).min(samples.len());
    let to = ((end * SAMPLE_RATE as f64) as usize).clamp(from, samples.len());
    if to - from < SAMPLE_RATE / 10 {
        return Ok(Vec::new());
    }

    transcribe_chunk(engine, &samples[from..to], start)
}

// ============================================
// Commands
// ============================================

#[tauri::command]
pub async fn transcribe(
    app: AppHandle,
    state: State<'_, AsrState>,
    audio_path: String,
    options: TranscriptionOptions,
) -> AppResult<TranscriptionResult> {
    let tx = ensure_worker(&app, &state);
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    tx.send(Job::Transcribe { audio_path, options, reply: reply_tx })
        .map_err(|_| AppError::msg("ASR-Worker nicht verfügbar"))?;
    reply_rx
        .await
        .map_err(|_| AppError::msg("ASR-Worker hat nicht geantwortet"))?
}

#[tauri::command]
pub async fn realign_segment(
    app: AppHandle,
    state: State<'_, AsrState>,
    audio_path: String,
    start: f64,
    end: f64,
) -> AppResult<Vec<TranscriptionWord>> {
    let tx = ensure_worker(&app, &state);
    let (reply_tx, reply_rx) = tokio::sync::oneshot::channel();
    tx.send(Job::Realign { audio_path, start, end, reply: reply_tx })
        .map_err(|_| AppError::msg("ASR-Worker nicht verfügbar"))?;
    reply_rx
        .await
        .map_err(|_| AppError::msg("ASR-Worker hat nicht geantwortet"))?
}

#[tauri::command]
pub async fn cancel_transcription(state: State<'_, AsrState>) -> AppResult<()> {
    state.cancel.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn model_status(app: AppHandle) -> AppResult<ModelStatus> {
    let diar_ready = diar_model_path(&app)?.exists();
    Ok(ModelStatus {
        asr_ready: asr_ready(&app),
        diarization_ready: diar_ready,
        asr_size_bytes: ASR_FILES.iter().map(|(_, s)| s).sum(),
    })
}

#[tauri::command]
pub async fn cancel_model_download(state: State<'_, AsrState>) -> AppResult<()> {
    state.download_cancel.store(true, Ordering::SeqCst);
    Ok(())
}

#[tauri::command]
pub async fn download_models(
    app: AppHandle,
    state: State<'_, AsrState>,
    include_diarization: bool,
) -> AppResult<()> {
    state.download_cancel.store(false, Ordering::SeqCst);
    let cancel = state.download_cancel.clone();

    let asr_dir = asr_model_dir(&app)?;
    std::fs::create_dir_all(&asr_dir)?;

    for (name, _) in ASR_FILES {
        let target = asr_dir.join(name);
        if target.exists() {
            continue;
        }
        download_file(
            &app,
            &cancel,
            &format!("{ASR_REPO}/{name}"),
            &target,
            "asr",
            name,
        )
        .await?;
    }

    if include_diarization {
        let diar_path = diar_model_path(&app)?;
        if !diar_path.exists() {
            std::fs::create_dir_all(diar_path.parent().unwrap())?;
            download_file(&app, &cancel, DIAR_URL, &diar_path, "diarization", DIAR_FILE).await?;
        }
    }

    Ok(())
}

async fn download_file(
    app: &AppHandle,
    cancel: &AtomicBool,
    url: &str,
    target: &PathBuf,
    model: &str,
    file: &str,
) -> AppResult<()> {
    use futures_util::StreamExt;
    use std::io::Write;

    let emit = |percent: f64, downloaded: u64, total: u64, status: &str, error: Option<String>| {
        let _ = app.emit(
            "model:download",
            ModelDownloadProgress {
                model: model.to_string(),
                file: file.to_string(),
                percent,
                downloaded_bytes: downloaded,
                total_bytes: total,
                status: status.to_string(),
                error,
            },
        );
    };

    let response = reqwest::get(url).await?;
    if !response.status().is_success() {
        let msg = format!("Download fehlgeschlagen ({}): {file}", response.status());
        emit(0.0, 0, 0, "error", Some(msg.clone()));
        return Err(AppError::msg(msg));
    }

    let total = response.content_length().unwrap_or(0);
    let part_path = target.with_extension("part");
    let mut out = std::fs::File::create(&part_path)?;
    let mut downloaded: u64 = 0;
    let mut last_emitted_percent = -1.0f64;

    let mut stream = response.bytes_stream();
    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::SeqCst) {
            drop(out);
            let _ = std::fs::remove_file(&part_path);
            emit(0.0, downloaded, total, "error", Some("Abgebrochen".into()));
            return Err(AppError::Cancelled);
        }
        let chunk = chunk?;
        out.write_all(&chunk)?;
        downloaded += chunk.len() as u64;

        let percent = if total > 0 {
            downloaded as f64 / total as f64 * 100.0
        } else {
            0.0
        };
        // Throttle events to ~0.5% steps
        if percent - last_emitted_percent >= 0.5 || downloaded == total {
            last_emitted_percent = percent;
            emit(percent, downloaded, total, "downloading", None);
        }
    }

    out.flush()?;
    drop(out);
    std::fs::rename(&part_path, target)?;
    emit(100.0, downloaded, total, "complete", None);
    Ok(())
}
