#!/bin/bash
# Setup KiCad libraries for vibeCAD
# Usage: ./scripts/setup-libraries.sh [--symbols-only]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

SYMBOLS_ONLY=false
if [ "$1" = "--symbols-only" ]; then
  SYMBOLS_ONLY=true
fi

echo "=== vibeCAD Library Setup ==="
echo "Root directory: $ROOT_DIR"
echo ""

# Create directories
mkdir -p "$ROOT_DIR/libraries"
mkdir -p "$ROOT_DIR/app/libraries/kicad/symbols"
mkdir -p "$ROOT_DIR/app/libraries/kicad/footprints"

# Clone and copy symbols
if [ ! -d "$ROOT_DIR/libraries/kicad-symbols" ]; then
  echo "Downloading KiCad symbol libraries (~230 MB)..."
  git clone --depth 1 https://gitlab.com/kicad/libraries/kicad-symbols.git "$ROOT_DIR/libraries/kicad-symbols"
else
  echo "KiCad symbols already downloaded, updating..."
  cd "$ROOT_DIR/libraries/kicad-symbols" && git pull
fi

echo "Copying symbol files..."
cp "$ROOT_DIR/libraries/kicad-symbols/"*.kicad_sym "$ROOT_DIR/app/libraries/kicad/symbols/"
SYMBOL_COUNT=$(ls "$ROOT_DIR/app/libraries/kicad/symbols/"*.kicad_sym 2>/dev/null | wc -l)
echo "Copied $SYMBOL_COUNT symbol files"

# Clone and copy footprints (unless --symbols-only)
if [ "$SYMBOLS_ONLY" = false ]; then
  if [ ! -d "$ROOT_DIR/libraries/kicad-footprints" ]; then
    echo ""
    echo "Downloading KiCad footprint libraries (~500 MB)..."
    git clone --depth 1 https://gitlab.com/kicad/libraries/kicad-footprints.git "$ROOT_DIR/libraries/kicad-footprints"
  else
    echo "KiCad footprints already downloaded, updating..."
    cd "$ROOT_DIR/libraries/kicad-footprints" && git pull
  fi

  echo "Copying footprint files..."
  cp -r "$ROOT_DIR/libraries/kicad-footprints/"*.pretty "$ROOT_DIR/app/libraries/kicad/footprints/"
  FP_COUNT=$(ls -d "$ROOT_DIR/app/libraries/kicad/footprints/"*.pretty 2>/dev/null | wc -l)
  echo "Copied $FP_COUNT footprint libraries"
else
  echo ""
  echo "Skipping footprints (--symbols-only specified)"
fi

echo ""
echo "=== Setup Complete ==="
echo "Run 'pnpm index-libraries' to build the search index"
