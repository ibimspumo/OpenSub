#!/bin/bash
# Download python-build-standalone for macOS ARM64
# This creates a portable Python distribution for bundling with the app
# Source: https://github.com/astral-sh/python-build-standalone

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Python version and release info (verified 2026-01-15)
VERSION="3.12.12"
RELEASE="20260114"
PLATFORM="aarch64-apple-darwin"
FILENAME="cpython-${VERSION}+${RELEASE}-${PLATFORM}-install_only.tar.gz"
URL="https://github.com/astral-sh/python-build-standalone/releases/download/${RELEASE}/${FILENAME}"

TARGET_DIR="$PROJECT_ROOT/build-resources/python-standalone"

# Check if already downloaded
if [ -f "$TARGET_DIR/python/bin/python3.12" ]; then
    echo "Python standalone already downloaded at $TARGET_DIR"
    "$TARGET_DIR/python/bin/python3.12" --version
    exit 0
fi

echo "Downloading Python $VERSION standalone for $PLATFORM..."
echo "URL: $URL"

# Create directory
mkdir -p "$TARGET_DIR"

# Download and extract
echo "Downloading... (this may take a moment)"
curl -L --progress-bar "$URL" | tar xz -C "$TARGET_DIR"

# Verify installation
if [ -f "$TARGET_DIR/python/bin/python3.12" ]; then
    echo ""
    echo "Successfully downloaded Python standalone"
    "$TARGET_DIR/python/bin/python3.12" --version
else
    echo "ERROR: Python binary not found after extraction"
    exit 1
fi
