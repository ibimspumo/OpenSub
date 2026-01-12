# OpenSub

A professional desktop subtitle editor with AI-powered transcription. Create, edit, and style subtitles with word-level timing precision, similar to Descript.

![OpenSub Editor](https://img.shields.io/badge/Platform-macOS-blue) ![License](https://img.shields.io/badge/License-MIT-green) ![Electron](https://img.shields.io/badge/Electron-28-47848F)

## Features

### AI-Powered Transcription
- **WhisperX Integration** - State-of-the-art speech recognition using OpenAI's Whisper model
- **Word-Level Timing** - Precise word timestamps for karaoke-style animations
- **Speaker Diarization** - Automatic speaker identification using pyannote.audio
- **Multi-Language Support** - Transcribe content in multiple languages
- **Apple Silicon Optimized** - GPU acceleration via Metal Performance Shaders (MPS)

### Professional Subtitle Editing
- **Visual Timeline** - Waveform visualization with WaveSurfer.js for precise editing
- **Drag-and-Drop Interface** - Simply drop your video file to get started
- **Real-Time Preview** - See subtitles rendered on video as you edit
- **Segment Editing** - Split, merge, and adjust subtitle timing with ease

### Advanced Styling
- **Custom Fonts & Colors** - Full control over typography and appearance
- **Karaoke Animation** - Word-by-word highlighting synced to audio
- **Multiple Animation Types** - Karaoke, fade, appear, scale effects
- **Position Control** - Place subtitles anywhere with magnetic snap guides
- **Outline & Shadow** - Professional text effects for better readability

### Export Options
- **ASS Format** - Advanced SubStation Alpha with full styling support
- **SRT Format** - Universal compatibility export
- **Hardcoded Export** - Burn subtitles directly into video via FFmpeg

## Tech Stack

### Frontend (Renderer Process)
| Technology | Purpose |
|------------|---------|
| **React 18** | UI component framework |
| **TypeScript** | Type-safe development |
| **Zustand** | Lightweight state management |
| **Tailwind CSS** | Utility-first styling |
| **WaveSurfer.js** | Audio waveform visualization |

### Backend (Main Process)
| Technology | Purpose |
|------------|---------|
| **Electron 28** | Cross-platform desktop framework |
| **electron-vite** | Fast build tooling with HMR |
| **FFmpeg** | Video/audio processing |
| **fluent-ffmpeg** | Node.js FFmpeg wrapper |

### AI/ML Service (Python)
| Technology | Purpose |
|------------|---------|
| **WhisperX** | Speech recognition with word alignment |
| **faster-whisper** | Optimized Whisper inference |
| **pyannote.audio** | Speaker diarization |
| **PyTorch** | ML framework (MPS backend for Apple Silicon) |

## Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              OpenSub Application                              │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         RENDERER PROCESS (React)                       │  │
│  │                                                                        │  │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                │  │
│  │   │   DropZone   │  │ VideoPlayer  │  │SubtitleList  │                │  │
│  │   │  (File Input)│  │ + SubCanvas  │  │  (Editor)    │                │  │
│  │   └──────┬───────┘  └──────┬───────┘  └──────┬───────┘                │  │
│  │          │                 │                 │                         │  │
│  │   ┌──────┴─────────────────┴─────────────────┴───────┐                │  │
│  │   │           Zustand State Management               │                │  │
│  │   │   ┌─────────────────┐  ┌─────────────────┐       │                │  │
│  │   │   │  projectStore   │  │    uiStore      │       │                │  │
│  │   │   │  (Project Data) │  │  (UI State)     │       │                │  │
│  │   │   └─────────────────┘  └─────────────────┘       │                │  │
│  │   └──────────────────────┬───────────────────────────┘                │  │
│  │                          │                                             │  │
│  │   ┌──────────────┐  ┌────┴──────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │   │   Timeline   │  │StyleEditor│  │ ExportProgress│  │Transcription│  │  │
│  │   │ (WaveSurfer) │  │  (Styling)│  │  (FFmpeg)    │  │  Progress   │  │  │
│  │   └──────────────┘  └───────────┘  └──────────────┘  └─────────────┘  │  │
│  │                                                                        │  │
│  └───────────────────────────────┬────────────────────────────────────────┘  │
│                                  │ IPC (contextBridge)                       │
│                                  ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                          PRELOAD SCRIPT                                │  │
│  │                  (Secure API Bridge - window.api)                      │  │
│  │    • whisper.start/transcribe/cancel • ffmpeg.extractAudio/export     │  │
│  │    • file.selectVideo/selectOutput   • Event subscriptions            │  │
│  └───────────────────────────────┬────────────────────────────────────────┘  │
│                                  │ IPC Channels                              │
│                                  ▼                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                         MAIN PROCESS (Node.js)                         │  │
│  │                                                                        │  │
│  │   ┌────────────────────────────────────────────────────────────────┐   │  │
│  │   │                      IPC Handlers                              │   │  │
│  │   │  ┌─────────────────┐  ┌─────────────────┐  ┌───────────────┐  │   │  │
│  │   │  │ whisper-handlers│  │ ffmpeg-handlers │  │ file-handlers │  │   │  │
│  │   │  └────────┬────────┘  └────────┬────────┘  └───────────────┘  │   │  │
│  │   └───────────┼────────────────────┼───────────────────────────────┘   │  │
│  │               │                    │                                   │  │
│  │   ┌───────────┴─────────┐  ┌───────┴───────────┐                      │  │
│  │   │   WhisperService    │  │   FFmpegService   │                      │  │
│  │   │  (Process Manager)  │  │  (fluent-ffmpeg) │                      │  │
│  │   └───────────┬─────────┘  └───────────────────┘                      │  │
│  │               │                                                        │  │
│  └───────────────┼────────────────────────────────────────────────────────┘  │
│                  │ JSON-RPC (stdio)                                          │
│                  ▼                                                           │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │                      PYTHON SERVICE (Subprocess)                       │  │
│  │                                                                        │  │
│  │   ┌─────────────────┐      ┌─────────────────────────────────────┐    │  │
│  │   │   rpc_handler   │◄────►│         WhisperTranscriber          │    │  │
│  │   │  (JSON-RPC I/O) │      │                                     │    │  │
│  │   └─────────────────┘      │  ┌────────────────────────────────┐ │    │  │
│  │                            │  │    Transcription Pipeline      │ │    │  │
│  │                            │  │                                │ │    │  │
│  │                            │  │  1. Load Audio (whisperx_mlx)  │ │    │  │
│  │                            │  │  2. Transcribe (MLX/GPU)       │ │    │  │
│  │                            │  │  3. Align Words (CPU)          │ │    │  │
│  │                            │  │  4. Diarize Speakers (CPU)     │ │    │  │
│  │                            │  └────────────────────────────────┘ │    │  │
│  │                            └─────────────────────────────────────┘    │  │
│  │                                                                        │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│   Video File    │────►│  FFmpegService   │────►│   Audio WAV     │
│   (MP4, MOV)    │     │  (Extract Audio) │     │   (16kHz Mono)  │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Subtitle Data  │◄────│  WhisperX MLX    │◄────│  Python Service │
│  (Word Timing)  │     │  (GPU Transcribe)│     │  (JSON-RPC)     │
└────────┬────────┘     └──────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  projectStore   │────►│   StyleEditor    │────►│   ASS/SRT       │
│  (Zustand)      │     │   (User Styling) │     │   Export        │
└─────────────────┘     └──────────────────┘     └─────────────────┘
```

### Component Documentation

#### Main Process (`src/main/`)

| Component | File | Description |
|-----------|------|-------------|
| **Entry Point** | `index.ts` | Electron app lifecycle, window management, media protocol registration |
| **WhisperService** | `services/WhisperService.ts` | Manages Python subprocess lifecycle, handles JSON-RPC communication |
| **WhisperIPC** | `services/WhisperIPC.ts` | JSON-RPC protocol implementation over stdio |
| **FFmpegService** | `services/FFmpegService.ts` | Video metadata extraction, audio extraction, subtitle burning |
| **Whisper Handlers** | `ipc/whisper-handlers.ts` | IPC handlers for transcription start/stop/progress |
| **FFmpeg Handlers** | `ipc/ffmpeg-handlers.ts` | IPC handlers for video processing operations |
| **File Handlers** | `ipc/file-handlers.ts` | IPC handlers for file dialogs and path resolution |

#### Renderer Process (`src/renderer/`)

| Component | File | Description |
|-----------|------|-------------|
| **App** | `App.tsx` | Root component, conditional rendering based on project state |
| **DropZone** | `components/DropZone/` | Drag-and-drop video import, initiates processing pipeline |
| **VideoPlayer** | `components/VideoPlayer/VideoPlayer.tsx` | Video playback with custom controls, keyboard shortcuts |
| **SubtitleCanvas** | `components/VideoPlayer/SubtitleCanvas.tsx` | Canvas-based subtitle rendering with karaoke animation |
| **Timeline** | `components/Timeline/Timeline.tsx` | WaveSurfer.js waveform visualization, segment markers |
| **SubtitleList** | `components/SubtitleEditor/SubtitleList.tsx` | Scrollable list of editable subtitle segments |
| **SubtitleItem** | `components/SubtitleEditor/SubtitleItem.tsx` | Individual subtitle with inline text editing |
| **StyleEditor** | `components/StyleEditor/StyleEditor.tsx` | Font, color, position, animation controls |
| **TranscriptionProgress** | `components/TranscriptionProgress/` | Progress overlay during AI transcription |
| **ExportProgress** | `components/ExportProgress/` | Progress overlay during video export |

#### State Management (`src/renderer/store/`)

| Store | Purpose | Key State |
|-------|---------|-----------|
| **projectStore** | Project data, subtitles, speakers | `project`, `subtitles[]`, `speakers[]`, `style` |
| **uiStore** | UI state, playback control | `isPlaying`, `currentTime`, `isTranscribing`, `selectedSubtitleId` |

#### Preload Scripts (`src/preload/`)

The preload script exposes a secure API to the renderer via `contextBridge`:

```typescript
window.api = {
  whisper: {
    start(config)      // Start WhisperX service with model config
    transcribe(path)   // Transcribe audio file
    cancel()           // Cancel ongoing transcription
    onProgress(cb)     // Subscribe to progress updates
  },
  ffmpeg: {
    getMetadata(path)  // Get video duration, resolution, fps
    extractAudio(...)  // Extract WAV audio for transcription
    export(...)        // Burn subtitles into video
    onProgress(cb)     // Subscribe to export progress
  },
  file: {
    selectVideo()      // Open file dialog for video
    selectOutput()     // Save dialog for export
    getAppPath()       // Get app data directory
  }
}
```

#### Python Service (`python-service/`)

| Component | File | Description |
|-----------|------|-------------|
| **Entry Point** | `whisper_service/main.py` | Service initialization, JSON-RPC server loop |
| **RPC Handler** | `whisper_service/rpc_handler.py` | JSON-RPC message parsing and method dispatch |
| **Transcriber** | `whisper_service/transcriber.py` | WhisperX-MLX pipeline orchestration |

##### Transcription Pipeline Stages

1. **Loading** (0-10%) - Load audio file, validate format
2. **Transcribing** (10-50%) - WhisperX inference using MLX on Apple GPU
3. **Aligning** (50-70%) - Word-level timestamp alignment
4. **Diarizing** (70-100%) - Speaker identification with pyannote.audio

#### Shared Types (`src/shared/types.ts`)

Key interfaces shared between main and renderer processes:

| Type | Purpose |
|------|---------|
| `Project` | Complete project state including video, subtitles, style |
| `Subtitle` | Subtitle segment with start/end time, text, words[] |
| `Word` | Individual word with precise timing and confidence |
| `SubtitleStyle` | Font, colors, position, animation settings |
| `TranscriptionResult` | WhisperX output format with segments and speakers |
| `IPC_CHANNELS` | Type-safe IPC channel name constants |

## Supported Formats

### Input Video
- MP4, MOV, AVI, MKV, WebM

### Output
- **ASS** - Advanced SubStation Alpha (styled subtitles)
- **SRT** - SubRip (universal compatibility)
- **MP4** - Video with hardcoded subtitles

## Requirements

### System
- **macOS** (Apple Silicon recommended for GPU acceleration)
- **Node.js** 18+
- **Python** 3.10+
- **FFmpeg** (installed via Homebrew)

### Hardware (Recommended)
- Apple Silicon Mac (M1/M2/M3) for GPU-accelerated transcription
- 16GB RAM for large video files
- Intel Macs supported with CPU-only transcription

## Installation

### Prerequisites

Before installing OpenSub, ensure you have the following installed:

1. **Node.js 18+** - [Download from nodejs.org](https://nodejs.org/) or install via Homebrew:
   ```bash
   brew install node
   ```

2. **Python 3.10+** - [Download from python.org](https://www.python.org/downloads/) or install via Homebrew:
   ```bash
   brew install python@3.10
   ```

3. **FFmpeg** - Required for video/audio processing:
   ```bash
   brew install ffmpeg
   ```

4. **Git** - For cloning the repository:
   ```bash
   brew install git
   ```

### Step 1: Clone the Repository

```bash
git clone https://github.com/your-username/opensub.git
cd opensub
```

### Step 2: Install Node.js Dependencies

Install all Node.js packages for the Electron application:

```bash
npm install
```

This installs the following key dependencies:
- **Electron 28** - Desktop application framework
- **React 18** - UI component framework
- **Zustand** - State management
- **WaveSurfer.js** - Audio waveform visualization
- **fluent-ffmpeg** - FFmpeg wrapper for Node.js

### Step 3: Set Up Python Environment

The Python service handles AI-powered transcription using WhisperX. We recommend using a virtual environment:

```bash
# Navigate to the Python service directory
cd python-service

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate  # On macOS/Linux

# Upgrade pip
pip install --upgrade pip
```

### Step 4: Install Python Dependencies

Install all required Python packages:

```bash
pip install -r requirements.txt
```

This installs:
- **whisperx** (>=3.1.1) - Speech recognition with word alignment
- **torch** (>=2.0.0) - PyTorch ML framework
- **torchaudio** (>=2.0.0) - Audio processing for PyTorch
- **transformers** (>=4.30.0) - For word-level alignment models
- **pyannote.audio** (>=3.1.0) - Speaker diarization
- **faster-whisper** (>=0.10.0) - Optimized Whisper inference
- **librosa** (>=0.10.0) - Audio analysis

#### Apple Silicon (M1/M2/M3) GPU Setup

For GPU-accelerated transcription on Apple Silicon Macs, PyTorch automatically uses the Metal Performance Shaders (MPS) backend. Verify GPU support:

```bash
python3 -c "import torch; print(f'MPS available: {torch.backends.mps.is_available()}')"
```

#### HuggingFace Authentication (Required for Speaker Diarization)

Speaker diarization requires access to pyannote.audio models. You need a HuggingFace account:

1. Create an account at [huggingface.co](https://huggingface.co)
2. Accept the model terms at:
   - [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. Create an access token at [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
4. Set the token as an environment variable:
   ```bash
   export HF_TOKEN="your-huggingface-token"
   ```

> **Tip:** Add the export command to your `~/.zshrc` or `~/.bashrc` to persist the token.

### Step 5: Return to Project Root

```bash
cd ..  # Return to opensub root directory
```

### Verify Installation

Run the development server to verify everything is working:

```bash
npm run dev
```

The application should launch and display the drop zone interface. Try dropping a video file to test the complete pipeline.

## Development

### Available Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start the application in development mode with hot reload |
| `npm run build` | Build the application for production |
| `npm run preview` | Preview the production build locally |
| `npm run build:mac` | Build and package for macOS distribution |
| `npm run typecheck` | Run TypeScript type checking without emitting files |
| `npm run lint` | Run ESLint on all TypeScript files |

### Development Mode

Start the application with hot module replacement (HMR) for rapid development:

```bash
npm run dev
```

This command:
- Starts the electron-vite dev server
- Enables hot reload for the renderer process (React components)
- Watches for changes in main process files
- Opens the Electron application automatically

The Python service is spawned automatically when transcription is requested.

### Build Process

OpenSub uses [electron-vite](https://electron-vite.org/) for building, which provides:
- Fast builds with Vite's esbuild bundler
- Separate configurations for main, preload, and renderer processes
- TypeScript compilation and optimization
- CSS processing with Tailwind CSS

#### Building for Production

1. **Compile the application:**
   ```bash
   npm run build
   ```

   This compiles all TypeScript code and bundles the application into the `out/` directory:
   - `out/main/` - Main process bundle
   - `out/preload/` - Preload scripts
   - `out/renderer/` - React application bundle

2. **Package for distribution:**
   ```bash
   npm run build:mac
   ```

   This runs `electron-builder` to create a distributable macOS application:
   - Creates a `.app` bundle in `dist/mac/` or `dist/mac-arm64/`
   - Generates a DMG installer in `dist/`
   - Bundles all dependencies including the Python service

### Project Structure

```
opensub/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Main entry point
│   │   ├── ipc/        # IPC handlers (whisper, ffmpeg, file)
│   │   └── services/   # Backend services (WhisperService, FFmpegService)
│   ├── preload/        # Preload scripts (secure IPC bridge)
│   ├── renderer/       # React application
│   │   ├── App.tsx     # Root component
│   │   ├── main.tsx    # Renderer entry point
│   │   ├── components/ # UI components
│   │   ├── store/      # Zustand state stores
│   │   └── utils/      # Utility functions
│   └── shared/         # Shared TypeScript types
├── python-service/     # WhisperX transcription service
│   ├── whisper_service/
│   │   ├── main.py     # Service entry point
│   │   ├── transcriber.py  # WhisperX transcription logic
│   │   └── rpc_handler.py  # JSON-RPC message handler
│   └── requirements.txt
├── electron.vite.config.ts  # Build configuration
├── electron-builder.yml     # Packaging configuration
├── tailwind.config.js       # Tailwind CSS configuration
└── tsconfig.json            # TypeScript configuration
```

### Code Quality

#### Type Checking

Run TypeScript compiler in check mode to catch type errors:

```bash
npm run typecheck
```

#### Linting

Run ESLint to enforce code style and catch potential issues:

```bash
npm run lint
```

ESLint is configured with `@electron-toolkit/eslint-config-ts` for TypeScript and Electron best practices.

### Python Service Development

The Python service runs as a subprocess and communicates via JSON-RPC over stdio. To test the Python service independently:

```bash
cd python-service
source venv/bin/activate

# Test the service
python -m whisper_service.main
```

The service expects JSON-RPC messages on stdin and responds on stdout. During development, the Electron app automatically spawns this service when transcription is initiated.

### Hot Reload Behavior

| Process | Hot Reload |
|---------|------------|
| Renderer (React) | ✅ Full HMR - instant updates |
| Preload Scripts | ⚠️ Requires app restart |
| Main Process | ⚠️ Requires app restart |
| Python Service | ⚠️ Restarted per transcription |

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `HF_TOKEN` | For diarization | HuggingFace token for pyannote.audio models |

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<p align="center">
  Built with Electron, React, and WhisperX
</p>
