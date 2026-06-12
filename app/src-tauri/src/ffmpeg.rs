//! FFmpeg integration: metadata, audio extraction, waveform peaks,
//! frame-overlay export and thumbnails.
//!
//! Dev builds use the system ffmpeg (homebrew); production bundles the
//! binaries as Tauri sidecar resources under `binaries/`.

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, Manager, State};

use crate::error::{AppError, AppResult};

// ============================================
// State
// ============================================

#[derive(Default)]
pub struct FfmpegState {
    /// Currently running export process (for cancellation)
    pub current_export: Mutex<Option<Child>>,
}

// ============================================
// Types
// ============================================

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    pub duration: f64,
    pub width: u32,
    pub height: u32,
    pub fps: f64,
    pub codec: String,
    pub audio_codec: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportOptions {
    pub output_path: String,
    pub quality: String,
    pub target_width: u32,
    pub target_height: u32,
    pub frame_dir: String,
    /// Sent by the frontend for completeness; timing comes from the manifest
    #[allow(dead_code)]
    pub fps: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportProgress {
    pub percent: f64,
    pub fps: f64,
    pub time: f64,
    pub stage: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameManifestEntry {
    pub index: usize,
    pub start_time: f64,
    pub end_time: f64,
    pub filename: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameManifest {
    pub fps: f64,
    pub frames: Vec<FrameManifestEntry>,
}

// ============================================
// Binary resolution
// ============================================

fn locate_binary(app: &AppHandle, name: &str) -> AppResult<PathBuf> {
    // 1. Bundled sidecar in resources (production)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let bundled = resource_dir.join("binaries").join(name);
        if bundled.exists() {
            return Ok(bundled);
        }
    }

    // 2. Common system locations (development)
    for prefix in ["/opt/homebrew/bin", "/usr/local/bin", "/usr/bin"] {
        let p = Path::new(prefix).join(name);
        if p.exists() {
            return Ok(p);
        }
    }

    // 3. PATH lookup
    if let Ok(output) = Command::new("which").arg(name).output() {
        if output.status.success() {
            let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
            if !path.is_empty() {
                return Ok(PathBuf::from(path));
            }
        }
    }

    Err(AppError::msg(format!(
        "{name} nicht gefunden. In der Entwicklung: `brew install ffmpeg`."
    )))
}

pub fn ffmpeg_path(app: &AppHandle) -> AppResult<PathBuf> {
    locate_binary(app, "ffmpeg")
}

pub fn ffprobe_path(app: &AppHandle) -> AppResult<PathBuf> {
    locate_binary(app, "ffprobe")
}

/// Check (once) whether VideoToolbox hardware encoding is available.
fn has_videotoolbox(app: &AppHandle) -> bool {
    use std::sync::OnceLock;
    static AVAILABLE: OnceLock<bool> = OnceLock::new();
    *AVAILABLE.get_or_init(|| {
        ffmpeg_path(app)
            .ok()
            .and_then(|p| Command::new(p).arg("-encoders").output().ok())
            .map(|out| String::from_utf8_lossy(&out.stdout).contains("h264_videotoolbox"))
            .unwrap_or(false)
    })
}

/// App-scoped temp directory for audio files and frame dirs.
pub fn temp_dir() -> AppResult<PathBuf> {
    let dir = std::env::temp_dir().join("opensub");
    std::fs::create_dir_all(&dir)?;
    Ok(dir)
}

fn run_checked(mut cmd: Command, what: &str) -> AppResult<()> {
    let output = cmd.output()?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let tail: String = stderr
            .lines()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(AppError::msg(format!("{what} fehlgeschlagen: {tail}")));
    }
    Ok(())
}

// ============================================
// Commands
// ============================================

#[tauri::command]
pub async fn video_metadata(app: AppHandle, video_path: String) -> AppResult<VideoMetadata> {
    let ffprobe = ffprobe_path(&app)?;

    let output = Command::new(ffprobe)
        .args([
            "-v", "error",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            &video_path,
        ])
        .output()?;

    if !output.status.success() {
        return Err(AppError::msg("Video-Metadaten konnten nicht gelesen werden"));
    }

    let json: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    let streams = json["streams"].as_array().cloned().unwrap_or_default();

    let video_stream = streams
        .iter()
        .find(|s| s["codec_type"] == "video")
        .ok_or_else(|| AppError::msg("Kein Video-Stream gefunden"))?;
    let audio_stream = streams.iter().find(|s| s["codec_type"] == "audio");

    let mut fps = 30.0;
    if let Some(rate) = video_stream["r_frame_rate"].as_str() {
        let parts: Vec<f64> = rate.split('/').filter_map(|p| p.parse().ok()).collect();
        if parts.len() == 2 && parts[1] != 0.0 {
            fps = parts[0] / parts[1];
        } else if parts.len() == 1 {
            fps = parts[0];
        }
    }

    Ok(VideoMetadata {
        duration: json["format"]["duration"]
            .as_str()
            .and_then(|d| d.parse().ok())
            .unwrap_or(0.0),
        width: video_stream["width"].as_u64().unwrap_or(1920) as u32,
        height: video_stream["height"].as_u64().unwrap_or(1080) as u32,
        fps,
        codec: video_stream["codec_name"].as_str().unwrap_or("unknown").to_string(),
        audio_codec: audio_stream
            .and_then(|s| s["codec_name"].as_str())
            .unwrap_or("unknown")
            .to_string(),
    })
}

#[tauri::command]
pub async fn extract_audio(app: AppHandle, video_path: String) -> AppResult<String> {
    let ffmpeg = ffmpeg_path(&app)?;
    let out = temp_dir()?.join(format!("opensub_audio_{}.wav", uuid::Uuid::new_v4()));

    let mut cmd = Command::new(ffmpeg);
    cmd.args([
        "-i", &video_path,
        "-vn",
        "-acodec", "pcm_s16le",
        "-ar", "16000",
        "-ac", "1",
        "-y",
    ])
    .arg(&out);

    run_checked(cmd, "Audio-Extraktion")?;
    Ok(out.to_string_lossy().to_string())
}

/// Extract compressed mono MP3 for AI analysis uploads.
pub fn extract_audio_mp3(app: &AppHandle, video_path: &str) -> AppResult<PathBuf> {
    let ffmpeg = ffmpeg_path(app)?;
    let out = temp_dir()?.join(format!("opensub_analysis_{}.mp3", uuid::Uuid::new_v4()));

    let mut cmd = Command::new(ffmpeg);
    cmd.args([
        "-i", video_path,
        "-vn",
        "-acodec", "libmp3lame",
        "-b:a", "128k",
        "-ar", "44100",
        "-ac", "1",
        "-y",
    ])
    .arg(&out);

    run_checked(cmd, "MP3-Extraktion")?;
    Ok(out)
}

/// Compute waveform peaks from a 16 kHz mono WAV.
/// Returns interleaved [min, max] pairs, `samples_per_second` buckets per second.
#[tauri::command]
pub async fn waveform_peaks(audio_path: String, samples_per_second: u32) -> AppResult<Vec<f32>> {
    let mut reader = hound::WavReader::open(&audio_path)
        .map_err(|e| AppError::msg(format!("WAV konnte nicht gelesen werden: {e}")))?;
    let spec = reader.spec();
    let bucket_size = (spec.sample_rate / samples_per_second.max(1)).max(1) as usize;

    let mut peaks: Vec<f32> = Vec::new();
    let mut min = f32::MAX;
    let mut max = f32::MIN;
    let mut count = 0usize;

    for sample in reader.samples::<i16>() {
        let v = sample.unwrap_or(0) as f32 / i16::MAX as f32;
        if v < min {
            min = v;
        }
        if v > max {
            max = v;
        }
        count += 1;
        if count >= bucket_size {
            peaks.push(min);
            peaks.push(max);
            min = f32::MAX;
            max = f32::MIN;
            count = 0;
        }
    }
    if count > 0 {
        peaks.push(min);
        peaks.push(max);
    }

    Ok(peaks)
}

#[tauri::command]
pub async fn export_video(
    app: AppHandle,
    state: State<'_, FfmpegState>,
    video_path: String,
    options: ExportOptions,
) -> AppResult<String> {
    let ffmpeg = ffmpeg_path(&app)?;
    let frame_dir = PathBuf::from(&options.frame_dir);

    // Read the frame manifest written by save_subtitle_frames
    let manifest_path = frame_dir.join("manifest.json");
    let manifest: FrameManifest = serde_json::from_str(&std::fs::read_to_string(&manifest_path)?)?;
    if manifest.frames.is_empty() {
        return Err(AppError::msg("Keine Untertitel-Frames zum Überlagern"));
    }

    // Total duration for progress calculation
    let duration = video_metadata(app.clone(), video_path.clone()).await?.duration;

    // Build concat demuxer file describing how long each frame is shown
    let mut concat = String::new();
    for frame in &manifest.frames {
        let path = frame_dir.join(&frame.filename);
        let escaped = path.to_string_lossy().replace('\'', "'\\''");
        concat.push_str(&format!(
            "file '{}'\nduration {:.6}\n",
            escaped,
            frame.end_time - frame.start_time
        ));
    }
    // Concat demuxer requires the last file repeated
    let last = manifest.frames.last().unwrap();
    let last_path = frame_dir.join(&last.filename);
    concat.push_str(&format!(
        "file '{}'\n",
        last_path.to_string_lossy().replace('\'', "'\\''")
    ));
    let concat_path = frame_dir.join("concat.txt");
    std::fs::write(&concat_path, concat)?;

    let first_start = manifest.frames[0].start_time;
    let last_end = last.end_time;

    let filter_complex = format!(
        "[0:v]scale={w}:{h}[scaled];[1:v]setpts=PTS+{start}/TB[sub];[scaled][sub]overlay=0:0:enable='between(t,{start},{end})'",
        w = options.target_width,
        h = options.target_height,
        start = first_start,
        end = last_end
    );

    let mut cmd = Command::new(ffmpeg);
    cmd.args(["-i", &video_path])
        .args(["-f", "concat", "-safe", "0", "-i"])
        .arg(&concat_path)
        .args(["-filter_complex", &filter_complex]);

    if has_videotoolbox(&app) {
        let quality_multiplier: f64 = match options.quality.as_str() {
            "high" => 1.0,
            "medium" => 0.65,
            _ => 0.4,
        };
        let bitrate = (50.0 * quality_multiplier).round() as u32;
        cmd.args(["-c:v", "h264_videotoolbox"])
            .args(["-b:v", &format!("{bitrate}M")])
            .args(["-maxrate", &format!("{}M", (bitrate as f64 * 1.5).round() as u32)])
            .args(["-bufsize", &format!("{}M", bitrate * 2)])
            .args(["-profile:v", "high"])
            .args(["-level", "5.2"])
            .args(["-allow_sw", "1"])
            .args(["-realtime", "0"])
            .args(["-c:a", "aac_at"])
            .args(["-b:a", "256k"]);
    } else {
        let (crf, preset) = match options.quality.as_str() {
            "high" => ("18", "slow"),
            "medium" => ("23", "medium"),
            _ => ("28", "fast"),
        };
        cmd.args(["-c:v", "libx264"])
            .args(["-crf", crf])
            .args(["-preset", preset])
            .args(["-c:a", "aac"])
            .args(["-b:a", "192k"]);
    }

    cmd.args(["-progress", "pipe:1", "-y"])
        .arg(&options.output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = cmd.spawn()?;
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();

    // Register process for cancellation
    *state.current_export.lock().unwrap() = Some(child);

    // Collect stderr in a thread for error reporting
    let stderr_handle = std::thread::spawn(move || {
        let mut buf = String::new();
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            buf.push_str(&line);
            buf.push('\n');
            if buf.len() > 8192 {
                let cut = buf.len() - 8192;
                buf.drain(..cut);
            }
        }
        buf
    });

    // Parse -progress key=value output and emit events
    let app_clone = app.clone();
    let mut current_fps = 0.0f64;
    for line in BufReader::new(stdout).lines().map_while(Result::ok) {
        if let Some((key, value)) = line.split_once('=') {
            match key {
                "fps" => current_fps = value.trim().parse().unwrap_or(0.0),
                "out_time_us" | "out_time_ms" => {
                    if let Ok(us) = value.trim().parse::<f64>() {
                        let time = us / 1_000_000.0;
                        let percent = if duration > 0.0 {
                            (time / duration * 100.0).clamp(0.0, 100.0)
                        } else {
                            0.0
                        };
                        let _ = app_clone.emit(
                            "export:progress",
                            ExportProgress {
                                percent,
                                fps: current_fps,
                                time,
                                stage: "encoding".into(),
                            },
                        );
                    }
                }
                _ => {}
            }
        }
    }

    // Wait for the process to finish (unless it was taken by cancel)
    let status = {
        let mut guard = state.current_export.lock().unwrap();
        match guard.take() {
            Some(mut child) => child.wait()?,
            None => return Err(AppError::Cancelled),
        }
    };

    let stderr_output = stderr_handle.join().unwrap_or_default();
    if !status.success() {
        let tail: String = stderr_output
            .lines()
            .rev()
            .take(6)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect::<Vec<_>>()
            .join("\n");
        return Err(AppError::msg(format!("Export fehlgeschlagen: {tail}")));
    }

    let _ = app.emit(
        "export:progress",
        ExportProgress {
            percent: 100.0,
            fps: 0.0,
            time: duration,
            stage: "complete".into(),
        },
    );

    Ok(options.output_path)
}

#[tauri::command]
pub async fn cancel_export(state: State<'_, FfmpegState>) -> AppResult<()> {
    if let Some(mut child) = state.current_export.lock().unwrap().take() {
        let _ = child.kill();
    }
    Ok(())
}

/// Generate a 320px-wide thumbnail for the project browser.
pub fn generate_thumbnail(app: &AppHandle, video_path: &str, output: &Path) -> AppResult<()> {
    let ffmpeg = ffmpeg_path(app)?;
    let mut cmd = Command::new(ffmpeg);
    cmd.args(["-ss", "1", "-i", video_path])
        .args(["-frames:v", "1", "-vf", "scale=320:-2", "-y"])
        .arg(output);
    run_checked(cmd, "Thumbnail-Erstellung")
}

// ============================================
// Subtitle frame persistence (for export)
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubtitleFrame {
    pub index: usize,
    pub start_time: f64,
    pub end_time: f64,
    /// Base64-encoded PNG (no data-URL prefix)
    pub data: String,
}

#[tauri::command]
pub async fn save_subtitle_frames(frames: Vec<SubtitleFrame>, fps: f64) -> AppResult<String> {
    use base64::Engine;

    let dir = temp_dir()?.join(format!("opensub_frames_{}", uuid::Uuid::new_v4()));
    std::fs::create_dir_all(&dir)?;

    let mut manifest = FrameManifest { fps, frames: Vec::with_capacity(frames.len()) };

    for frame in &frames {
        let filename = format!("frame_{:06}.png", frame.index);
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(&frame.data)
            .map_err(|e| AppError::msg(format!("Ungültige Frame-Daten: {e}")))?;
        std::fs::write(dir.join(&filename), bytes)?;
        manifest.frames.push(FrameManifestEntry {
            index: frame.index,
            start_time: frame.start_time,
            end_time: frame.end_time,
            filename,
        });
    }

    std::fs::write(dir.join("manifest.json"), serde_json::to_string(&manifest)?)?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn cleanup_subtitle_frames(frame_dir: String) -> AppResult<()> {
    let dir = PathBuf::from(&frame_dir);
    // Safety: only delete directories we created inside our temp dir
    if dir.starts_with(temp_dir()?) && dir.exists() {
        std::fs::remove_dir_all(dir)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn delete_temp_file(path: String) -> AppResult<()> {
    let p = PathBuf::from(&path);
    if p.starts_with(temp_dir()?) && p.exists() {
        std::fs::remove_file(p)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn read_text_file(path: String) -> AppResult<String> {
    Ok(std::fs::read_to_string(path)?)
}

#[tauri::command]
pub async fn write_text_file(path: String, contents: String) -> AppResult<()> {
    std::fs::write(path, contents)?;
    Ok(())
}
