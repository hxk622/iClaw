#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BIN_DIR="$ROOT_DIR/apps/desktop/src-tauri/binaries"

TARGET_TRIPLE="${1:-}"
if [[ -z "$TARGET_TRIPLE" ]]; then
  TARGET_TRIPLE="$(rustc -vV | sed -n 's/^host: //p')"
fi

if [[ -z "$TARGET_TRIPLE" ]]; then
  echo "Cannot determine rust target triple"
  exit 1
fi

SOURCE_BIN="${OPENCLAW_BINARY_PATH:-$ROOT_DIR/services/openclaw/bin/openclaw}"
DEST_NAME="openclaw-$TARGET_TRIPLE"

if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
  SOURCE_BIN_EXE="${SOURCE_BIN}.exe"
  if [[ -f "$SOURCE_BIN_EXE" ]]; then
    SOURCE_BIN="$SOURCE_BIN_EXE"
  fi
  DEST_NAME="${DEST_NAME}.exe"
fi

if [[ ! -f "$SOURCE_BIN" ]]; then
  echo "OpenClaw binary not found: $SOURCE_BIN"
  echo "Provide it via OPENCLAW_BINARY_PATH or place it at services/openclaw/bin/openclaw"
  exit 1
fi

mkdir -p "$BIN_DIR"
cp "$SOURCE_BIN" "$BIN_DIR/$DEST_NAME"

if [[ "$TARGET_TRIPLE" != *"windows"* ]]; then
  chmod +x "$BIN_DIR/$DEST_NAME"
fi

echo "Sidecar prepared: $BIN_DIR/$DEST_NAME"
