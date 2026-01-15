#!/bin/bash
# Create Python virtual environment with all dependencies for bundling
# This uses the portable Python from python-build-standalone

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

PYTHON_DIR="$PROJECT_ROOT/build-resources/python-standalone/python"
VENV_DIR="$PROJECT_ROOT/build-resources/python-env"
REQUIREMENTS="$PROJECT_ROOT/python-service/requirements.txt"

# Check if Python standalone exists
if [ ! -f "$PYTHON_DIR/bin/python3.12" ]; then
    echo "ERROR: Python standalone not found. Run download-python.sh first."
    exit 1
fi

# Check if venv already exists and is valid
if [ -f "$VENV_DIR/bin/python3" ]; then
    echo "Python environment already exists at $VENV_DIR"
    echo "To recreate, delete the directory first: rm -rf $VENV_DIR"
    exit 0
fi

echo "Creating Python virtual environment..."

# Create venv using standalone Python
"$PYTHON_DIR/bin/python3.12" -m venv "$VENV_DIR"

echo "Upgrading pip..."
"$VENV_DIR/bin/pip" install --upgrade pip

echo "Installing dependencies from $REQUIREMENTS..."
"$VENV_DIR/bin/pip" install -r "$REQUIREMENTS"

# Show installed packages (before cleanup removes pip)
echo ""
echo "Installed packages:"
"$VENV_DIR/bin/pip" list

echo ""
echo "Cleaning up cache and unnecessary files..."
# Remove __pycache__ directories
find "$VENV_DIR" -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
# Remove .pyc files
find "$VENV_DIR" -type f -name "*.pyc" -delete 2>/dev/null || true
# Remove pip cache
rm -rf "$VENV_DIR/lib/python3.12/site-packages/pip" 2>/dev/null || true
# Remove setuptools (not needed at runtime)
rm -rf "$VENV_DIR/lib/python3.12/site-packages/setuptools" 2>/dev/null || true

echo ""
echo "Fixing Python symlinks for bundling..."
# The venv creates symlinks to the standalone Python, but these are absolute paths
# that won't work after bundling. We need to copy the actual binaries instead.

# Remove the symlinks
rm -f "$VENV_DIR/bin/python" "$VENV_DIR/bin/python3" "$VENV_DIR/bin/python3.12"

# Copy the actual Python binary
cp "$PYTHON_DIR/bin/python3.12" "$VENV_DIR/bin/python3.12"

# Create relative symlinks
cd "$VENV_DIR/bin"
ln -s python3.12 python3
ln -s python3.12 python
cd "$PROJECT_ROOT"

# Copy the COMPLETE Python standard library (required for PYTHONHOME to work in bundled app)
# We need to preserve site-packages while replacing the stdlib
echo "Copying complete Python standard library..."

SITE_PACKAGES="$VENV_DIR/lib/python3.12/site-packages"

# Backup site-packages
if [ -d "$SITE_PACKAGES" ]; then
    mv "$SITE_PACKAGES" "$VENV_DIR/site-packages-backup"
fi

# Copy the entire stdlib
rm -rf "$VENV_DIR/lib/python3.12"
cp -r "$PYTHON_DIR/lib/python3.12" "$VENV_DIR/lib/"

# Restore site-packages
if [ -d "$VENV_DIR/site-packages-backup" ]; then
    rm -rf "$VENV_DIR/lib/python3.12/site-packages" 2>/dev/null || true
    mv "$VENV_DIR/site-packages-backup" "$SITE_PACKAGES"
fi

# Copy the libpython shared library if it exists (needed on some systems)
if [ -f "$PYTHON_DIR/lib/libpython3.12.dylib" ]; then
    cp "$PYTHON_DIR/lib/libpython3.12.dylib" "$VENV_DIR/lib/"
fi

echo ""
echo "Python environment created successfully at $VENV_DIR"

echo ""
echo "Verifying Python with PYTHONHOME..."
PYTHONHOME="$VENV_DIR" "$VENV_DIR/bin/python3" --version
PYTHONHOME="$VENV_DIR" "$VENV_DIR/bin/python3" -c "import encodings; print('encodings module: OK')"

echo ""
echo "Verifying binary is standalone (no external symlinks):"
file "$VENV_DIR/bin/python3.12"
ls -la "$VENV_DIR/bin/python"*
