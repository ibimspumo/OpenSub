#!/bin/bash
# Downloads static FFmpeg/FFprobe binaries (arm64 macOS) for bundling into the app.
# Static builds by Martin Riedl (https://ffmpeg.martin-riedl.de) — no dylib dependencies.
#
# Run before `npm run tauri build`. Binaries land in src-tauri/binaries/ and are
# bundled via the `bundle.resources` entry in tauri.conf.json.

set -euo pipefail

DIR="$(cd "$(dirname "$0")/.." && pwd)"
TARGET="$DIR/src-tauri/binaries"
mkdir -p "$TARGET"

BASE="https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release"

for tool in ffmpeg ffprobe; do
  if [ -f "$TARGET/$tool" ]; then
    echo "$tool already present, skipping"
    continue
  fi
  echo "Downloading $tool..."
  curl -L --fail -o "$TARGET/$tool.zip" "$BASE/$tool.zip"
  unzip -o -q "$TARGET/$tool.zip" -d "$TARGET"
  rm "$TARGET/$tool.zip"
  chmod +x "$TARGET/$tool"
done

echo "Done. Binaries in $TARGET:"
ls -lh "$TARGET"
