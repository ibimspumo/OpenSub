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
echo "Python environment created successfully at $VENV_DIR"
"$VENV_DIR/bin/python3" --version
