# OpenSub (Tauri)

Professional desktop subtitle editor with on-device AI transcription.
This is the Tauri 2 rewrite of OpenSub — replacing Electron + bundled Python
with a Rust backend and an in-process ONNX ASR engine.

## Architecture

```
React 19 + Tailwind 4 (WebView)  <--invoke/events-->  Rust (Tauri 2)
                                                        ├── Parakeet TDT 0.6b v3 (ONNX, in-process)
                                                        ├── Sortformer diarization (optional)
                                                        ├── FFmpeg (metadata, audio, export)
                                                        ├── SQLite (projects)
                                                        └── OpenRouter (AI correction)
```

- **ASR**: NVIDIA Parakeet TDT 0.6b v3 (int8, ~670 MB) — 25 languages with
  auto-detection, word-level timestamps, ~35x realtime on Apple Silicon CPU.
  Downloaded on first run to the app data dir; the app itself stays tiny.
- **Export**: subtitle frames are rendered pixel-perfect in Web Workers
  (OffscreenCanvas) and overlaid by FFmpeg with VideoToolbox hardware encoding.
- **Updater**: built-in via GitHub Releases (`latest.json`).

## Development

```bash
npm install
npm run tauri dev      # requires `brew install ffmpeg` for dev
```

Rust backend lives in `src-tauri/src/`:

| Module        | Purpose                                            |
| ------------- | -------------------------------------------------- |
| `asr.rs`      | Parakeet engine, model downloads, diarization      |
| `ffmpeg.rs`   | Metadata, audio extraction, waveform peaks, export |
| `projects.rs` | SQLite project persistence + thumbnails            |
| `analysis.rs` | OpenRouter/Gemini subtitle correction              |
| `fonts.rs`    | System font enumeration                            |

Smoke-test the ASR engine without the UI:

```bash
cd src-tauri
cargo run --release --example asr_smoke -- /path/to/16khz-mono.wav
```

## Release build

```bash
./scripts/download-ffmpeg.sh                 # bundle static ffmpeg/ffprobe
export TAURI_SIGNING_PRIVATE_KEY_PATH=~/.tauri/opensub-updater.key
npm run tauri build                          # DMG + updater artifacts
```

The updater private key lives outside the repo (`~/.tauri/opensub-updater.key`).
The matching public key is committed in `tauri.conf.json`.
