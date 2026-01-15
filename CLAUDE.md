# CLAUDE.md

This file provides context for Claude Code (and other AI assistants) working on the OpenSub codebase.

## Project Overview

OpenSub is a professional desktop subtitle editor with AI-powered transcription, built with Electron. It provides Descript-style word-level timing precision for creating, editing, and styling subtitles with karaoke animations.

**Important**: Since v0.2.0, OpenSub is distributed as a **standalone app** — Python, FFmpeg, and all AI dependencies are bundled directly into the `.dmg`. Users don't need to install anything except the app itself.

### Tech Stack

- **Frontend**: React 18 + TypeScript + Zustand + Tailwind CSS
- **Backend**: Electron 28 + Node.js + fluent-ffmpeg
- **AI Service**: Bundled Python subprocess (WhisperX-MLX)
- **Build**: electron-vite + electron-builder
- **Python Runtime**: python-build-standalone (bundled, not system Python)

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
OpenSub/
├── src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # Entry point, window management
│   │   ├── ipc/           # IPC handlers (whisper, ffmpeg, file)
│   │   └── services/      # WhisperService, FFmpegService, etc.
│   ├── preload/           # Secure IPC bridge (window.api)
│   ├── renderer/          # React application
│   │   ├── App.tsx
│   │   ├── components/    # UI components
│   │   ├── store/         # Zustand stores (project, ui, style)
│   │   ├── i18n/          # Internationalization
│   │   └── utils/         # Utilities (assGenerator, etc.)
│   └── shared/            # Shared types (types.ts)
├── python-service/        # Python AI service
│   ├── whisper_service/
│   │   ├── main.py        # Service entry point
│   │   ├── transcriber.py # WhisperX wrapper
│   │   └── rpc_handler.py # JSON-RPC handler
│   ├── requirements.txt   # Python dependencies
│   └── .venv/             # Development venv (gitignored)
├── scripts/               # Build and setup scripts
│   ├── download-python.sh # Downloads python-build-standalone
│   ├── setup-python-env.sh# Creates bundled Python environment
│   └── notarize.cjs       # macOS notarization
├── build-resources/       # Generated by setup:python (gitignored)
│   ├── python-standalone/ # Downloaded Python binary
│   └── python-env/        # Bundled Python environment
├── resources/             # App icons and assets
│   ├── icon.icns
│   └── entitlements.mac.plist
├── electron.vite.config.ts
├── electron-builder.yml   # electron-builder configuration
├── tailwind.config.js
└── tsconfig.json
```

## Standalone Build Configuration

The standalone build is configured in `electron-builder.yml`. Key settings:

### Extra Resources (Bundled into app)

```yaml
extraResources:
  # Python service source code
  - from: python-service
    to: python-service
    filter:
      - "**/*"
      - "!.venv/**"        # Exclude dev venv
      - "!__pycache__/**"

  # Bundled Python environment (created by setup:python)
  - from: build-resources/python-env
    to: python-env
    filter:
      - "**/*"
      - "!**/__pycache__/**"
```

### ASAR Unpacking (Required for native binaries)

```yaml
asar: true
asarUnpack:
  - "**/node_modules/@ffmpeg-installer/**/*"
  - "**/node_modules/@ffprobe-installer/**/*"
```

FFmpeg binaries must be unpacked from the ASAR archive to be executed as native processes.

### Key Build Artifacts

After `npm run dist`, the bundled app contains:
- `OpenSub.app/Contents/Resources/python-env/` — Complete Python environment
- `OpenSub.app/Contents/Resources/python-service/` — Python source code
- `OpenSub.app/Contents/Resources/app.asar.unpacked/` — FFmpeg binaries

## Common Patterns

### Adding a New IPC Channel (Step-by-Step)

IPC channels follow a strict flow through four files. Here's a complete walkthrough:

**Step 1: Define the channel name** in `src/shared/types.ts`:
```typescript
// Add to IPC_CHANNELS constant
export const IPC_CHANNELS = {
  // ... existing channels
  MY_NEW_CHANNEL: 'my:new-channel',
} as const
```

**Step 2: Create the handler** in `src/main/ipc/` (choose appropriate file or create new one):
```typescript
// src/main/ipc/my-handlers.ts
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../shared/types'

export function registerMyHandlers() {
  ipcMain.handle(IPC_CHANNELS.MY_NEW_CHANNEL, async (_event, arg1: string, arg2: number) => {
    // Handler logic here
    return { success: true, data: result }
  })
}
```

**Step 3: Register the handler** in `src/main/index.ts`:
```typescript
import { registerMyHandlers } from './ipc/my-handlers'
// In app.whenReady():
registerMyHandlers()
```

**Step 4: Expose in preload** `src/preload/index.ts`:
```typescript
// Add to contextBridge.exposeInMainWorld('api', { ... })
myService: {
  myMethod: (arg1: string, arg2: number): Promise<{ success: boolean; data?: T }> =>
    ipcRenderer.invoke(IPC_CHANNELS.MY_NEW_CHANNEL, arg1, arg2),
}

// Add type declaration in Window interface
interface Window {
  api: {
    // ... existing
    myService: {
      myMethod: (arg1: string, arg2: number) => Promise<{ success: boolean; data?: T }>
    }
  }
}
```

**Step 5: Use in renderer**:
```typescript
// In any React component
const result = await window.api.myService.myMethod('hello', 42)
```

### Adding Event Listeners (Progress/Notifications)

For events pushed from main to renderer (e.g., progress updates):

```typescript
// In preload - add both a listener method and a remove method
onProgress: (callback: (progress: ProgressType) => void): (() => void) => {
  const handler = (_event: Electron.IpcRendererEvent, progress: ProgressType) => {
    callback(progress)
  }
  ipcRenderer.on(IPC_CHANNELS.MY_PROGRESS, handler)
  return () => ipcRenderer.removeListener(IPC_CHANNELS.MY_PROGRESS, handler)
}

// In main process - emit the event
mainWindow.webContents.send(IPC_CHANNELS.MY_PROGRESS, progressData)

// In renderer - subscribe and unsubscribe
useEffect(() => {
  const unsubscribe = window.api.myService.onProgress((progress) => {
    setProgress(progress)
  })
  return () => unsubscribe()  // Clean up on unmount
}, [])
```

### Adding a New Component

1. Create component folder: `src/renderer/components/MyComponent/`
2. Create main file: `MyComponent.tsx`
3. Use function components with typed props interface:

```typescript
// src/renderer/components/MyComponent/MyComponent.tsx
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'

interface MyComponentProps {
  title: string
  onAction?: () => void
}

export default function MyComponent({ title, onAction }: MyComponentProps) {
  const { subtitles, updateSubtitleText } = useProjectStore()
  const { isLoading, setLoading } = useUIStore()

  return (
    <div className="flex flex-col gap-2 p-4 bg-gray-800 rounded-lg">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {/* Component content */}
    </div>
  )
}
```

### State Management Strategy

The app uses two Zustand stores with distinct responsibilities:

| Store | Purpose | Persisted? | Examples |
|-------|---------|------------|----------|
| `projectStore` | Project data, user content | Yes (to JSON) | subtitles, style, videoPath, speakers |
| `uiStore` | Ephemeral UI state | No | playback position, selections, loading states |

**Accessing stores**:
```typescript
// ✅ Good: Destructure only what you need (prevents unnecessary re-renders)
const { subtitles, updateSubtitleText } = useProjectStore()
const { currentTime, setCurrentTime } = useUIStore()

// ❌ Bad: Selecting entire store causes re-renders on ANY change
const store = useProjectStore()
```

### Zustand Store Pattern

```typescript
import { create } from 'zustand'

interface MyState {
  items: Item[]
  selectedId: string | null

  // Actions
  addItem: (item: Item) => void
  setSelected: (id: string | null) => void
  updateItem: (id: string, updates: Partial<Item>) => void
}

export const useMyStore = create<MyState>((set, get) => ({
  items: [],
  selectedId: null,

  addItem: (item) => set((state) => ({
    items: [...state.items, item]
  })),

  setSelected: (id) => set({ selectedId: id }),

  // Pattern for updating nested items
  updateItem: (id, updates) => set((state) => ({
    items: state.items.map((item) =>
      item.id === id ? { ...item, ...updates } : item
    )
  }))
}))
```

### Error Handling Patterns

**IPC calls** - Always wrap in try/catch:
```typescript
try {
  const result = await window.api.whisper.transcribe(audioPath)
  setTranscriptionResult(result)
} catch (error) {
  // Prefer type-safe error messages
  setError(error instanceof Error ? error.message : 'Unknown error')
  console.error('Transcription failed:', error)
}
```

**Async operations in stores** - Use `get()` for async updates:
```typescript
someAsyncAction: async (id: string) => {
  try {
    set({ isLoading: true })
    const result = await someApiCall(id)
    // Use get() to access current state in async context
    const currentItems = get().items
    set({
      items: [...currentItems, result],
      isLoading: false
    })
  } catch (error) {
    set({ isLoading: false, error: error.message })
  }
}
```

## Important Considerations

### Electron Security Model

OpenSub follows Electron's security best practices strictly:

- **Context Isolation**: `contextIsolation: true` — renderer and main contexts are completely separated
- **Node Integration Disabled**: `nodeIntegration: false` — no Node.js APIs in renderer
- **Preload Script Bridge**: All main↔renderer communication goes through `contextBridge` in preload
- **Type-Safe IPC**: All channels defined in `IPC_CHANNELS` constant with TypeScript types

```typescript
// ❌ Never do this in renderer
const fs = require('fs')  // Won't work, nodeIntegration is disabled

// ✅ Correct: Use preload-exposed API
const result = await window.api.file.selectVideo()
```

### Video Path Handling

- Videos are served via custom `media://` protocol (registered in main process)
- The protocol handler resolves `media://video?path=/absolute/path` to the actual file
- All paths in the project must be **absolute filesystem paths**
- Use `window.api.file.getAppPath()` to get the app's data directory for temp files

```typescript
// Example: Video element source
<video src={`media://video?path=${encodeURIComponent(project.videoPath)}`} />
```

### Resource Cleanup

Proper cleanup prevents memory leaks, especially when switching videos:

```typescript
// Clean up audio files when switching projects
if (oldProject?.audioPath) {
  await window.api.file.deleteTempFile(oldProject.audioPath)
}

// Clean up media streams (prevents Electron memory leaks)
if (oldProject?.videoPath) {
  await window.api.file.cleanupMediaStreams(oldProject.videoPath)
}
```

### Python Service Architecture

The Python service is critical infrastructure with different behavior in dev vs production:

| Aspect | Development | Production |
|--------|-------------|------------|
| Python Binary | `python-service/.venv/bin/python` | `Resources/python-env/bin/python3` |
| PYTHONHOME | Not set | `Resources/python-env/` |
| FFmpeg | System PATH (`brew install ffmpeg`) | Bundled in `app.asar.unpacked/` |
| Model Download | To user's HuggingFace cache | To user's HuggingFace cache |

**Lifecycle**:
1. Service spawned on-demand when transcription starts
2. Communicates via stdin/stdout JSON-RPC 2.0
3. Emits progress events as JSON-RPC notifications
4. Must be killed gracefully with `shutdown` RPC call before `SIGTERM`

**HuggingFace Token** (optional): Enables speaker diarization via pyannote.audio

#### Bundled Python Architecture

In production builds, Python is completely self-contained:

```
Resources/
├── python-env/                  # Bundled Python environment
│   ├── bin/python3.12           # Standalone Python binary (copied, not symlinked)
│   ├── lib/python3.12/          # Complete Python stdlib
│   │   └── site-packages/       # Installed packages (WhisperX, PyTorch, etc.)
│   └── lib/libpython3.12.dylib  # Python shared library
├── python-service/              # Python source code
│   └── whisper_service/
│       ├── main.py              # Service entry point
│       ├── transcriber.py       # WhisperX wrapper
│       └── rpc_handler.py       # JSON-RPC handler
└── app.asar.unpacked/           # Unpacked FFmpeg binaries
    └── node_modules/
        ├── @ffmpeg-installer/
        └── @ffprobe-installer/
```

The `WhisperService` class (`src/main/services/WhisperService.ts`) handles path resolution:
- **Development**: `python-service/.venv/bin/python`
- **Production**: `process.resourcesPath/python-env/bin/python3`

Critical environment variables set in production:
- `PYTHONHOME`: Points to `python-env/` so Python finds its stdlib
- `PYTHONPATH`: Points to `python-service/` for the service modules
- `PATH`: Extended with bundled FFmpeg binary paths

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

# Build application (without Python bundling)
npm run build

# Build for macOS
npm run build:mac

# Type checking
npm run typecheck

# Lint TypeScript/React code
npm run lint

# Run tests
npm run test
```

### Standalone Build (Distribution)

```bash
# 1. Download portable Python (python-build-standalone from astral-sh)
npm run setup:python

# 2. Build complete standalone DMG with bundled Python
npm run dist

# Alternative: Build without Python bundling (for testing)
npm run dist:unsigned
```

The `setup:python` script (`scripts/download-python.sh` + `scripts/setup-python-env.sh`):
1. Downloads Python 3.12 from python-build-standalone (~50 MB)
2. Creates virtual environment at `build-resources/python-env`
3. Installs WhisperX-MLX, PyTorch, MLX and all AI dependencies (~2-3 GB)
4. Fixes symlinks to use actual binaries (required for bundling)
5. Copies complete Python stdlib (required for PYTHONHOME)

### Python Service (Development)

For development, set up a local Python environment:

```bash
# Navigate to Python service directory
cd python-service

# Create virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run service standalone (for testing JSON-RPC)
python -m whisper_service.main
```

### Environment Variables

Create a `.env` file in the project root:

```env
HF_TOKEN=your_huggingface_token  # Optional: enables speaker diarization
```

### Build Scripts Reference

| Script | Location | Purpose |
|--------|----------|---------|
| `download-python.sh` | `scripts/` | Downloads python-build-standalone |
| `setup-python-env.sh` | `scripts/` | Creates bundled Python environment |
| `notarize.cjs` | `scripts/` | macOS notarization (CI only) |

## Code Style Guidelines

### TypeScript / React

- **Function components only** — No class components anywhere in the codebase
- **Named exports for types**, default exports for components
- **Strict TypeScript** — `strict: true`, avoid `any` (use `unknown` + type guards if needed)
- **File naming**: PascalCase for components (`DropZone.tsx`), camelCase for utilities (`assGenerator.ts`)

**Import Order** (enforced by ESLint):
```typescript
// 1. React hooks and React-related imports
import { useState, useEffect, useCallback } from 'react'

// 2. Store imports
import { useProjectStore } from '../../store/projectStore'
import { useUIStore } from '../../store/uiStore'

// 3. Type imports (use 'import type' when possible)
import type { Subtitle, SubtitleStyle } from '../../shared/types'

// 4. Local imports (components, utilities)
import { formatTimecode } from '../../utils/timeFormat'
```

**Component Structure**:
```typescript
// Props interface above component
interface MyComponentProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean  // Optional props last
}

export default function MyComponent({ value, onChange, disabled = false }: MyComponentProps) {
  // 1. Store hooks
  const { subtitles } = useProjectStore()

  // 2. Local state
  const [localValue, setLocalValue] = useState(value)

  // 3. Effects
  useEffect(() => {
    setLocalValue(value)
  }, [value])

  // 4. Callbacks (memoized if passed to children)
  const handleChange = useCallback((newValue: string) => {
    setLocalValue(newValue)
    onChange(newValue)
  }, [onChange])

  // 5. Render
  return (
    <div className="...">
      {/* JSX */}
    </div>
  )
}
```

### Tailwind CSS Styling

OpenSub uses a consistent dark theme throughout:

| Element | Classes |
|---------|---------|
| Page background | `bg-gray-900` |
| Card/Panel background | `bg-gray-800` |
| Interactive hover | `hover:bg-gray-700` |
| Primary text | `text-white` |
| Secondary text | `text-gray-400` |
| Accent color | `text-blue-500`, `bg-blue-600` |
| Border | `border-gray-700` |

**Common Patterns**:
```tsx
// Card container
<div className="flex flex-col gap-4 p-4 bg-gray-800 rounded-lg border border-gray-700">

// Button (primary)
<button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors">

// Button (secondary)
<button className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors">

// Input field
<input className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" />

// Icon button
<button className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
```

**Avoid**:
- Inline styles (`style={{}}`)
- CSS modules
- `@apply` in CSS (compose utilities directly in JSX)

### Type Definitions in `src/shared/types.ts`

All shared types live in `src/shared/types.ts` — this is the **single source of truth** for:

- Data structures (`Project`, `Subtitle`, `Word`, `SubtitleStyle`)
- IPC types (`WhisperConfig`, `TranscriptionResult`, `ExportOptions`)
- Constants (`IPC_CHANNELS`, `DEFAULT_SUBTITLE_STYLE`, `SPEAKER_COLORS`)

**Adding a New Type**:
1. Define the interface in `src/shared/types.ts`
2. Export it (named export for types)
3. Import with `import type { MyType } from '../../shared/types'`

```typescript
// src/shared/types.ts
export interface MyNewFeatureConfig {
  enabled: boolean
  options: MyOptions
}

// Export from types.ts, then import where needed
import type { MyNewFeatureConfig } from '../../shared/types'
```

### Python Service Code Style

The Python service follows these conventions:

```python
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)

class MyService:
    """Service for handling XYZ operations."""

    def __init__(self, config: Dict[str, Any]) -> None:
        """
        Initialize the service.

        Args:
            config: Configuration dictionary with keys: ...
        """
        self.config = config
        self._initialized = False

    def process(self, input_path: str, options: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Process the input file.

        Args:
            input_path: Absolute path to input file
            options: Optional processing options

        Returns:
            Dict with 'success' and 'result' keys

        Raises:
            ValueError: If input_path doesn't exist
        """
        # IMPORTANT: Never use print() — stdout is for JSON-RPC only
        logger.info(f"Processing: {input_path}")

        try:
            result = self._do_processing(input_path, options or {})
            return {"success": True, "result": result}
        except Exception as e:
            logger.error(f"Processing failed: {e}")
            return {"success": False, "error": str(e)}
```

### Git Conventions

**Commit Messages** (Conventional Commits):
```
feat: Add speaker diarization support
fix: Resolve memory leak in video player
refactor: Extract subtitle timing logic to utility
docs: Update README with standalone build instructions
chore: Update dependencies
perf: Optimize waveform rendering for long videos
```

**Branch Naming**:
- `feature/speaker-diarization`
- `fix/memory-leak-video-player`
- `refactor/subtitle-timing`

**PR Guidelines**:
- Keep PRs focused on single concern
- Include test steps in PR description
- Reference issues with `Fixes #123`

## Data Flow Patterns

### Transcription Flow

Understanding the transcription pipeline is key to working on the core feature:

```
1. User drops video file
   └─> DropZone.tsx handles drop event

2. Video metadata extracted
   └─> window.api.ffmpeg.getMetadata(videoPath)
   └─> Sets project.resolution, project.duration

3. Audio extracted from video
   └─> window.api.ffmpeg.extractAudio(videoPath, tempPath)
   └─> Returns path to WAV file (16kHz mono)

4. Transcription started
   └─> window.api.whisper.start(config)  // Spawns Python service
   └─> window.api.whisper.transcribe(audioPath)
   └─> Listens: window.api.whisper.onProgress(cb)

5. Results processed
   └─> TranscriptionResult → Subtitle[] conversion in projectStore
   └─> Auto-split applied based on style.maxWidth and style.maxLines
   └─> Subtitles stored in project.subtitles
```

### Subtitle Rendering Flow

The subtitle canvas renders text with precise word-level timing:

```
1. Current playback time from video player
   └─> uiStore.currentTime (updated every animation frame)

2. SubtitleCanvas receives time
   └─> Finds active subtitle by time range
   └─> Calculates current word based on word.startTime/endTime

3. Canvas renders with karaoke effect
   └─> Upcoming words: style.upcomingColor
   └─> Current word: style.highlightColor + karaokeBox
   └─> Spoken words: style.color

4. Export uses frame-based rendering
   └─> Each frame rendered to PNG with SubtitleCanvas
   └─> FFmpeg overlays PNGs on video for pixel-perfect output
```

### Project Persistence Flow

```
1. User edits trigger auto-save
   └─> projectStore actions call set({ ..., updatedAt: Date.now() })

2. Save to disk (manual or auto)
   └─> window.api.project.save(project)
   └─> Main process writes to ~/Library/Application Support/opensub/projects/

3. Project list on home screen
   └─> window.api.project.list() → StoredProjectMeta[]
   └─> Shows thumbnails, duration, last modified

4. Loading a project
   └─> window.api.project.load(id) → StoredProject
   └─> projectStore.loadProject(storedProject)
```

## Testing Workflow

### Manual Testing Checklist

1. **Video Import**: Drag/drop video file into DropZone
2. **Transcription**: Verify Python service starts, progress updates display
3. **Subtitle Editing**: Edit text inline, verify words update
4. **Timeline Editing**: Drag subtitle edges, verify timing updates
5. **Style Changes**: Modify font, colors, karaoke box settings
6. **Preview**: Play video with subtitles, verify karaoke animation
7. **Export**: Export with burned subtitles, verify output quality

### Debugging Techniques

**Electron DevTools**:
```bash
npm run dev  # Opens with DevTools enabled
# Use Console, Network, and React DevTools tabs
```

**Debug Mode** (shows Python logs in UI):
- In development, debug logging is enabled automatically
- Access via the debug panel in the UI

**Python Service Debugging**:
```bash
cd python-service
source .venv/bin/activate

# Test model loading
python -c "from whisper_service.transcriber import WhisperTranscriber; t = WhisperTranscriber(); t.initialize('large-v3')"

# Test JSON-RPC interface manually
python -m whisper_service.main
# Then paste JSON-RPC requests to stdin
```

**IPC Debugging**:
```typescript
// Add to any renderer component to log all IPC
window.api.debug.onLog((entry) => {
  console.log(`[${entry.category}] ${entry.message}`, entry.data)
})
```

## Troubleshooting

### Development Issues

| Issue | Solution |
|-------|----------|
| Python service won't start | Verify `.venv` exists in `python-service/`, run `source .venv/bin/activate && pip install -r requirements.txt` |
| FFmpeg errors (dev) | Ensure FFmpeg is installed: `brew install ffmpeg` |
| Transcription hangs | Check Python stderr logs, may need more VRAM/RAM. Model download can take several minutes on first run. |
| Hot reload not working | Restart `npm run dev`, check for syntax errors |
| Type errors | Run `npm run typecheck` to identify issues |
| Video won't play | Check `media://` protocol registration in main process. Ensure video path is absolute. |
| Store updates not reflecting | Check if you're destructuring correctly from Zustand stores. Use `const { value } = useStore()` not `const store = useStore()` |

### Standalone Build Issues

| Issue | Solution |
|-------|----------|
| `setup:python` fails | Delete `build-resources/` and retry; ensure internet connection; check disk space (needs ~3GB) |
| Python not found in production | Check `WhisperService.ts` path resolution; verify `python-env` exists in `Contents/Resources/` |
| `ModuleNotFoundError` in production | Ensure `PYTHONHOME` is set correctly; stdlib may be missing from `python-env/lib/python3.12/` |
| FFmpeg not found in production | Check `asarUnpack` in `electron-builder.yml`; FFmpeg must be unpacked from ASAR |
| App not launching (macOS) | Security settings may block; right-click → Open, or allow in System Settings → Security |
| Signing/Notarization fails | Ensure Apple Developer certs are installed; check `scripts/notarize.cjs` config |

### Common Error Messages

**"Cannot find module 'whisper_service'"**
- PYTHONPATH not set correctly
- Check `WhisperService.ts` → `getServiceDir()` returns correct path

**"Python not found at: ..."**
- In dev: Create venv with `cd python-service && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt`
- In prod: Run `npm run setup:python` before `npm run dist`

**"Error: ENOENT: no such file or directory"**
- File path may contain special characters
- Ensure path is absolute, not relative
- Check if temp file was cleaned up prematurely

**"WhisperService startup timeout"**
- Model download taking too long (first run can take 5+ minutes)
- Check network connection
- Insufficient disk space for models (~2-4GB per model)

### Python Path Debugging

In the Electron main process, `WhisperService.ts` has these key methods:

```typescript
// Path to Python executable
getPythonPath()
// Dev: python-service/.venv/bin/python
// Prod: Resources/python-env/bin/python3

// PYTHONHOME environment variable (production only)
getPythonHome()
// Returns: Resources/python-env/

// Service script path
getServicePath()
// Dev: python-service/whisper_service/main.py
// Prod: Resources/python-service/whisper_service/main.py
```

**Debug logging** shows all resolved paths at startup. Check the debug panel in the app or console output in development.

### Performance Troubleshooting

| Symptom | Possible Cause | Solution |
|---------|----------------|----------|
| Slow transcription | CPU fallback instead of GPU | Ensure Apple Silicon Mac; check `device: 'mps'` in config |
| UI freezes during export | Large video + frame rendering | Frame rendering runs in batches; this is expected for 4K videos |
| High memory usage | Long video loaded | WaveSurfer.js loads entire waveform; expected for videos >30min |
| Choppy video playback | Large resolution video | Use proxy workflow or lower resolution preview |

## Internationalization (i18n)

OpenSub supports multiple languages using `react-i18next`. The i18n system is configured in `src/renderer/i18n/`.

### Supported Languages

| Language | Code | Status |
|----------|------|--------|
| German | `de` | Default, primary |
| English | `en` | Full support |

### i18n Architecture

```
src/renderer/i18n/
├── index.ts           # i18next configuration and exports
└── locales/
    ├── de.json        # German translations (primary)
    └── en.json        # English translations
```

**Configuration** (`src/renderer/i18n/index.ts`):
- Uses `i18next-browser-languagedetector` for automatic language detection
- Detection order: localStorage → browser/system language → fallback (German)
- Language preference stored in localStorage as `opensub-language`
- Exports helper functions: `changeLanguage()`, `getCurrentLanguage()`, `isLanguageSupported()`

### Using Translations in Components

```typescript
import { useTranslation } from 'react-i18next'

export default function MyComponent() {
  const { t } = useTranslation()

  return (
    <div>
      <h1>{t('settings.title')}</h1>
      <p>{t('common.loading')}</p>

      {/* With interpolation */}
      <span>{t('subtitleList.subtitleCount', { count: 5 })}</span>

      {/* Pluralization (uses _one, _other suffixes) */}
      <span>{t('styleProfiles.profileCount', { count })}</span>
    </div>
  )
}
```

### Translation Key Structure

Keys are organized hierarchically by feature area:

```json
{
  "common": {           // Shared UI elements (buttons, labels)
    "loading": "...",
    "cancel": "...",
    "save": "..."
  },
  "dropZone": { ... },  // Video import component
  "settings": { ... },  // Settings panel
  "export": { ... },    // Export dialog
  "styleEditor": { ... }, // Style customization
  "transcription": { ... }, // Transcription progress
  "diffPreview": { ... }  // AI correction preview
}
```

### Adding a New Language

1. Create new locale file: `src/renderer/i18n/locales/fr.json`
2. Copy structure from `de.json` and translate all strings
3. Register in `src/renderer/i18n/index.ts`:

```typescript
import fr from './locales/fr.json'

export const SUPPORTED_LANGUAGES = ['de', 'en', 'fr'] as const

export const LANGUAGE_NAMES: Record<SupportedLanguage, string> = {
  de: 'Deutsch',
  en: 'English',
  fr: 'Français'
}

// In i18n.init():
resources: {
  de: { translation: de },
  en: { translation: en },
  fr: { translation: fr }
}
```

### Adding New Translation Keys

1. Add to **all** locale files (`de.json` and `en.json`)
2. Use nested structure matching the feature area
3. Support interpolation for dynamic values: `"message": "Found {{count}} items"`
4. Support pluralization with suffixes: `"item_one": "1 item"`, `"item_other": "{{count}} items"`

## AI Correction Feature

OpenSub includes an AI-powered subtitle correction feature that uses Google's Gemini model via OpenRouter to analyze audio and fix transcription errors.

### Architecture Overview

```
StyleEditor → Start AI Correction
     ↓
Main Process (analysis-handlers.ts)
     ↓
OpenRouterService.ts → OpenRouter API → Gemini 3.0 Flash
     ↓
DiffPreview Component → User reviews changes
     ↓
projectStore.applyChanges() → WhisperX alignment (or Gemini fallback)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/services/OpenRouterService.ts` | OpenRouter API client, audio analysis |
| `src/main/ipc/analysis-handlers.ts` | IPC handlers for AI analysis |
| `src/renderer/components/DiffPreview/` | Change review UI |
| `src/renderer/components/AnalysisProgress/` | Analysis progress display |
| `src/renderer/utils/wordTimingUtils.ts` | Word timing realignment after edits |

### How It Works

1. **Audio Extraction**: FFmpeg extracts MP3 from video
2. **API Call**: Audio sent to Gemini via OpenRouter with transcription context
3. **Change Detection**: AI identifies errors (spelling, grammar, names, punctuation)
4. **Diff Preview**: User reviews each suggested change
5. **Word Realignment**: Accepted changes are realigned using WhisperX (local) or Gemini fallback

### Configuration

The AI correction feature requires an OpenRouter API key:

```env
# .env file in project root (or set in Settings UI)
OPENROUTER_API_KEY=your_api_key_here
```

The API key can also be set via the Settings panel in the app UI.

### Change Types

The AI categorizes corrections into types:

| Type | Description |
|------|-------------|
| `spelling` | Spelling mistakes |
| `grammar` | Grammar errors |
| `context` | Words misrecognized based on context |
| `name` | Proper nouns, names, brand names |
| `punctuation` | Missing/incorrect punctuation |

### Adding IPC Handlers for AI Features

Follow the standard IPC pattern (see "Adding a New IPC Channel" above), with these specifics:

```typescript
// src/main/ipc/analysis-handlers.ts
ipcMain.handle(IPC_CHANNELS.ANALYZE_SUBTITLES, async (_event, { audioPath, subtitles, language }) => {
  const service = new OpenRouterService({
    apiKey: settings.openRouterApiKey,
    model: 'google/gemini-2.0-flash-001'  // Supports audio input
  })

  service.on('progress', (progress) => {
    mainWindow?.webContents.send(IPC_CHANNELS.ANALYSIS_PROGRESS, progress)
  })

  return await service.analyze(audioPath, subtitles, language)
})
```

### Word Timing Realignment

After text changes are applied, word timings need to be recalculated:

1. **Primary**: WhisperX forced alignment (local, fast)
2. **Fallback**: Gemini word timing (via OpenRouter, when WhisperX fails)

```typescript
// src/renderer/utils/wordTimingUtils.ts
export async function realignWordsForSubtitle(
  subtitle: Subtitle,
  audioPath: string
): Promise<Word[]> {
  // Try WhisperX first
  const result = await window.api.whisper.align(subtitle.text, audioPath, ...)
  if (result.success) return result.words

  // Fallback to Gemini
  return await window.api.analysis.getWordTimings({ ... })
}
```

## Style Profiles

OpenSub supports saving and loading subtitle style profiles for quick style switching.

### Profile Storage

Profiles are stored in the user's application data directory:
- **macOS**: `~/Library/Application Support/opensub/style-profiles/`

Each profile is saved as a JSON file containing the complete `SubtitleStyle` object.

### Profile Operations

| Operation | IPC Channel | Handler |
|-----------|-------------|---------|
| List profiles | `style-profiles:list` | Returns `StyleProfile[]` |
| Save profile | `style-profiles:save` | Saves current style with name |
| Load profile | `style-profiles:load` | Applies profile to current project |
| Delete profile | `style-profiles:delete` | Removes profile file |
| Export profile | `style-profiles:export` | Saves to user-chosen location |
| Import profile | `style-profiles:import` | Loads from user-chosen file |

### Profile Validation

On import, profiles are validated and migrated:
- Unknown properties are stripped
- Missing properties are filled with defaults from `DEFAULT_SUBTITLE_STYLE`
- Version mismatches are handled gracefully
