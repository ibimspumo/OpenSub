# OpenSub

A professional desktop subtitle editor with AI-powered transcription. Create, edit, and style subtitles with word-level timing precision — Descript-style editing for everyone.

![Platform](https://img.shields.io/badge/Platform-macOS-blue)
![License](https://img.shields.io/badge/License-MIT-green)
![Electron](https://img.shields.io/badge/Electron-28-47848F)
![Version](https://img.shields.io/badge/Version-0.2.1-orange)

<p align="center">
  <strong>Standalone App — No Python or FFmpeg Installation Required</strong>
</p>

---

## What is OpenSub?

OpenSub is a macOS desktop application that uses AI-powered speech recognition to automatically generate subtitles from video files. The app uses WhisperX (based on OpenAI's Whisper) and is optimized for Apple Silicon Macs (M1/M2/M3/M4).

### The Workflow

1. **Import Video** — Drag and drop any video file into the app
2. **Automatic Transcription** — WhisperX transcribes speech with precise word-level timing
3. **Edit Subtitles** — Correct text, adjust timing, and customize styling
4. **Export** — Save as subtitle file (ASS/SRT) or burn directly into video

---

## Features

### AI-Powered Transcription

- **WhisperX Integration** — State-of-the-art speech recognition based on OpenAI's Whisper
- **Word-Level Timing** — Precise timestamps for every single word (karaoke-ready)
- **Speaker Diarization** — Automatic identification of different speakers (via pyannote.audio)
- **Multilingual Support** — Over 99 languages supported
- **GPU Accelerated** — Optimized for Apple Silicon with Metal Performance Shaders (MPS)

### Professional Subtitle Editing

- **Visual Timeline** — Waveform display for precise timing adjustments
- **Drag & Drop** — Simply drag a video to get started
- **Real-Time Preview** — Subtitles are rendered live on the video
- **Segment Editing** — Split, merge, and adjust subtitle segments

### Advanced Styling

- **Typography Control** — Full control over fonts, sizes, and colors
- **Karaoke Animation** — Word-by-word highlighting synchronized with speech
- **Multiple Animations** — Karaoke, fade-in, appear, scale effects
- **Free Positioning** — Place subtitles anywhere with magnetic guides
- **Text Effects** — Outlines, shadows, and backgrounds for better readability

### Export Options

- **ASS Format** — Advanced SubStation Alpha with full styling support
- **SRT Format** — Universal compatibility with all players
- **Burned-In Subtitles** — Render subtitles directly into the video via FFmpeg

---

## System Requirements

### Supported Systems

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **Operating System** | macOS 12 (Monterey) | macOS 13+ (Ventura/Sonoma/Sequoia) |
| **Processor** | Intel Mac | Apple Silicon (M1/M2/M3/M4) |
| **Memory** | 8 GB RAM | 16 GB RAM or more |
| **Disk Space** | 10 GB free | 20 GB free (for AI models) |

> **Note**: Intel Macs are supported, but transcription runs on CPU only and is significantly slower. Apple Silicon Macs use GPU acceleration for up to 3x faster processing.

---

## Installation

### Standalone App (Recommended)

OpenSub is distributed as a **fully standalone application** — no external dependencies required. Python, FFmpeg, PyTorch, and all AI models are bundled directly into the app.

1. **Download** the latest release from [GitHub Releases](https://github.com/ibimspumo/OpenSub/releases)
2. **Open** the `.dmg` file
3. **Drag** OpenSub to your Applications folder
4. **Launch** OpenSub from Applications

> **First Launch Note**: On first run, macOS may show a security warning since the app is not notarized. Right-click the app and select "Open" to bypass this, or go to **System Settings → Privacy & Security** and click "Open Anyway".

### What's Included

The standalone build bundles everything you need:

| Component | Version | Purpose |
|-----------|---------|---------|
| **Python** | 3.12 | Runtime for AI services |
| **PyTorch** | 2.x | Machine learning framework |
| **WhisperX** | Latest | Speech recognition engine |
| **FFmpeg** | 6.x | Video/audio processing |
| **AI Models** | Downloaded on first use | Whisper model files |

### First Transcription

When you run your first transcription, OpenSub will automatically download the required AI models (~1-3 GB depending on model size). This is a one-time download stored in the app's data directory.

**Model sizes:**
- `tiny` — ~75 MB (fastest, lower accuracy)
- `base` — ~150 MB
- `small` — ~500 MB
- `medium` — ~1.5 GB
- `large-v3` — ~3 GB (most accurate, recommended)

---

## Development Setup

Want to contribute or build from source? Follow these steps to set up the development environment.

### Prerequisites

- **macOS** 12 (Monterey) or later
- **Node.js** 18+ and npm
- **Git**
- **Xcode Command Line Tools** (`xcode-select --install`)

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/ibimspumo/OpenSub.git
cd OpenSub

# Install Node.js dependencies
npm install
```

### Development Mode

For rapid development with hot-reload:

```bash
npm run dev
```

This starts Electron in development mode with:
- Hot module replacement for the renderer process
- Automatic restart on main process changes
- Source maps for debugging

### Building for Production

#### Quick Build (Development Testing)

```bash
# Build without setting up the bundled Python environment
npm run dist:unsigned
```

#### Full Standalone Build

To create a distributable `.dmg` with all dependencies bundled:

```bash
# Download portable Python and set up the AI environment
npm run setup:python

# Build the complete standalone app
npm run dist
```

The `setup:python` script:
1. Downloads a standalone Python 3.12 build (~50 MB)
2. Creates a virtual environment in `build-resources/python-env`
3. Installs WhisperX, PyTorch, MLX, and all AI dependencies (~2-3 GB)

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server with hot-reload |
| `npm run build` | Build the app without packaging |
| `npm run build:mac` | Build and package for macOS |
| `npm run dist` | Full standalone build (with Python) |
| `npm run dist:unsigned` | Build without Python bundling (for testing) |
| `npm run setup:python` | Download Python and install AI dependencies |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run test` | Run Playwright tests |
| `npm run test:ui` | Run tests with Playwright UI |

### Project Structure

```
OpenSub/
├── src/
│   ├── main/           # Electron main process
│   │   ├── services/   # Core services (FFmpeg, Python, etc.)
│   │   └── ipc/        # IPC handlers for renderer communication
│   ├── renderer/       # React frontend
│   │   ├── components/ # UI components
│   │   ├── store/      # Zustand state management
│   │   └── i18n/       # Internationalization
│   ├── preload/        # Electron preload scripts
│   └── shared/         # Shared types and utilities
├── python-service/     # Python AI service
│   ├── whisper_service/# WhisperX transcription
│   └── requirements.txt
├── scripts/            # Build and setup scripts
├── resources/          # App icons and assets
└── build-resources/    # Python environment (generated)
```

### Python Environment Details

The AI transcription runs as a separate Python process managed by Electron. For development:

- **Local Python**: You can use your system Python with a virtual environment
- **Bundled Python**: The `npm run setup:python` creates a portable Python installation

To set up a local development environment with your system Python:

```bash
cd python-service
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

> **Note**: The bundled Python is required for distribution builds but not for development.

---

## Architecture

OpenSub follows a multi-process architecture with clear separation of concerns:

```
┌─────────────────────────────────────────────────────────────────┐
│                         Electron App                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Main Process  │  Renderer (UI)  │     Python Service          │
│   (Node.js)     │  (React)        │     (WhisperX-MLX)          │
├─────────────────┼─────────────────┼─────────────────────────────┤
│ • IPC handlers  │ • React 18      │ • WhisperX transcription    │
│ • FFmpeg        │ • Zustand state │ • MLX Metal backend         │
│ • File I/O      │ • Tailwind CSS  │ • Word-level alignment      │
│ • SQLite DB     │ • Video player  │ • JSON-RPC communication    │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Process Architecture

#### Main Process (`src/main/`)

The Electron main process handles all system-level operations:

| Service | File | Purpose |
|---------|------|---------|
| **WhisperService** | `services/WhisperService.ts` | Spawns and manages the Python transcription process |
| **FFmpegService** | `services/FFmpegService.ts` | Video/audio processing, export with burned-in subtitles |
| **ProjectDatabase** | `services/ProjectDatabase.ts` | SQLite persistence for projects and settings |
| **OpenRouterService** | `services/OpenRouterService.ts` | AI-powered subtitle correction via Gemini API |
| **ModelManager** | `services/ModelManager.ts` | Whisper model download and selection |

#### Renderer Process (`src/renderer/`)

The UI is built with React 18 and uses Zustand for state management:

| Store | Purpose |
|-------|---------|
| **projectStore** | Current project, subtitles, video metadata |
| **styleProfileStore** | Saved style presets, import/export |
| **uiStore** | UI state, dialogs, loading indicators |

Key components:
- **VideoPlayer** — HTML5 video with custom controls and subtitle overlay
- **Timeline** — Waveform display with draggable subtitle segments
- **SubtitleEditor** — Text editing with word-level timing
- **StylePanel** — Typography, colors, animations, karaoke effects

#### Python Service (`python-service/`)

The AI transcription runs in a separate Python process:

```
Electron Main ←──JSON-RPC over stdio──→ Python Service
                                              │
                                              ├── WhisperX-MLX (transcription)
                                              ├── PyTorch (model runtime)
                                              └── MLX (Metal GPU acceleration)
```

- **Communication**: JSON-RPC 2.0 over stdin/stdout
- **Model**: WhisperX with MLX backend for Apple Silicon
- **Alignment**: Word-level timestamps via forced alignment

### IPC Communication

The main and renderer processes communicate via Electron IPC:

```typescript
// Renderer → Main (invoke)
const result = await window.api.whisper.transcribe(audioPath, options)

// Main → Renderer (events)
mainWindow.webContents.send('whisper:progress', { percent: 50, stage: 'transcribing' })
```

IPC channels are defined in `src/shared/types.ts` (`IPC_CHANNELS`).

### Data Flow: Transcription

1. **User drops video** → Renderer sends `ffmpeg:extract-audio`
2. **Audio extracted** → Renderer sends `whisper:transcribe`
3. **Main process** → Spawns/reuses Python service
4. **Python service** → Runs WhisperX with MLX backend
5. **Progress events** → Streamed back via `whisper:progress`
6. **Result** → Word-level timestamps stored in project state

### Data Flow: Export

1. **User clicks Export** → Opens export dialog
2. **Subtitle frames rendered** → Canvas API generates PNG frames
3. **Frames saved** → Main process writes to temp directory
4. **FFmpeg overlay** → Frames composited onto video
5. **Output** → MP4 with burned-in subtitles

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React 18, TypeScript, Zustand | UI components and state |
| **Styling** | Tailwind CSS, Radix UI | Design system |
| **Desktop** | Electron 28 | Native app container |
| **Build** | electron-vite, Vite | Fast bundling |
| **Video** | FFmpeg, fluent-ffmpeg | Media processing |
| **AI/ML** | WhisperX, PyTorch | Speech recognition |
| **Database** | better-sqlite3 | Project persistence |

---

## Keyboard Shortcuts

| Key | Function |
|-----|----------|
| `Space` | Play/Pause |
| `←` / `→` | Skip 5 seconds back/forward |
| `Cmd + O` | Open video |
| `Cmd + S` | Save project |
| `Enter` | Confirm subtitle edit |
| `Escape` | Cancel edit |

---

## Supported Formats

**Video Import:** MP4, MOV, AVI, MKV, WebM, M4V

**Export:**
- **ASS** — Full style support, recommended for media players
- **SRT** — Universal compatibility
- **MP4** — Video with burned-in subtitles

---

## Contributing

Contributions are welcome! Whether you're fixing bugs, adding features, improving documentation, or translating the UI — your help is appreciated.

### How to Contribute

1. **Fork** the repository
2. **Create a branch** for your feature or fix: `git checkout -b feature/your-feature-name`
3. **Make your changes** following the code style guidelines below
4. **Test** your changes: `npm run typecheck && npm run lint`
5. **Commit** with a clear message describing what you changed
6. **Push** to your fork and open a **Pull Request**

### Code Style

- **TypeScript** — Use strict typing, avoid `any` when possible
- **React** — Functional components with hooks, no class components
- **Naming** — camelCase for variables/functions, PascalCase for components/types
- **Formatting** — Run `npm run lint` before committing

### Good First Issues

New to the project? Look for issues labeled [`good first issue`](https://github.com/ibimspumo/OpenSub/labels/good%20first%20issue) — these are smaller tasks that are great for getting familiar with the codebase.

### Reporting Bugs

Found a bug? Please [open an issue](https://github.com/ibimspumo/OpenSub/issues/new) with:
- A clear description of the problem
- Steps to reproduce
- Expected vs. actual behavior
- Your macOS version and hardware (Intel/Apple Silicon)

### Feature Requests

Have an idea? Open an issue with the `enhancement` label. Describe the feature and why it would be useful.

---

## License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

### What This Means

- ✅ **Free to use** — Use OpenSub for personal or commercial projects
- ✅ **Free to modify** — Fork it, customize it, make it your own
- ✅ **Free to distribute** — Share your modified versions
- ⚠️ **No warranty** — Provided "as is" without guarantees

### Third-Party Licenses

OpenSub uses several open-source projects:

| Project | License | Purpose |
|---------|---------|---------|
| [Electron](https://www.electronjs.org) | MIT | Desktop app framework |
| [React](https://react.dev) | MIT | UI library |
| [WhisperX](https://github.com/m-bain/whisperX) | BSD-2-Clause | Speech recognition |
| [PyTorch](https://pytorch.org) | BSD-3-Clause | Machine learning |
| [FFmpeg](https://ffmpeg.org) | LGPL/GPL | Media processing |

---

## Resources

- [WhisperX GitHub](https://github.com/m-bain/whisperX) — Transcription engine
- [Electron Documentation](https://www.electronjs.org/docs) — Desktop framework
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html) — Video processing
- [HuggingFace](https://huggingface.co) — AI models

---

<p align="center">
  Built with Electron, React, and WhisperX<br>
  Optimized for Apple Silicon
</p>
