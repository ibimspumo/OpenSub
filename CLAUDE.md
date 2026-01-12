# CLAUDE.md

This file provides context for Claude Code (and other AI assistants) working on the OpenSub codebase.

## Project Overview

OpenSub is a professional desktop subtitle editor with AI-powered transcription, built with Electron. It provides Descript-style word-level timing precision for creating, editing, and styling subtitles with karaoke animations.

### Tech Stack

- **Frontend**: React 18 + TypeScript + Zustand + Tailwind CSS
- **Backend**: Electron 28 + Node.js + fluent-ffmpeg
- **AI Service**: Python subprocess (WhisperX + pyannote.audio)
- **Build**: electron-vite

### Architecture

The app uses Electron's multi-process architecture:

```
Renderer (React) <--IPC--> Main (Node.js) <--JSON-RPC--> Python Service
```

1. **Renderer Process** (`src/renderer/`) - React UI with Zustand state management
2. **Main Process** (`src/main/`) - Electron backend, FFmpeg, process management
3. **Preload Scripts** (`src/preload/`) - Secure IPC bridge via `window.api`
4. **Python Service** (`python-service/`) - WhisperX transcription subprocess

## Critical Files

### Entry Points

| File | Purpose |
|------|---------|
| `src/main/index.ts` | Electron main process entry, window management |
| `src/renderer/main.tsx` | React app entry point |
| `src/preload/index.ts` | IPC API bridge (defines `window.api`) |
| `python-service/whisper_service/main.py` | Python service entry |

### Core Business Logic

| File | Purpose |
|------|---------|
| `src/shared/types.ts` | **All shared TypeScript types** - modify here for type changes |
| `src/renderer/store/projectStore.ts` | Project state, subtitles, speakers |
| `src/renderer/store/uiStore.ts` | UI state, playback, selections |
| `src/main/services/WhisperService.ts` | Python subprocess lifecycle |
| `src/main/services/FFmpegService.ts` | Video/audio processing |
| `src/renderer/utils/assGenerator.ts` | ASS subtitle file generation |

### IPC Handlers

| File | Purpose |
|------|---------|
| `src/main/ipc/whisper-handlers.ts` | Transcription IPC handlers |
| `src/main/ipc/ffmpeg-handlers.ts` | Video processing IPC handlers |
| `src/main/ipc/file-handlers.ts` | File dialog IPC handlers |

### Key Components

| Component | File |
|-----------|------|
| `DropZone` | `src/renderer/components/DropZone/DropZone.tsx` |
| `VideoPlayer` | `src/renderer/components/VideoPlayer/VideoPlayer.tsx` |
| `SubtitleCanvas` | `src/renderer/components/VideoPlayer/SubtitleCanvas.tsx` |
| `Timeline` | `src/renderer/components/Timeline/Timeline.tsx` |
| `SubtitleList` | `src/renderer/components/SubtitleEditor/SubtitleList.tsx` |
| `StyleEditor` | `src/renderer/components/StyleEditor/StyleEditor.tsx` |

## Key Types

Located in `src/shared/types.ts`:

```typescript
// Core data structures
Project          // Complete project state
Subtitle         // Subtitle segment with words[]
Word             // Word with startTime, endTime, confidence
SubtitleStyle    // Font, colors, position, animation
Speaker          // Speaker from diarization

// IPC types
WhisperConfig        // Whisper model configuration
TranscriptionResult  // WhisperX output
TranscriptionProgress // Progress updates
VideoMetadata        // FFmpeg video info
ExportOptions        // Export configuration

// Constants
IPC_CHANNELS         // Type-safe IPC channel names
DEFAULT_SUBTITLE_STYLE
SPEAKER_COLORS
```

## IPC Communication Pattern

The preload script exposes a typed API at `window.api`:

```typescript
window.api.whisper.start(config)     // Start Python service
window.api.whisper.transcribe(path)  // Transcribe audio
window.api.whisper.onProgress(cb)    // Subscribe to progress

window.api.ffmpeg.getMetadata(path)  // Get video info
window.api.ffmpeg.extractAudio(...)  // Extract WAV
window.api.ffmpeg.export(...)        // Burn subtitles

window.api.file.selectVideo()        // File picker
window.api.file.selectOutput()       // Save dialog
```

## Python Service Communication

The Electron main process spawns the Python service and communicates via JSON-RPC over stdio:

```python
# Request format
{"jsonrpc": "2.0", "method": "transcribe", "params": {...}, "id": 1}

# Response format
{"jsonrpc": "2.0", "result": {...}, "id": 1}

# Progress notification (no id)
{"jsonrpc": "2.0", "method": "progress", "params": {...}}
```

## Project Structure

```
opensub/
├── src/
│   ├── main/           # Electron main process
│   │   ├── index.ts    # Entry point
│   │   ├── ipc/        # IPC handlers
│   │   └── services/   # WhisperService, FFmpegService
│   ├── preload/        # Secure IPC bridge
│   ├── renderer/       # React application
│   │   ├── App.tsx
│   │   ├── components/ # UI components
│   │   ├── store/      # Zustand stores
│   │   └── utils/      # Utilities
│   └── shared/         # Shared types
├── python-service/     # WhisperX service
│   └── whisper_service/
│       ├── main.py
│       ├── transcriber.py
│       └── rpc_handler.py
├── electron.vite.config.ts
├── electron-builder.yml
├── tailwind.config.js
└── tsconfig.json
```

## Common Patterns

### Adding a New IPC Channel

1. Add channel name to `IPC_CHANNELS` in `src/shared/types.ts`
2. Create handler in appropriate file in `src/main/ipc/`
3. Expose in preload script `src/preload/index.ts`
4. Use via `window.api` in renderer

### Adding a New Component

1. Create component folder in `src/renderer/components/`
2. Export default function component (no class components)
3. Use Tailwind CSS for styling
4. Connect to stores via hooks: `useProjectStore()`, `useUIStore()`

### State Management

- Use `projectStore` for data that should persist (subtitles, style, speakers)
- Use `uiStore` for ephemeral UI state (playback, selections, loading states)
- Access via hooks: `const { subtitles } = useProjectStore()`

### Zustand Store Pattern

```typescript
export const useMyStore = create<MyState>((set) => ({
  value: initialValue,
  setValue: (value) => set({ value }),
}))
```

## Important Considerations

### Electron Security

- All Node.js APIs are accessed through the preload script
- Never expose `nodeIntegration: true`
- Use `contextBridge` for all renderer-main communication

### Video Path Handling

- Video files are accessed via custom `media://` protocol registered in main process
- Paths must be absolute paths on the filesystem
- Use `window.api.file.getAppPath()` for temp file locations

### Python Service

- Service is spawned on-demand when transcription starts
- Communicates via stdin/stdout JSON-RPC
- Must be killed gracefully to avoid orphan processes
- Requires HuggingFace token for speaker diarization

### Performance

- Large videos: Audio extraction can take time
- Use progress events for long operations
- WaveSurfer.js handles waveform rendering (memory intensive for long audio)

## Development Commands

### Node.js / Electron

```bash
# Install dependencies
npm install

# Start development mode (hot reload)
npm run dev

# Build application
npm run build

# Build for macOS
npm run build:mac

# Preview production build
npm run preview

# Type checking
npm run typecheck

# Lint TypeScript/React code
npm run lint
```

### Python Service

```bash
# Navigate to Python service directory
cd python-service

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # macOS/Linux

# Install dependencies
pip install -r requirements.txt

# Run service standalone (for testing)
python -m whisper_service.main
```

### Environment Variables

Create a `.env` file in the project root:

```env
HF_TOKEN=your_huggingface_token  # Required for speaker diarization
```

## Code Style Guidelines

### TypeScript / React

- **Function components only** - No class components
- **Named exports for types**, default exports for components
- **Strict TypeScript** - `strict: true` in tsconfig, no `any` without justification
- **Imports**: React hooks first, then stores, then local imports
- **File naming**: PascalCase for components (`DropZone.tsx`), camelCase for utilities (`assGenerator.ts`)

```typescript
// Good: Function component with typed props
interface MyComponentProps {
  value: string
  onChange: (value: string) => void
}

export default function MyComponent({ value, onChange }: MyComponentProps) {
  const { subtitles } = useProjectStore()
  // ...
}
```

### Styling

- **Tailwind CSS only** - No CSS modules or styled-components
- **Utility-first** - Compose utilities, avoid @apply unless absolutely necessary
- **Dark theme** - Use `bg-gray-900`, `bg-gray-800` for backgrounds, `text-white`/`text-gray-*` for text
- **Consistent spacing** - Use Tailwind's spacing scale (`p-4`, `gap-2`, `space-y-2`)

```tsx
// Good: Tailwind utility classes
<div className="flex items-center gap-2 p-4 bg-gray-800 rounded-lg">
  <span className="text-sm text-gray-400">Label</span>
</div>
```

### State Management

- **Zustand stores** - Use `create()` pattern with typed state
- **Immutable updates** - Use spread operator or immer for nested updates
- **Selectors** - Destructure only what you need from stores

```typescript
// Good: Selective store access
const { subtitles, updateSubtitle } = useProjectStore()

// Avoid: Selecting entire store
const store = useProjectStore()  // Causes unnecessary re-renders
```

### IPC Communication

- **Type-safe channels** - Always add new channels to `IPC_CHANNELS` first
- **Error handling** - Wrap IPC calls in try/catch, return typed errors
- **Progress events** - Use callback pattern for long-running operations

```typescript
// Good: Typed IPC with error handling
try {
  const result = await window.api.whisper.transcribe(audioPath)
  setTranscriptionResult(result)
} catch (error) {
  setError(error instanceof Error ? error.message : 'Transcription failed')
}
```

### Python Service

- **Type hints** - Use type annotations on all function parameters and returns
- **Docstrings** - Document classes and public methods
- **Logging** - Use `logger` module, not `print()` (stdout is reserved for JSON-RPC)
- **Error handling** - Catch exceptions, return JSON-RPC error responses

```python
# Good: Typed function with docstring
def transcribe(self, audio_path: str, language: str = "de") -> Dict[str, Any]:
    """
    Transcribe audio file using WhisperX.

    Args:
        audio_path: Path to WAV audio file
        language: Language code (default: "de")

    Returns:
        Transcription result with segments and words
    """
    # Implementation...
```

### Git Conventions

- **Commit messages**: Use conventional commits format
  - `feat: Add new feature`
  - `fix: Fix bug description`
  - `refactor: Improve code structure`
  - `docs: Update documentation`
- **Branch naming**: `feature/description`, `fix/description`, `refactor/description`

## Testing Workflow

### Manual Testing Checklist

1. **Video Import**: Drag/drop video file into DropZone
2. **Transcription**: Verify Python service starts, progress updates
3. **Subtitle Editing**: Edit text, adjust timing in timeline
4. **Style Changes**: Modify font, colors, animations
5. **Export**: Export with burned subtitles, verify output

### Debugging

```bash
# View Electron logs in dev mode
npm run dev  # Logs appear in terminal

# Debug Python service
cd python-service
python -c "from whisper_service.transcriber import WhisperTranscriber; t = WhisperTranscriber(); t.initialize()"
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Python service won't start | Check `HF_TOKEN` in `.env`, verify venv activation |
| FFmpeg errors | Ensure FFmpeg is installed: `brew install ffmpeg` |
| Transcription hangs | Check Python logs, may need more VRAM/RAM |
| Hot reload not working | Restart `npm run dev`, check for syntax errors |
| Type errors | Run `npm run typecheck` to identify issues |
