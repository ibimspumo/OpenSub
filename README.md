# OpenSub

A professional desktop subtitle editor with on-device AI transcription. Create, edit, and style subtitles with word-level timing precision — Descript-style editing for everyone.

![Platform](https://img.shields.io/badge/Platform-macOS-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Tauri](https://img.shields.io/badge/Tauri-2-FFC131)
![Rust](https://img.shields.io/badge/Backend-Rust-DEA584)
![Version](https://img.shields.io/badge/Version-1.0.0-orange)

> **Built with AI** — This entire application was developed using [Claude Code](https://claude.ai/claude-code), Anthropic's AI coding assistant. From architecture decisions to implementation details, every line of code was written collaboratively with AI.

<p align="center">
  <strong>Tiny app, fully on-device AI — no Python, no cloud transcription</strong>
</p>

---

## What is OpenSub?

OpenSub is a macOS desktop app that automatically generates word-precise subtitles from video files and lets you style them like the big creator tools (karaoke highlights, boxes, glows) — then burns them pixel-perfectly into the video.

Since the **Tauri rewrite (v1.0)**, transcription runs on **NVIDIA Parakeet TDT 0.6b v3** directly inside the Rust backend via ONNX — roughly **35x realtime on Apple Silicon**, supporting **25 languages with automatic detection**. The app bundle is a few megabytes; the AI model (~670 MB) is downloaded once on first launch.

### The Workflow

1. **Import** — drag & drop any video
2. **Transcribe** — Parakeet generates word-level timestamps in seconds
3. **Edit** — fix text inline, retime on the waveform timeline, undo/redo everything
4. **Style** — templates, fonts, karaoke box/glow, drag-positioning with snap guides
5. **Export** — hardware-encoded MP4 with pixel-perfect burned-in subtitles

## Features

- ⚡ **Fast on-device ASR** — Parakeet TDT v3 (ONNX, int8), 25 languages, auto-detect
- 🎤 **Speaker diarization** (optional) — color subtitles per speaker
- 🌊 **Waveform timeline** — click-to-seek, drag blocks, retime via edge handles
- ↩️ **Full undo/redo** across all edits
- 🎨 **Template gallery** + style profiles (save/import/export)
- ✨ **AI correction** — Gemini (via OpenRouter) listens to the audio and proposes fixes with a reviewable diff
- 🎬 **Pixel-perfect export** — preview and export share the same renderer; VideoToolbox hardware encoding
- 🔄 **Auto-updates** via GitHub Releases
- 🌍 **German & English UI**

## Development

```bash
git clone https://github.com/ibimspumo/OpenSub.git
cd OpenSub/app
npm install
npm run tauri dev        # requires: Rust toolchain + `brew install ffmpeg`
```

See [`app/README.md`](app/README.md) for architecture details and release builds, and [`CLAUDE.md`](CLAUDE.md) for the full codebase guide.

> The legacy Electron + Python implementation (v0.3.x) lives in `src/` and `python-service/` for reference during the transition and will be removed once the Tauri version ships.

## License

MIT
