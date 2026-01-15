#!/bin/bash
# Fix Python symlinks in existing python-env for bundling
# Run this if python-env already exists and has broken symlinks
#
# This script:
# 1. Replaces symlinked Python binary with actual binary
# 2. Copies the complete Python standard library (required for PYTHONHOME)
# 3. Preserves the venv's site-packages

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

PYTHON_DIR="$PROJECT_ROOT/build-resources/python-standalone/python"
VENV_DIR="$PROJECT_ROOT/build-resources/python-env"

echo "========================================"
echo "Fixing Python environment for bundling"
echo "========================================"
echo ""

# Check if directories exist
if [ ! -d "$VENV_DIR" ]; then
    echo "ERROR: python-env not found at $VENV_DIR"
    echo "Run setup-python-env.sh first."
    exit 1
fi

if [ ! -f "$PYTHON_DIR/bin/python3.12" ]; then
    echo "ERROR: Python standalone not found at $PYTHON_DIR"
    echo "Run download-python.sh first."
    exit 1
fi

# Check current state of symlinks
echo "Current state of Python binaries:"
ls -la "$VENV_DIR/bin/python"* 2>/dev/null || echo "No python binaries found"

echo ""
echo "Step 1: Fixing Python binary symlinks..."
# Remove existing symlinks or files
rm -f "$VENV_DIR/bin/python" "$VENV_DIR/bin/python3" "$VENV_DIR/bin/python3.12"

# Copy the actual Python binary
cp "$PYTHON_DIR/bin/python3.12" "$VENV_DIR/bin/python3.12"

# Create relative symlinks
cd "$VENV_DIR/bin"
ln -s python3.12 python3
ln -s python3.12 python
cd "$PROJECT_ROOT"

echo ""
echo "Step 2: Copying Python standard library..."
# The bundled Python needs its complete stdlib for PYTHONHOME to work
# We need to preserve the venv's site-packages while copying the stdlib

# Save existing site-packages location
SITE_PACKAGES="$VENV_DIR/lib/python3.12/site-packages"

# Create backup of site-packages
if [ -d "$SITE_PACKAGES" ]; then
    echo "Backing up site-packages..."
    mv "$SITE_PACKAGES" "$VENV_DIR/site-packages-backup"
fi

# Copy the entire stdlib from standalone Python
echo "Copying stdlib from $PYTHON_DIR/lib/python3.12/..."
rm -rf "$VENV_DIR/lib/python3.12"
cp -r "$PYTHON_DIR/lib/python3.12" "$VENV_DIR/lib/"

# Restore site-packages
if [ -d "$VENV_DIR/site-packages-backup" ]; then
    echo "Restoring site-packages..."
    rm -rf "$VENV_DIR/lib/python3.12/site-packages" 2>/dev/null || true
    mv "$VENV_DIR/site-packages-backup" "$SITE_PACKAGES"
fi

echo ""
echo "Step 3: Copying additional library files..."
# Copy libpython shared library if needed
if [ -f "$PYTHON_DIR/lib/libpython3.12.dylib" ]; then
    echo "Copying libpython3.12.dylib..."
    cp "$PYTHON_DIR/lib/libpython3.12.dylib" "$VENV_DIR/lib/"
fi

echo ""
echo "========================================"
echo "Verification"
echo "========================================"

echo ""
echo "Python binaries:"
ls -la "$VENV_DIR/bin/python"*

echo ""
echo "Python stdlib check (should contain encodings):"
ls "$VENV_DIR/lib/python3.12/" | grep -E "^(encodings|os\.py|site\.py)" | head -5

echo ""
echo "Testing Python with PYTHONHOME..."
PYTHONHOME="$VENV_DIR" "$VENV_DIR/bin/python3" -c "import sys; print(f'Python {sys.version}')"
PYTHONHOME="$VENV_DIR" "$VENV_DIR/bin/python3" -c "import encodings; print('encodings module: OK')"

echo ""
echo "========================================"
echo "SUCCESS! Python environment fixed for bundling."
echo "========================================"
