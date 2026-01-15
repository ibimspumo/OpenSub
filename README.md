# OpenSub

Ein professioneller Desktop-Untertiteleditor mit KI-gestützter Transkription. Erstelle, bearbeite und gestalte Untertitel mit Wort-für-Wort-Timing-Präzision – ähnlich wie Descript.

![OpenSub Editor](https://img.shields.io/badge/Plattform-macOS-blue) ![Lizenz](https://img.shields.io/badge/Lizenz-MIT-green) ![Electron](https://img.shields.io/badge/Electron-28-47848F)

---

## Inhaltsverzeichnis

1. [Überblick](#überblick)
2. [Funktionen](#funktionen)
3. [Systemvoraussetzungen](#systemvoraussetzungen)
4. [Installation – Schritt für Schritt](#installation--schritt-für-schritt)
   - [Voraussetzungen installieren](#1-voraussetzungen-installieren)
   - [Projekt herunterladen](#2-projekt-herunterladen)
   - [Node.js-Abhängigkeiten installieren](#3-nodejs-abhängigkeiten-installieren)
   - [Python-Umgebung einrichten](#4-python-umgebung-einrichten)
   - [HuggingFace-Token einrichten](#5-huggingface-token-einrichten-optional)
   - [Installation überprüfen](#6-installation-überprüfen)
5. [Fehlerbehebung](#fehlerbehebung)
6. [Verwendung](#verwendung)
7. [Entwicklung](#entwicklung)
8. [Architektur](#architektur)
9. [Lizenz](#lizenz)

---

## Überblick

OpenSub ist eine Desktop-Anwendung für macOS, die KI-gestützte Spracherkennung nutzt, um automatisch Untertitel aus Videos zu generieren. Die App verwendet WhisperX (basierend auf OpenAIs Whisper) und ist speziell für Apple Silicon Macs (M1/M2/M3/M4) optimiert.

### Was macht OpenSub?

1. **Video importieren** – Ziehe einfach eine Videodatei in die App
2. **Automatische Transkription** – WhisperX transkribiert den gesprochenen Text mit präzisem Wort-Timing
3. **Untertitel bearbeiten** – Texte korrigieren, Timing anpassen, Stil gestalten
4. **Exportieren** – Als Untertiteldatei (ASS/SRT) oder direkt ins Video eingebrannt

---

## Funktionen

### KI-gestützte Transkription
- **WhisperX Integration** – Modernste Spracherkennung basierend auf OpenAIs Whisper
- **Wort-genaues Timing** – Präzise Zeitstempel für jedes einzelne Wort (Karaoke-Effekt)
- **Sprechererkennung** – Automatische Identifikation verschiedener Sprecher (pyannote.audio)
- **Mehrsprachig** – Unterstützung für über 99 Sprachen
- **GPU-beschleunigt** – Optimiert für Apple Silicon mit Metal Performance Shaders (MPS)

### Professionelle Untertitelbearbeitung
- **Visuelle Timeline** – Wellenform-Darstellung für präzises Timing
- **Drag & Drop** – Video einfach hineinziehen zum Starten
- **Echtzeit-Vorschau** – Untertitel werden live auf dem Video angezeigt
- **Segment-Bearbeitung** – Untertitel teilen, zusammenfügen und anpassen

### Erweiterte Gestaltung
- **Schriftarten & Farben** – Volle Kontrolle über Typografie
- **Karaoke-Animation** – Wort-für-Wort-Hervorhebung synchron zur Sprache
- **Verschiedene Animationen** – Karaoke, Einblenden, Erscheinen, Skalieren
- **Positionierung** – Untertitel frei platzieren mit magnetischen Hilfslinien
- **Umrandung & Schatten** – Professionelle Texteffekte für bessere Lesbarkeit

### Export-Optionen
- **ASS-Format** – Advanced SubStation Alpha mit voller Stilunterstützung
- **SRT-Format** – Universelle Kompatibilität
- **Eingebrannte Untertitel** – Direkt ins Video rendern via FFmpeg

---

## Systemvoraussetzungen

### Unterstützte Systeme

| Komponente | Minimum | Empfohlen |
|------------|---------|-----------|
| **Betriebssystem** | macOS 12 (Monterey) | macOS 13+ (Ventura/Sonoma) |
| **Prozessor** | Intel Mac | Apple Silicon (M1/M2/M3/M4) |
| **Arbeitsspeicher** | 8 GB | 16 GB oder mehr |
| **Festplatte** | 10 GB frei | 20 GB frei (für KI-Modelle) |

> **Hinweis**: Intel Macs werden unterstützt, aber die Transkription läuft nur auf der CPU und ist deutlich langsamer. Apple Silicon Macs nutzen die GPU für bis zu 3x schnellere Verarbeitung.

### Erforderliche Software

Diese Software muss vor der Installation von OpenSub vorhanden sein:

| Software | Version | Zweck |
|----------|---------|-------|
| **Homebrew** | Aktuell | macOS Paketmanager |
| **Node.js** | 18.0+ | JavaScript-Laufzeitumgebung |
| **Python** | 3.10 - 3.12 | KI/ML-Service |
| **FFmpeg** | 6.0+ | Video-/Audioverarbeitung |
| **Git** | Aktuell | Repository klonen |

---

## Installation – Schritt für Schritt

Diese Anleitung führt dich durch die komplette Installation. Folge jeden Schritt der Reihe nach.

### 1. Voraussetzungen installieren

#### 1.1 Terminal öffnen

Drücke `Cmd + Leertaste`, tippe "Terminal" und drücke Enter. Das Terminal ist die Kommandozeile von macOS.

#### 1.2 Homebrew installieren

Homebrew ist ein Paketmanager für macOS, der die Installation von Software vereinfacht.

**Prüfen, ob Homebrew bereits installiert ist:**
```bash
brew --version
```

Wenn eine Versionsnummer erscheint (z.B. "Homebrew 4.2.0"), ist Homebrew bereits installiert. Springe zu Schritt 1.3.

**Homebrew installieren (falls nicht vorhanden):**
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Nach der Installation musst du Homebrew zum PATH hinzufügen. Das Installationsskript zeigt dir am Ende die Befehle an. Für Apple Silicon Macs:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile
eval "$(/opt/homebrew/bin/brew shellenv)"
```

**Installation überprüfen:**
```bash
brew --version
```

> **Fehlerbehebung**: Falls `brew: command not found` erscheint, schließe das Terminal und öffne ein neues. Falls das Problem weiterhin besteht, führe den `echo`-Befehl oben erneut aus.

#### 1.3 Node.js installieren

Node.js wird für die Electron-Desktop-Anwendung benötigt.

**Prüfen, ob Node.js bereits installiert ist:**
```bash
node --version
```

Du brauchst Version 18 oder höher (z.B. "v20.10.0").

**Node.js installieren:**
```bash
brew install node
```

**Installation überprüfen:**
```bash
node --version
npm --version
```

Beide Befehle sollten Versionsnummern ausgeben.

> **Fehlerbehebung**: Falls eine ältere Version installiert ist, aktualisiere mit:
> ```bash
> brew upgrade node
> ```

#### 1.4 Python installieren

Python wird für die KI-Transkription mit WhisperX benötigt.

**Prüfen, ob Python bereits installiert ist:**
```bash
python3 --version
```

Du brauchst Version 3.10, 3.11 oder 3.12. **Python 3.13 wird noch NICHT unterstützt!**

**Python 3.11 installieren (empfohlen):**
```bash
brew install python@3.11
```

**Python als Standard setzen (optional aber empfohlen):**
```bash
echo 'export PATH="/opt/homebrew/opt/python@3.11/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
```

**Installation überprüfen:**
```bash
python3 --version
```

Sollte "Python 3.11.x" oder ähnlich ausgeben.

> **Wichtig**: macOS hat eine vorinstallierte Python-Version unter `/usr/bin/python3`. Diese ist oft veraltet. Verwende immer die Homebrew-Version!
>
> **Fehlerbehebung bei Python-Problemen:**
> - `python3: command not found` → Stelle sicher, dass der PATH korrekt gesetzt ist
> - Falsche Version wird angezeigt → Prüfe mit `which python3`, ob die richtige Installation verwendet wird

#### 1.5 FFmpeg installieren

FFmpeg ist erforderlich für Video- und Audioverarbeitung.

**Prüfen, ob FFmpeg bereits installiert ist:**
```bash
ffmpeg -version
```

**FFmpeg installieren:**
```bash
brew install ffmpeg
```

Die Installation kann einige Minuten dauern, da FFmpeg viele Abhängigkeiten hat.

**Installation überprüfen:**
```bash
ffmpeg -version
ffprobe -version
```

> **Fehlerbehebung:**
> - Falls `ffmpeg: command not found` nach Installation → Terminal neu starten
> - Falls Codec-Fehler auftreten → `brew reinstall ffmpeg`
> - Falls alte Version → `brew upgrade ffmpeg`

#### 1.6 Git installieren (falls nicht vorhanden)

**Prüfen:**
```bash
git --version
```

**Installieren:**
```bash
brew install git
```

---

### 2. Projekt herunterladen

Navigiere zu einem Ordner, in dem du das Projekt speichern möchtest (z.B. Desktop oder Dokumente):

```bash
cd ~/Desktop
```

**Repository klonen:**
```bash
git clone https://github.com/ibimspumo/OpenSub.git
cd OpenSub
```

> **Hinweis**: Falls du das Repository als ZIP heruntergeladen hast, entpacke es und navigiere im Terminal zum entpackten Ordner:
> ```bash
> cd ~/Downloads/opensub-main
> ```

---

### 3. Node.js-Abhängigkeiten installieren

Installiere alle benötigten Node.js-Pakete:

```bash
npm install
```

Dieser Befehl:
- Lädt alle Abhängigkeiten aus `package.json` herunter
- Kompiliert native Module (better-sqlite3) für Electron
- Kann 2-5 Minuten dauern

**Mögliche Fehler und Lösungen:**

#### Fehler: `npm ERR! code EACCES` (Berechtigungsfehler)
```bash
# Lösung: npm-Ordner-Berechtigungen korrigieren
sudo chown -R $(whoami) ~/.npm
npm install
```

#### Fehler: `better-sqlite3` Build-Fehler
```bash
# Lösung: Xcode Command Line Tools installieren
xcode-select --install

# Danach erneut versuchen
npm install
```

#### Fehler: `node-gyp` Fehler
Dies tritt auf, wenn native Module nicht kompiliert werden können.

```bash
# Lösung 1: Xcode Tools neu installieren
sudo rm -rf /Library/Developer/CommandLineTools
xcode-select --install

# Lösung 2: node-gyp direkt installieren
npm install -g node-gyp

# Danach erneut versuchen
npm install
```

#### Fehler: Node-Version inkompatibel
```bash
# Prüfen welche Version läuft
node --version

# Falls nötig, Node.js aktualisieren
brew upgrade node
```

**Native Module neu kompilieren (falls nötig):**

Falls die App nach Installation nicht startet und Fehler wie "NODE_MODULE_VERSION mismatch" auftreten:

```bash
npm run postinstall
# oder manuell:
npx @electron/rebuild -f -w better-sqlite3
```

---

### 4. Python-Umgebung einrichten

Die Python-Umgebung ist für die KI-Transkription erforderlich.

#### 4.1 Zum Python-Service-Ordner navigieren

```bash
cd python-service
```

#### 4.2 Virtuelle Umgebung erstellen

Eine virtuelle Umgebung isoliert die Python-Pakete vom System:

```bash
python3 -m venv venv
```

> **Fehler: `ensurepip` ist nicht verfügbar**
> ```bash
> # Lösung für macOS
> python3 -m venv venv --without-pip
> source venv/bin/activate
> curl https://bootstrap.pypa.io/get-pip.py | python3
> ```

#### 4.3 Virtuelle Umgebung aktivieren

```bash
source venv/bin/activate
```

Nach der Aktivierung sollte `(venv)` am Anfang deiner Terminal-Zeile erscheinen.

> **Wichtig**: Die virtuelle Umgebung muss bei jedem neuen Terminal-Fenster erneut aktiviert werden!

#### 4.4 pip aktualisieren

```bash
pip install --upgrade pip
```

#### 4.5 Python-Abhängigkeiten installieren

```bash
pip install -r requirements.txt
```

**Dies installiert:**
- `whisperx` – Spracherkennung mit Wort-Alignment
- `torch` – PyTorch ML-Framework
- `torchaudio` – Audioverarbeitung
- `transformers` – HuggingFace-Modelle
- `faster-whisper` – Optimierte Whisper-Inferenz

Die Installation kann **10-30 Minuten** dauern, da große ML-Modelle heruntergeladen werden.

**Häufige Fehler und Lösungen:**

#### Fehler: `No matching distribution found for torch`
```bash
# Lösung: pip aktualisieren und erneut versuchen
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt
```

#### Fehler: `externally-managed-environment`
Dieser Fehler tritt auf, wenn du versuchst, Pakete außerhalb einer virtuellen Umgebung zu installieren.

```bash
# Lösung: Stelle sicher, dass die venv aktiviert ist
source venv/bin/activate
# (venv) sollte am Anfang der Zeile erscheinen
pip install -r requirements.txt
```

#### Fehler: Installation hängt bei großen Paketen
```bash
# Mit Fortschrittsanzeige und Timeout
pip install -r requirements.txt --progress-bar on --timeout 300
```

#### Fehler: Speicherplatz nicht ausreichend
Die ML-Modelle benötigen ~5-10 GB. Stelle sicher, dass genug Speicherplatz verfügbar ist:
```bash
df -h ~
```

#### 4.6 GPU-Unterstützung prüfen (Apple Silicon)

Prüfe, ob PyTorch die GPU nutzen kann:

```bash
python3 -c "import torch; print(f'MPS verfügbar: {torch.backends.mps.is_available()}')"
```

Sollte `MPS verfügbar: True` ausgeben auf Apple Silicon Macs.

#### 4.7 Zurück zum Hauptverzeichnis

```bash
cd ..
```

Du solltest dich jetzt wieder im `opensub`-Hauptordner befinden.

---

### 5. HuggingFace-Token einrichten (optional)

Der HuggingFace-Token wird für die **Sprechererkennung** (Speaker Diarization) mit pyannote.audio benötigt. Ohne Token funktioniert die Transkription, aber es werden keine Sprecher unterschieden.

#### 5.1 HuggingFace-Konto erstellen

1. Gehe zu [huggingface.co](https://huggingface.co) und erstelle ein kostenloses Konto

#### 5.2 Modell-Lizenzen akzeptieren

Die pyannote-Modelle erfordern eine Zustimmung zu den Nutzungsbedingungen:

1. Besuche [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
2. Klicke auf "Agree and access repository"
3. Besuche [pyannote/segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
4. Klicke auf "Agree and access repository"

> **Wichtig**: Du musst bei HuggingFace eingeloggt sein und beiden Modellen explizit zustimmen!

#### 5.3 Access Token erstellen

1. Gehe zu [huggingface.co/settings/tokens](https://huggingface.co/settings/tokens)
2. Klicke auf "New token"
3. Name: z.B. "OpenSub"
4. Type: Wähle "Read" (nur Leserechte benötigt)
5. Klicke auf "Generate token"
6. **Kopiere den Token** (beginnt mit `hf_...`)

#### 5.4 Token als Umgebungsvariable setzen

**Temporär (nur für aktuelle Terminal-Sitzung):**
```bash
export HF_TOKEN="hf_dein_token_hier"
```

**Permanent (empfohlen):**
```bash
echo 'export HF_TOKEN="hf_dein_token_hier"' >> ~/.zprofile
source ~/.zprofile
```

**Alternativ: .env-Datei erstellen:**

Erstelle eine Datei namens `.env` im OpenSub-Hauptordner:
```bash
echo 'HF_TOKEN=hf_dein_token_hier' > .env
```

> **Sicherheitshinweis**: Teile deinen Token niemals öffentlich! Die `.env`-Datei ist in `.gitignore` und wird nicht hochgeladen.

**Häufige Fehler:**

#### Fehler: `401 Unauthorized` oder `Cannot access gated repo`
- Stelle sicher, dass du den Modell-Lizenzen zugestimmt hast (Schritt 5.2)
- Prüfe, ob der Token korrekt kopiert wurde (keine Leerzeichen)
- Erstelle ggf. einen neuen Token

#### Fehler: Token wird nicht erkannt
```bash
# Prüfen, ob die Variable gesetzt ist
echo $HF_TOKEN

# Falls leer, Token erneut setzen
export HF_TOKEN="hf_..."
```

---

### 6. Installation überprüfen

#### 6.1 Anwendung im Entwicklungsmodus starten

```bash
npm run dev
```

Die Anwendung sollte sich öffnen und die Drag-and-Drop-Oberfläche zeigen.

#### 6.2 Kompletten Workflow testen

1. **Video importieren**: Ziehe eine Videodatei (MP4, MOV, etc.) in die App
2. **Transkription**: Die App sollte automatisch mit der Transkription beginnen
3. **Erste Transkription dauert länger**: Beim ersten Start werden KI-Modelle (~3 GB) heruntergeladen

#### 6.3 Falls die App nicht startet

**Logs prüfen:**
```bash
npm run dev 2>&1 | tee opensub.log
```

Schau in `opensub.log` nach Fehlermeldungen.

**Häufige Probleme beim Start:**

| Symptom | Mögliche Ursache | Lösung |
|---------|------------------|--------|
| App öffnet nicht | Node-Module inkompatibel | `npm run postinstall` |
| Weißer Bildschirm | Build-Fehler | `npm run build` prüfen |
| Python-Fehler | venv nicht aktiviert | Python-Setup wiederholen |
| FFmpeg-Fehler | FFmpeg nicht im PATH | Terminal neu starten |

---

## Fehlerbehebung

### Allgemeine Probleme

#### "Command not found" Fehler

Nach Installation von Homebrew-Paketen werden diese manchmal nicht erkannt.

**Lösung:**
```bash
# Terminal neu starten oder:
source ~/.zprofile
# oder für bash:
source ~/.bashrc
```

#### Berechtigungsfehler (Permission denied)

```bash
# npm-Berechtigungen korrigieren
sudo chown -R $(whoami) ~/.npm
sudo chown -R $(whoami) ~/Library/Caches/Homebrew

# Falls node_modules betroffen:
sudo chown -R $(whoami) node_modules
```

### Node.js / Electron Probleme

#### `better-sqlite3` kompiliert nicht

Dies ist ein häufiges Problem mit nativen Node-Modulen.

```bash
# 1. Xcode Command Line Tools installieren/aktualisieren
xcode-select --install

# 2. node-gyp global installieren
npm install -g node-gyp

# 3. node_modules löschen und neu installieren
rm -rf node_modules package-lock.json
npm install

# 4. Native Module für Electron neu kompilieren
npx @electron/rebuild -f -w better-sqlite3
```

#### Electron startet nicht

```bash
# Cache löschen
rm -rf node_modules/.cache
rm -rf ~/.cache/electron

# Neu installieren
npm install
```

### Python / WhisperX Probleme

#### "No module named 'whisperx'"

```bash
# Prüfen, ob venv aktiviert ist
which python3
# Sollte .../python-service/venv/bin/python3 zeigen

# Falls nicht:
cd python-service
source venv/bin/activate
pip install -r requirements.txt
```

#### PyTorch/MPS Fehler auf Apple Silicon

```bash
# PyTorch für Apple Silicon neu installieren
pip uninstall torch torchaudio
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu
```

#### Speicherfehler bei großen Videos

Große Videos können viel RAM benötigen. Tipps:
- Schließe andere Anwendungen
- Verwende kürzere Videosegmente
- Stelle in der App ein kleineres Whisper-Modell ein (small statt large-v3)

#### WhisperX/MLX Probleme

WhisperX auf Apple Silicon kann manchmal Probleme bereiten. Alternative Installation:

```bash
# Spezielle Version für Mac
pip install git+https://github.com/justinwlin/WhisperXMac.git
```

### FFmpeg Probleme

#### FFmpeg nicht gefunden

```bash
# Prüfen, wo FFmpeg installiert ist
which ffmpeg

# Falls nicht gefunden, Homebrew-Pfad hinzufügen
echo 'export PATH="/opt/homebrew/bin:$PATH"' >> ~/.zprofile
source ~/.zprofile
```

#### Codec-Fehler beim Export

```bash
# FFmpeg mit allen Codecs neu installieren
brew uninstall ffmpeg
brew install ffmpeg
```

#### Hardware-Beschleunigung funktioniert nicht

```bash
# Prüfen, ob VideoToolbox verfügbar ist
ffmpeg -encoders | grep videotoolbox
```

### HuggingFace / Diarization Probleme

#### "Cannot access gated repo"

1. Stelle sicher, dass du bei HuggingFace eingeloggt bist
2. Akzeptiere BEIDE Modell-Lizenzen:
   - [speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1)
   - [segmentation-3.0](https://huggingface.co/pyannote/segmentation-3.0)
3. Erstelle einen neuen Token mit "Read"-Berechtigung
4. Setze den Token neu:
   ```bash
   export HF_TOKEN="hf_neuer_token"
   ```

#### Transkription funktioniert, aber keine Sprecher werden erkannt

Die Sprechererkennung ist optional. Falls sie nicht funktioniert:
- Prüfe den HF_TOKEN
- Prüfe die Netzwerkverbindung (Modelle werden online geladen)
- Die Transkription funktioniert auch ohne Sprechererkennung

### Kompletter Reset

Falls nichts mehr hilft, kannst du alles zurücksetzen:

```bash
# Im OpenSub-Verzeichnis

# 1. Node-Module löschen
rm -rf node_modules package-lock.json

# 2. Python venv löschen
rm -rf python-service/venv

# 3. Cache löschen
rm -rf ~/.cache/huggingface
rm -rf ~/.cache/torch

# 4. Alles neu installieren
npm install

# 5. Python neu einrichten
cd python-service
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
cd ..

# 6. App starten
npm run dev
```

---

## Verwendung

### Schnellstart

1. **App starten**: `npm run dev` im Terminal
2. **Video importieren**: Videodatei in die App ziehen
3. **Warten**: Die Transkription startet automatisch (erste Ausführung dauert länger)
4. **Bearbeiten**: Texte im linken Panel korrigieren
5. **Styling**: Rechts Schriftart, Farben und Animationen anpassen
6. **Export**: Menü → Export → Format wählen

### Tastenkürzel

| Taste | Funktion |
|-------|----------|
| `Leertaste` | Play/Pause |
| `←` / `→` | 5 Sekunden vor/zurück |
| `Cmd + O` | Video öffnen |
| `Cmd + S` | Projekt speichern |
| `Enter` | Untertitel-Bearbeitung bestätigen |
| `Escape` | Bearbeitung abbrechen |

### Unterstützte Formate

**Video-Import:** MP4, MOV, AVI, MKV, WebM, M4V

**Export:**
- **ASS** – Volle Stilunterstützung, empfohlen für Media Player
- **SRT** – Universell kompatibel
- **MP4** – Video mit eingebrannten Untertiteln

---

## Entwicklung

### Verfügbare Befehle

| Befehl | Beschreibung |
|--------|--------------|
| `npm run dev` | Entwicklungsmodus mit Hot-Reload starten |
| `npm run build` | Produktions-Build erstellen |
| `npm run preview` | Produktions-Build lokal testen |
| `npm run build:mac` | macOS-Distribution (DMG) erstellen |
| `npm run typecheck` | TypeScript-Typprüfung |
| `npm run lint` | Code-Stil prüfen |
| `npm run test` | E2E-Tests ausführen |

### Hot-Reload Verhalten

| Bereich | Hot-Reload |
|---------|------------|
| React-Komponenten | ✅ Sofort |
| Preload-Skripte | ⚠️ App-Neustart nötig |
| Main-Prozess | ⚠️ App-Neustart nötig |
| Python-Service | ⚠️ Pro Transkription neu |

### Projektstruktur

```
opensub/
├── src/
│   ├── main/              # Electron Main-Prozess
│   │   ├── index.ts       # Einstiegspunkt, Fensterverwaltung
│   │   ├── ipc/           # IPC-Handler
│   │   └── services/      # WhisperService, FFmpegService
│   ├── preload/           # Sichere IPC-Brücke
│   │   └── index.ts       # window.api Definition
│   ├── renderer/          # React-Anwendung
│   │   ├── App.tsx        # Haupt-Komponente
│   │   ├── components/    # UI-Komponenten
│   │   ├── store/         # Zustand State-Management
│   │   └── utils/         # Hilfsfunktionen
│   └── shared/            # Gemeinsame TypeScript-Typen
│       └── types.ts       # Alle Typ-Definitionen
├── python-service/        # WhisperX KI-Service
│   ├── whisper_service/
│   │   ├── main.py        # JSON-RPC Server
│   │   ├── transcriber.py # Transkriptions-Pipeline
│   │   └── rpc_handler.py # RPC-Methodenhandler
│   └── requirements.txt   # Python-Abhängigkeiten
├── electron.vite.config.ts    # Build-Konfiguration
├── electron-builder.yml       # Packaging-Konfiguration
├── tailwind.config.js         # CSS-Framework-Konfiguration
└── package.json               # Node.js-Abhängigkeiten
```

---

## Architektur

### Systemübersicht

OpenSub verwendet Electrons Multi-Prozess-Architektur:

```
┌─────────────────────────────────────────────────────────────┐
│                    OpenSub Anwendung                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              RENDERER-PROZESS (React)                 │  │
│  │                                                       │  │
│  │  ┌──────────┐ ┌─────────────┐ ┌──────────────────┐   │  │
│  │  │DropZone  │ │ VideoPlayer │ │ SubtitleList     │   │  │
│  │  └────┬─────┘ └──────┬──────┘ └────────┬─────────┘   │  │
│  │       │              │                  │             │  │
│  │  ┌────┴──────────────┴──────────────────┴─────────┐  │  │
│  │  │         Zustand State Management               │  │  │
│  │  │  projectStore (Daten) │ uiStore (UI-State)     │  │  │
│  │  └────────────────────────────────────────────────┘  │  │
│  │                                                       │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │ IPC (contextBridge)           │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                   PRELOAD-SKRIPT                      │  │
│  │              (window.api Schnittstelle)               │  │
│  └──────────────────────────┬────────────────────────────┘  │
│                             │ IPC-Kanäle                    │
│                             ▼                               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              MAIN-PROZESS (Node.js)                   │  │
│  │                                                       │  │
│  │  ┌─────────────────┐    ┌─────────────────────────┐  │  │
│  │  │ WhisperService  │    │     FFmpegService       │  │  │
│  │  │ (Python-Prozess)│    │  (Video-Verarbeitung)   │  │  │
│  │  └────────┬────────┘    └─────────────────────────┘  │  │
│  │           │                                           │  │
│  └───────────┼───────────────────────────────────────────┘  │
│              │ JSON-RPC (stdio)                             │
│              ▼                                              │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              PYTHON-SERVICE (Subprozess)              │  │
│  │                                                       │  │
│  │  ┌─────────────────────────────────────────────────┐ │  │
│  │  │            WhisperX Transkription               │ │  │
│  │  │                                                 │ │  │
│  │  │  1. Audio laden (whisperx_mlx)                  │ │  │
│  │  │  2. Transkribieren (MLX/GPU)                    │ │  │
│  │  │  3. Wort-Alignment (CPU)                        │ │  │
│  │  │  4. Sprecher-Erkennung (optional)               │ │  │
│  │  └─────────────────────────────────────────────────┘ │  │
│  │                                                       │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Datenfluss

```
Video-Datei (MP4, MOV)
       │
       ▼
┌──────────────────┐
│  FFmpegService   │  → Extrahiert Audio als WAV (16kHz, Mono)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Python-Service  │  → WhisperX transkribiert Audio
│    (WhisperX)    │  → Erstellt Wort-Zeitstempel
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   projectStore   │  → Speichert Untertitel-Daten
│    (Zustand)     │  → Verwaltet Stil-Einstellungen
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│     Export       │  → ASS/SRT-Datei
│   (FFmpeg)       │  → oder eingebranntes Video
└──────────────────┘
```

### Technologie-Stack

| Schicht | Technologie | Zweck |
|---------|-------------|-------|
| **Frontend** | React 18, TypeScript, Zustand | UI-Komponenten, State |
| **Styling** | Tailwind CSS, Radix UI | Design-System |
| **Desktop** | Electron 28 | Native App-Container |
| **Build** | electron-vite, Vite | Schnelles Bundling |
| **Video** | FFmpeg, fluent-ffmpeg | Medienverarbeitung |
| **KI/ML** | WhisperX, PyTorch, MLX | Spracherkennung |
| **Datenbank** | better-sqlite3 | Projekt-Persistenz |

---

## Lizenz

MIT-Lizenz – siehe [LICENSE](LICENSE) für Details.

---

## Weitere Ressourcen

- [WhisperX GitHub](https://github.com/m-bain/whisperX) – Transkriptions-Engine
- [Electron Dokumentation](https://www.electronjs.org/docs) – Desktop-Framework
- [FFmpeg Dokumentation](https://ffmpeg.org/documentation.html) – Video-Verarbeitung
- [HuggingFace](https://huggingface.co) – KI-Modelle

---

<p align="center">
  Entwickelt mit Electron, React und WhisperX<br>
  Optimiert für Apple Silicon
</p>
