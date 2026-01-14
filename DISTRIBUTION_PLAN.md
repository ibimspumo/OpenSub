# OpenSub Distribution Plan

## Ziel

OpenSub soll als eigenständige Desktop-Anwendung verteilt werden, die **ohne technische Vorkenntnisse** (kein Terminal, kein Python, kein Git) installiert und genutzt werden kann.

**Idealer Ablauf für Endnutzer:**
1. DMG-Datei herunterladen
2. App in Applications ziehen
3. App starten
4. (Beim ersten Mal: KI-Modelle werden automatisch heruntergeladen)
5. Fertig - App ist einsatzbereit

---

## Aktuelle Architektur

```
┌─────────────────────────────────────────────────────────────────┐
│                        OpenSub App                               │
├─────────────────────────────────────────────────────────────────┤
│  Renderer Process (React)                                        │
│  └── UI, Video-Player, Timeline, Subtitle-Editor                │
├─────────────────────────────────────────────────────────────────┤
│  Main Process (Electron/Node.js)                                 │
│  ├── FFmpegService (Video/Audio-Verarbeitung)                   │
│  └── WhisperService (Python-Subprocess-Management)              │
├─────────────────────────────────────────────────────────────────┤
│  Python Service (Subprocess)                                     │
│  ├── WhisperX-MLX (Transkription)                               │
│  ├── wav2vec2 (Wort-Alignment)                                  │
│  └── pyannote.audio (Speaker-Diarization) [optional]            │
└─────────────────────────────────────────────────────────────────┘
```

---

## Abhängigkeiten-Analyse

### 1. Electron App + Node.js Dependencies

| Status | Komponente | Größe | Anmerkung |
|--------|-----------|-------|-----------|
| ✅ Gelöst | Electron Runtime | ~150 MB | Wird durch electron-builder gebündelt |
| ✅ Gelöst | React + Zustand + Tailwind | ~5 MB | Im Bundle enthalten |
| ✅ Gelöst | better-sqlite3 | ~2 MB | Native Module, wird rebuilt |

### 2. FFmpeg/FFprobe

| Status | Komponente | Größe | Anmerkung |
|--------|-----------|-------|-----------|
| ✅ Gelöst | @ffmpeg-installer/ffmpeg | ~70 MB | Bereits in electron-builder.yml konfiguriert |
| ✅ Gelöst | @ffprobe-installer/ffprobe | ~50 MB | Wird aus ASAR entpackt |

**Aktuelle Konfiguration in `electron-builder.yml`:**
```yaml
asarUnpack:
  - "**/node_modules/@ffmpeg-installer/**/*"
  - "**/node_modules/@ffprobe-installer/**/*"
```

### 3. Python-Umgebung

| Status | Komponente | Größe | Anmerkung |
|--------|-----------|-------|-----------|
| ❌ Offen | Python Runtime | ~50 MB | Muss gebündelt werden |
| ❌ Offen | PyTorch | ~355 MB | Für CPU/MPS Inference |
| ❌ Offen | MLX Framework | ~144 MB | Apple Silicon Acceleration |
| ❌ Offen | transformers | ~115 MB | HuggingFace Bibliothek |
| ❌ Offen | Weitere Deps | ~800 MB | scipy, pandas, numpy, etc. |
| **Gesamt** | **.venv komplett** | **~1.5 GB** | |

### 4. KI-Modelle

| Status | Modell | Größe | Zweck |
|--------|--------|-------|-------|
| ❌ Offen | whisper-large-v3-mlx | ~2.9 GB | Transkription |
| ❌ Offen | wav2vec2 Alignment | ~400 MB | Wort-Zeitstempel |
| ❌ Offen | pyannote Segmentation | ~20 MB | Speaker-Diarization |
| **Gesamt** | | **~3.3 GB** | |

---

## Empfohlene Strategie: Hybrid-Bundling

### Konzept

```
┌─────────────────────────────────────────────────────────────────┐
│                    DMG/Installer (~1.7 GB)                       │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Electron App                                                 │
│  ✅ FFmpeg/FFprobe (gebündelt)                                  │
│  ✅ Python Runtime (python-build-standalone)                    │
│  ✅ Python Packages (vorinstalliert)                            │
│  ❌ KI-Modelle (werden bei erstem Start geladen)                │
└─────────────────────────────────────────────────────────────────┘

                              ↓ Erster Start

┌─────────────────────────────────────────────────────────────────┐
│              Automatischer Modell-Download (~3.3 GB)             │
├─────────────────────────────────────────────────────────────────┤
│  • Progress-Bar in der App                                       │
│  • Modellauswahl (large/medium/small)                           │
│  • Download in ~/.cache/huggingface/                            │
│  • Kann jederzeit pausiert/fortgesetzt werden                   │
└─────────────────────────────────────────────────────────────────┘
```

### Vorteile dieser Strategie

1. **Installer-Größe vertretbar** (~1.7 GB statt ~5 GB)
2. **Nutzer kann Modellgröße wählen** (Qualität vs. Speicherplatz)
3. **Modell-Updates unabhängig** von App-Updates
4. **Kein Terminal nötig** - alles in der App

---

## Implementierungsplan

### Phase 1: Python-Bundling-Infrastruktur

#### 1.1 python-build-standalone integrieren

**Ziel:** Portable Python-Distribution für macOS ARM64 einbinden

**Aufgaben:**
- [ ] Download python-build-standalone Release für `aarch64-apple-darwin`
- [ ] Extrahieren nach `build-resources/python-standalone/`
- [ ] `.gitignore` anpassen (große Binaries nicht committen)
- [ ] Download-Script für CI/CD erstellen

**Dateistruktur:**
```
build-resources/
└── python-standalone/
    └── python/
        ├── bin/
        │   └── python3.11
        ├── lib/
        │   └── python3.11/
        └── ...
```

**Script: `scripts/download-python.sh`**
```bash
#!/bin/bash
VERSION="3.11.9"
RELEASE="20240726"
URL="https://github.com/indygreg/python-build-standalone/releases/download/${RELEASE}/cpython-${VERSION}+${RELEASE}-aarch64-apple-darwin-install_only.tar.gz"

mkdir -p build-resources
curl -L "$URL" | tar xz -C build-resources/python-standalone
```

#### 1.2 Build-Zeit venv erstellen

**Ziel:** Python-Pakete zur Build-Zeit installieren

**Script: `scripts/setup-python-env.sh`**
```bash
#!/bin/bash
PYTHON_DIR="build-resources/python-standalone/python"
VENV_DIR="build-resources/python-env"

# Venv erstellen
$PYTHON_DIR/bin/python3 -m venv $VENV_DIR

# Packages installieren
$VENV_DIR/bin/pip install --upgrade pip
$VENV_DIR/bin/pip install -r python-service/requirements.txt

# Cleanup: Cache und unnötige Dateien entfernen
find $VENV_DIR -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null
find $VENV_DIR -type f -name "*.pyc" -delete
```

#### 1.3 electron-builder.yml anpassen

```yaml
extraResources:
  # Python Service Code
  - from: python-service/whisper_service
    to: python-service/whisper_service
    filter:
      - "**/*"
      - "!__pycache__/**"
      - "!*.pyc"

  # Gebündelte Python-Umgebung
  - from: build-resources/python-env
    to: python-env
    filter:
      - "**/*"
      - "!**/__pycache__/**"
      - "!**/*.pyc"
      - "!**/pip/**"
      - "!**/setuptools/**"
```

#### 1.4 WhisperService.ts anpassen

**Änderungen in `src/main/services/WhisperService.ts`:**

```typescript
private getPythonPath(): string {
  const isDev = !app.isPackaged

  if (isDev) {
    // Development: lokale venv
    return path.join(app.getAppPath(), 'python-service', '.venv', 'bin', 'python')
  }

  // Production: gebündelte Python-Umgebung
  return path.join(process.resourcesPath, 'python-env', 'bin', 'python3')
}

private getServicePath(): string {
  const isDev = !app.isPackaged

  if (isDev) {
    return path.join(app.getAppPath(), 'python-service', 'whisper_service', 'main.py')
  }

  return path.join(process.resourcesPath, 'python-service', 'whisper_service', 'main.py')
}
```

---

### Phase 2: First-Run & Model-Download UI

#### 2.1 Model-Status prüfen

**Neue Datei: `src/main/services/ModelManager.ts`**

```typescript
import { app } from 'electron'
import path from 'path'
import fs from 'fs'

interface ModelInfo {
  id: string
  name: string
  size: string
  sizeBytes: number
  quality: 'high' | 'medium' | 'low'
  downloaded: boolean
}

export class ModelManager {
  private cacheDir: string

  constructor() {
    this.cacheDir = path.join(app.getPath('home'), '.cache', 'huggingface', 'hub')
  }

  getAvailableModels(): ModelInfo[] {
    return [
      {
        id: 'mlx-community/whisper-large-v3-mlx',
        name: 'Whisper Large V3',
        size: '2.9 GB',
        sizeBytes: 2.9 * 1024 * 1024 * 1024,
        quality: 'high',
        downloaded: this.isModelDownloaded('mlx-community--whisper-large-v3-mlx')
      },
      {
        id: 'mlx-community/whisper-medium-mlx',
        name: 'Whisper Medium',
        size: '1.5 GB',
        sizeBytes: 1.5 * 1024 * 1024 * 1024,
        quality: 'medium',
        downloaded: this.isModelDownloaded('mlx-community--whisper-medium-mlx')
      },
      {
        id: 'mlx-community/whisper-small-mlx',
        name: 'Whisper Small',
        size: '0.5 GB',
        sizeBytes: 0.5 * 1024 * 1024 * 1024,
        quality: 'low',
        downloaded: this.isModelDownloaded('mlx-community--whisper-small-mlx')
      }
    ]
  }

  isModelDownloaded(modelFolder: string): boolean {
    const modelPath = path.join(this.cacheDir, `models--${modelFolder}`)
    return fs.existsSync(modelPath)
  }

  hasAnyModelDownloaded(): boolean {
    return this.getAvailableModels().some(m => m.downloaded)
  }
}
```

#### 2.2 First-Run Detection

**Änderungen in `src/main/index.ts`:**

```typescript
import { ModelManager } from './services/ModelManager'

async function checkFirstRun(): Promise<boolean> {
  const modelManager = new ModelManager()
  return !modelManager.hasAnyModelDownloaded()
}

app.whenReady().then(async () => {
  const isFirstRun = await checkFirstRun()

  if (isFirstRun) {
    // Zeige Setup-Wizard
    createSetupWindow()
  } else {
    // Normale App starten
    createMainWindow()
  }
})
```

#### 2.3 Setup-Wizard UI

**Neue Komponente: `src/renderer/components/Setup/SetupWizard.tsx`**

```tsx
import { useState, useEffect } from 'react'

interface ModelOption {
  id: string
  name: string
  size: string
  quality: string
  recommended?: boolean
}

export default function SetupWizard() {
  const [step, setStep] = useState<'welcome' | 'model' | 'downloading' | 'complete'>('welcome')
  const [selectedModel, setSelectedModel] = useState<string>('mlx-community/whisper-large-v3-mlx')
  const [progress, setProgress] = useState(0)

  const models: ModelOption[] = [
    { id: 'mlx-community/whisper-large-v3-mlx', name: 'Large V3', size: '2.9 GB', quality: 'Beste Qualität', recommended: true },
    { id: 'mlx-community/whisper-medium-mlx', name: 'Medium', size: '1.5 GB', quality: 'Gute Qualität' },
    { id: 'mlx-community/whisper-small-mlx', name: 'Small', size: '0.5 GB', quality: 'Schnellste' }
  ]

  const startDownload = async () => {
    setStep('downloading')
    // IPC call zum Python-Service für Model-Download
    window.api.models.download(selectedModel, (p: number) => setProgress(p))
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
      {step === 'welcome' && (
        <div className="text-center max-w-lg">
          <h1 className="text-3xl font-bold text-white mb-4">
            Willkommen bei OpenSub
          </h1>
          <p className="text-gray-400 mb-8">
            Bevor du loslegst, müssen wir die KI-Modelle für die
            Spracherkennung herunterladen.
          </p>
          <button
            onClick={() => setStep('model')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Weiter
          </button>
        </div>
      )}

      {step === 'model' && (
        <div className="max-w-lg w-full">
          <h2 className="text-2xl font-bold text-white mb-4">
            Wähle ein Modell
          </h2>
          <div className="space-y-3 mb-6">
            {models.map(model => (
              <button
                key={model.id}
                onClick={() => setSelectedModel(model.id)}
                className={`w-full p-4 rounded-lg border-2 text-left transition ${
                  selectedModel === model.id
                    ? 'border-blue-500 bg-blue-500/10'
                    : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="text-white font-medium">
                      {model.name}
                      {model.recommended && (
                        <span className="ml-2 text-xs bg-blue-600 px-2 py-0.5 rounded">
                          Empfohlen
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-sm">{model.quality}</div>
                  </div>
                  <div className="text-gray-500 text-sm">{model.size}</div>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={startDownload}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Modell herunterladen
          </button>
        </div>
      )}

      {step === 'downloading' && (
        <div className="max-w-lg w-full text-center">
          <h2 className="text-2xl font-bold text-white mb-4">
            Modell wird heruntergeladen...
          </h2>
          <div className="w-full bg-gray-700 rounded-full h-4 mb-4">
            <div
              className="bg-blue-600 h-4 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-400">{progress.toFixed(0)}%</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="text-center">
          <div className="text-6xl mb-4">✓</div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Einrichtung abgeschlossen!
          </h2>
          <button
            onClick={() => window.api.app.startMainApp()}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            OpenSub starten
          </button>
        </div>
      )}
    </div>
  )
}
```

#### 2.4 IPC-Handlers für Model-Download

**Neue Datei: `src/main/ipc/model-handlers.ts`**

```typescript
import { ipcMain } from 'electron'
import { ModelManager } from '../services/ModelManager'

export function registerModelHandlers() {
  const modelManager = new ModelManager()

  ipcMain.handle('models:list', () => {
    return modelManager.getAvailableModels()
  })

  ipcMain.handle('models:download', async (event, modelId: string) => {
    // Der Download passiert eigentlich automatisch beim ersten
    // Laden des Modells durch HuggingFace. Wir können aber
    // einen "Warmup" durchführen.
    return modelManager.triggerModelDownload(modelId, (progress) => {
      event.sender.send('models:progress', progress)
    })
  })

  ipcMain.handle('models:check', () => {
    return modelManager.hasAnyModelDownloaded()
  })
}
```

---

### Phase 3: Code-Signing & Notarisierung

#### 3.1 Entitlements erstellen

**Neue Datei: `build/entitlements.mac.plist`**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <!-- Erlaubt JIT-Kompilierung (für PyTorch/MLX) -->
    <key>com.apple.security.cs.allow-jit</key>
    <true/>

    <!-- Erlaubt unsignierten ausführbaren Code im Speicher -->
    <key>com.apple.security.cs.allow-unsigned-executable-memory</key>
    <true/>

    <!-- Erlaubt das Laden von Plugins/Dylibs -->
    <key>com.apple.security.cs.disable-library-validation</key>
    <true/>
</dict>
</plist>
```

#### 3.2 electron-builder.yml erweitern

```yaml
mac:
  category: public.app-category.video
  target:
    - target: dmg
      arch: arm64
  hardenedRuntime: true
  gatekeeperAssess: false
  entitlements: build/entitlements.mac.plist
  entitlementsInherit: build/entitlements.mac.plist
  icon: resources/icon.icns

  # Alle Python-Binaries signieren
  binaries:
    - python-env/bin/python3
    - python-env/bin/python3.11

afterSign: scripts/notarize.js
```

#### 3.3 Notarisierungs-Script

**Neue Datei: `scripts/notarize.js`**

```javascript
const { notarize } = require('@electron/notarize')
const path = require('path')

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context

  if (electronPlatformName !== 'darwin') {
    return
  }

  // Nur in CI oder wenn Credentials vorhanden
  if (!process.env.APPLE_ID || !process.env.APPLE_APP_SPECIFIC_PASSWORD) {
    console.log('Skipping notarization - no credentials')
    return
  }

  const appName = context.packager.appInfo.productFilename
  const appPath = path.join(appOutDir, `${appName}.app`)

  console.log(`Notarizing ${appPath}...`)

  await notarize({
    appPath,
    appleId: process.env.APPLE_ID,
    appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
    teamId: process.env.APPLE_TEAM_ID
  })

  console.log('Notarization complete!')
}
```

#### 3.4 Erforderliche Umgebungsvariablen

```bash
# Für Code-Signing
export CSC_LINK="path/to/certificate.p12"
export CSC_KEY_PASSWORD="certificate-password"

# Für Notarisierung
export APPLE_ID="your@apple.id"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"
```

---

### Phase 4: Build-Pipeline

#### 4.1 package.json Scripts erweitern

```json
{
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "build:mac": "npm run build && electron-builder --mac",

    "setup:python": "bash scripts/download-python.sh && bash scripts/setup-python-env.sh",
    "prebuild:mac": "npm run setup:python",

    "dist": "npm run setup:python && npm run build && electron-builder --mac",
    "dist:signed": "npm run dist"
  }
}
```

#### 4.2 GitHub Actions Workflow

**Neue Datei: `.github/workflows/build.yml`**

```yaml
name: Build macOS App

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    runs-on: macos-14  # Apple Silicon Runner

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Download Python standalone
        run: bash scripts/download-python.sh

      - name: Setup Python environment
        run: bash scripts/setup-python-env.sh

      - name: Build & Sign
        env:
          CSC_LINK: ${{ secrets.MAC_CERTIFICATE }}
          CSC_KEY_PASSWORD: ${{ secrets.MAC_CERTIFICATE_PASSWORD }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_APP_SPECIFIC_PASSWORD: ${{ secrets.APPLE_APP_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        run: npm run dist:signed

      - name: Upload artifact
        uses: actions/upload-artifact@v4
        with:
          name: OpenSub-macOS
          path: dist-electron/*.dmg
```

---

## Verzeichnisstruktur nach Implementierung

```
opensub/
├── .github/
│   └── workflows/
│       └── build.yml
├── build/
│   └── entitlements.mac.plist
├── build-resources/           # Zur Build-Zeit erstellt
│   ├── python-standalone/     # Portable Python
│   └── python-env/            # Venv mit allen Packages
├── python-service/
│   ├── whisper_service/
│   └── requirements.txt
├── resources/
│   └── icon.icns
├── scripts/
│   ├── download-python.sh
│   ├── setup-python-env.sh
│   └── notarize.js
├── src/
│   ├── main/
│   │   ├── services/
│   │   │   ├── WhisperService.ts
│   │   │   ├── ModelManager.ts      # NEU
│   │   │   └── FFmpegService.ts
│   │   └── ipc/
│   │       └── model-handlers.ts    # NEU
│   ├── preload/
│   └── renderer/
│       └── components/
│           └── Setup/
│               └── SetupWizard.tsx  # NEU
├── electron-builder.yml
└── package.json
```

---

## Checkliste

### Phase 1: Python-Bundling
- [ ] `scripts/download-python.sh` erstellen
- [ ] `scripts/setup-python-env.sh` erstellen
- [ ] `electron-builder.yml` anpassen
- [ ] `WhisperService.ts` für gebündelte Pfade anpassen
- [ ] Lokaler Build-Test ohne .venv

### Phase 2: First-Run UI
- [ ] `ModelManager.ts` implementieren
- [ ] `model-handlers.ts` für IPC
- [ ] `SetupWizard.tsx` Komponente
- [ ] Preload-Script erweitern
- [ ] First-Run Detection in `index.ts`

### Phase 3: Code-Signing
- [ ] Apple Developer Account einrichten
- [ ] `entitlements.mac.plist` erstellen
- [ ] `notarize.js` Script
- [ ] Zertifikate als GitHub Secrets hinterlegen

### Phase 4: CI/CD
- [ ] GitHub Actions Workflow erstellen
- [ ] Secrets konfigurieren
- [ ] Erster automatischer Release-Build

### Phase 5: Testing
- [ ] Test auf frischem Mac ohne Xcode
- [ ] Test ohne Python-Installation
- [ ] Test des Modell-Downloads
- [ ] Test der Transkription
- [ ] Gatekeeper-Test (App aus Internet)

---

## Offene Fragen / Entscheidungen

### 1. HuggingFace Token für Speaker-Diarization

**Optionen:**
- **A)** Diarization entfernen (kein Token nötig)
- **B)** Token in Einstellungen eingeben lassen
- **C)** Eigener Proxy-Server für Downloads

**Empfehlung:** Option B - Token-Eingabe in den Einstellungen, Diarization ist optional.

### 2. Modell-Updates

**Frage:** Wie werden neue Modellversionen verteilt?

**Empfehlung:** Modelle bleiben im HuggingFace-Cache. Die App kann optional prüfen, ob neuere Versionen verfügbar sind.

### 3. Offline-Modus

**Frage:** Soll die App auch ohne Internet funktionieren (nach initialem Setup)?

**Antwort:** Ja - nach dem Modell-Download funktioniert alles lokal.

---

## Geschätzte Größen

| Komponente | Entwicklung | Produktion |
|------------|-------------|------------|
| DMG-Download | - | ~1.7 GB |
| Installierte App | - | ~1.8 GB |
| KI-Modelle (large-v3) | - | +2.9 GB |
| **Gesamt auf Festplatte** | - | **~4.7 GB** |

---

## Zeitplan-Empfehlung

1. **Phase 1** (Python-Bundling): Zuerst implementieren, da Basis für alles
2. **Phase 2** (First-Run UI): Danach, für bessere UX
3. **Phase 3** (Signing): Parallel zu Phase 2 möglich
4. **Phase 4** (CI/CD): Nach erfolgreichem lokalem Build
5. **Phase 5** (Testing): Kontinuierlich, aber intensiv vor Release

---

## Referenzen

- [python-build-standalone Releases](https://github.com/indygreg/python-build-standalone/releases)
- [Bundling Python in Electron](https://til.simonwillison.net/electron/python-inside-electron)
- [Electron Code Signing macOS](https://www.electronforge.io/guides/code-signing/code-signing-macos)
- [Electron Notarization](https://til.simonwillison.net/electron/sign-notarize-electron-macos)
- [WhisperX-MLX](https://github.com/m-bain/whisperX)
- [MLX Whisper Models](https://huggingface.co/mlx-community)
