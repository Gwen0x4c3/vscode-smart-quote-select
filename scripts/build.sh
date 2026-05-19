#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Install vsce if not present
if ! command -v vsce &>/dev/null; then
  echo "Installing vsce..."
  npm install -g @vscode/vsce
fi

# Package the extension
echo "Packaging extension..."
vsce package --no-dependencies

echo "Build complete. *.vsix file(s) ready in $PROJECT_ROOT"
