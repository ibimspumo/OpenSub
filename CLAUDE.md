# CLAUDE.md

This file provides context for Claude Code (and other AI assistants) working on the OpenSub codebase.

## Project Overview

OpenSub is a professional desktop subtitle editor with on-device AI transcription, built with **Tauri 2**. It provides Descript-style word-level timing precision for creating, editing, and styling subtitles with karaoke animations.

> **Repository layout during the rewrite**: The active app lives in **`app/`** (Tauri 2 + Rust + React 19). The old Electron + Python implementation remains in `src/`, `python-service/` etc. as reference only — do not extend it. All new work happens in `app/`.

**Key properties** (vs. the old Electron version):
- No bundled Python — the ASR model (NVIDIA Parakeet TDT 0.6b v3) runs **in-process in Rust** via ONNX Runtime
- App bundle is a few MB; the ASR model (~670 MB int8) downloads on first run
- ~35x realtime transcription on Apple Silicon CPU, 25 languages with auto-detection

### Tech Stack

- **Frontend**: React 19 + TypeScript + Zustand (+ zundo for undo/redo) + Tailwind CSS 4 + shadcn-style components
- **Backend**: Rust (Tauri 2), parakeet-rs (ONNX), rusqlite, reqwest
- **Media**: FFmpeg (system binary in dev, bundled static binary in production)
- **Build**: Vite 7 + Tauri CLI

### Architecture

```
React (WebView)  <-- invoke / events -->  Rust (Tauri 2)
                                           ├── asr.rs       Parakeet engine (worker thread, models cached in RAM)
                                           ├── ffmpeg.rs    metadata, audio extraction, waveform peaks, export
                                           ├── projects.rs  SQLite persistence + thumbnails
                                           ├── analysis.rs  OpenRouter/Gemini AI correction
                                           └── fonts.rs     system font enumeration
```

All frontend↔backend calls go through the typed bridge in `app/src/lib/api.ts` — components never call `invoke()` directly.

## Critical Files

### Frontend (`app/src/`)

| File | Purpose |
|------|---------|
| `lib/types.ts` | **All shared TypeScript types** — single source of truth |
| `lib/api.ts` | Typed Tauri bridge (replaces the old `window.api`) |
| `lib/settings.ts` | App settings via tauri-plugin-store (`settings.json`, also read by Rust) |
| `lib/templates.ts` | Curated style templates for the template gallery |
| `lib/styleConstants.ts` | Rendering/animation/UI constants, color presets |
| `store/projectStore.ts` | Project state + subtitles + speakers, wrapped in zundo `temporal` (undo/redo) |
| `store/uiStore.ts` | Ephemeral UI state (playback, selection, dialogs) |
| `store/styleProfileStore.ts` | Saved style profiles (localStorage persist) |
| `hooks/usePlaybackController.tsx` | RAF-based video/timeline sync (single source of truth for time) |
| `hooks/useAutoSave.ts` | 30s auto-save + unsaved-changes tracking |
| `utils/subtitleSplitter.ts` | Auto-split/merge by maxWidth/maxLines |
| `utils/subtitleFrameRenderer.ts` + `workers/frameRenderWorker.ts` + `utils/workerPool.ts` | Parallel PNG frame rendering for export |
| `utils/fontLoader.ts` | Google Fonts loading (incl. inside workers via FontFace API) |

### Key Components (`app/src/components/`)

| Component | Notes |
|-----------|-------|
| `DropZone/DropZone.tsx` | Video import — uses Tauri `onDragDropEvent` (HTML5 drop has no paths in Tauri) |
| `VideoPlayer/SubtitleCanvas.tsx` | Live karaoke preview; offscreen render at video resolution = pixel-identical to export; drag positioning with magnetic snap |
| `Timeline/Timeline.tsx` | Waveform (peaks from Rust), click-to-seek, block move + edge-drag retiming |
| `StyleEditor/` | Full style editor + `TemplateGallery.tsx` + `FontSelector.tsx` + `StyleProfileSelector.tsx` |
| `DiffPreview/` | AI-correction review; realignment via Parakeet re-transcription, Gemini fallback |
| `Setup/SetupWizard.tsx` | First-run model download (gated on `models.status().asrReady`) |
| `Updater/UpdateChecker.tsx` | Auto-update toast (GitHub Releases) |

### Backend (`app/src-tauri/src/`)

| File | Purpose |
|------|---------|
| `asr.rs` | Parakeet TDT v3: dedicated worker thread owns the engine (models stay cached), energy-based ~60s chunking, word timestamps, punctuation merged into previous word, sentence segmentation, Sortformer diarization, HF model downloads with progress |
| `ffmpeg.rs` | ffprobe metadata, 16kHz WAV extraction, MP3 for AI upload, waveform peaks (hound), frame-overlay export (concat demuxer + VideoToolbox), thumbnails, temp-file management |
| `projects.rs` | SQLite (`projects.db` in app data dir): meta columns + full project JSON blob |
| `analysis.rs` | OpenRouter chat completions with audio input; reads API key from `settings.json` store |
| `error.rs` | `AppError` — serialized as plain message strings to the frontend |
| `lib.rs` | Plugin registration + command handler list |

## Frontend↔Backend Contract

Commands (snake_case in Rust, called via `app/src/lib/api.ts`):

```
video_metadata, extract_audio, waveform_peaks, export_video, cancel_export,
save_subtitle_frames, cleanup_subtitle_frames, delete_temp_file,
read_text_file, write_text_file,
transcribe, realign_segment, cancel_transcription,
model_status, download_models, cancel_model_download,
project_save, project_load, project_list, project_delete, project_rename, project_thumbnail,
analyze_subtitles, gemini_word_timings, cancel_analysis,
list_system_fonts
```

Events (Rust → frontend via `app.emit`): `transcription:progress`, `model:download`, `export:progress`, `analysis:progress`.

**Adding a new command**: implement in the matching Rust module (return `AppResult<T>`, structs with `#[serde(rename_all = "camelCase")]`) → register in `lib.rs` `generate_handler!` → add a typed wrapper in `lib/api.ts`. Tauri auto-converts JS `camelCase` args to Rust `snake_case`.

## AI / Models

- **ASR**: `istupakov/parakeet-tdt-0.6b-v3-onnx` (int8 files) → `~/Library/Application Support/de.agent-z.opensub/models/parakeet-tdt-0.6b-v3/`
- **Diarization** (optional): Sortformer v2.1 from `altunenes/parakeet-rs` → `models/sortformer/`
- **AI correction**: OpenRouter (`google/gemini-3-flash-preview` with audio input). API key set in Settings UI, stored in `settings.json`.
- **Word realignment after AI corrections**: re-transcribe the audio window with Parakeet and borrow timings; Gemini word-timing fallback; even-distribution last resort (`DiffPreview.tsx`).

Smoke-test the engine without the UI:
```bash
cd app/src-tauri && cargo run --release --example asr_smoke -- /path/to/16khz-mono.wav
```

## Important Considerations

- **Video playback** uses Tauri's asset protocol (`mediaSrc()` in `api.ts` = `convertFileSrc`); range requests are supported natively. Scope is `**` in `tauri.conf.json`.
- **Drag & drop**: must use `getCurrentWebview().onDragDropEvent()` — HTML5 drop events carry no file paths in Tauri.
- **WKWebView rendering quirk**: large `filter: blur()` layers get clipped to a hard rectangle after transitions. Use radial gradients or box-shadows for glows instead.
- **Font sizes are in video pixels**. Default is 50px anchored at FHD (`getDefaultFontSizeForResolution`: 4K → 100px, 720p → 33px). Style templates intentionally do **not** override `fontSize`; `updateStyle` ignores `undefined` values.
- **Undo/redo**: only `project` participates (zundo temporal, limit 100). History is cleared on project create/load/transcription. Slider components commit on release so drags are single undo steps.
- **Export pipeline**: Web Workers render PNG frames (OffscreenCanvas) → base64 → `save_subtitle_frames` writes them + `manifest.json` → `export_video` overlays via FFmpeg concat demuxer. Preview and export share the same rendering code paths — keep `SubtitleCanvas` and `frameRenderWorker` render functions in sync when changing rendering.
- **Rust pinning**: `time` crate is pinned to 0.3.47 (0.3.48 fails to compile with Rust 1.95).
- **Updater**: public key in `tauri.conf.json`, private key at `~/.tauri/opensub-updater.key` (never commit). Endpoint: GitHub Releases `latest.json`. Release builds need `TAURI_SIGNING_PRIVATE_KEY_PATH` set.

## Development Commands

```bash
cd app
npm install
npm run tauri dev        # dev (needs `brew install ffmpeg`)
npx tsc --noEmit         # frontend typecheck
npm run build            # frontend production build
(cd src-tauri && cargo check)   # backend check

# Release
./scripts/download-ffmpeg.sh    # bundle static ffmpeg/ffprobe into src-tauri/binaries/
TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/opensub-updater.key npm run tauri build
```

## Code Style Guidelines

- **TypeScript**: function components only, strict mode, named exports for types / default exports for components, `@/` path alias, import order: react → stores → types → local.
- **Styling**: Tailwind 4 design tokens defined in `app/src/index.css` (`@theme inline`). Dark-only app. Brand accent: neon green `#BDFF01` (`--primary`). No inline styles except for dynamic values (positions, computed colors).
- **Rust**: commands return `AppResult<T>`; user-facing error messages in German; serde camelCase on all IPC structs; long-running work on threads/async with cancel flags + progress events.
- **i18n**: every UI string via `react-i18next`; add keys to **both** `app/src/i18n/locales/de.json` and `en.json`. German is the default language.
- **Git**: Conventional Commits (`feat:`, `fix:`, `refactor:`, ...).

## Data Flow: Transcription

```
DropZone drop/select
  → ffmpeg.getMetadata() → setVideoMetadata (computes default font size)
  → ffmpeg.extractAudio() (16kHz mono WAV, kept for waveform/AI/realign)
  → transcription.transcribe(audioPath, { language?, diarize? })
      Rust: load WAV → chunk at quiet points → Parakeet per chunk (word timestamps)
            → merge punctuation tokens → sentence segmentation → optional diarization
  → setTranscriptionResult: segments → Subtitles (+ speakers), auto-split by style
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| `ffmpeg nicht gefunden` in dev | `brew install ffmpeg` |
| Transcription error "Modell nicht heruntergeladen" | Setup wizard should appear; models live under `~/Library/Application Support/de.agent-z.opensub/models/` |
| Rust build fails in `time`/`cookie` | `cargo update time --precise 0.3.47` |
| Video won't play | Asset protocol scope in `tauri.conf.json`; path must be absolute |
| Glow/blur effects clipped | WKWebView issue — use radial gradients, not `filter: blur()` |
| Fonts wrong in export but right in preview | Worker font loading (`frameRenderWorker.ts` fetches woff2 itself); check `ensureFontWeightLoaded` |
