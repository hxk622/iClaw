#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/services/openclaw/resources"
DST_DIR="$ROOT_DIR/apps/desktop/src-tauri/resources"

mkdir -p "$DST_DIR/skills" "$DST_DIR/mcp" "$DST_DIR/config" "$DST_DIR/certs"

if [[ -d "$SRC_DIR/skills" ]]; then
  rm -rf "$DST_DIR/skills"
  mkdir -p "$DST_DIR/skills"
  rsync -a --delete --exclude ".DS_Store" "$SRC_DIR/skills/" "$DST_DIR/skills/"
fi

if [[ -f "$SRC_DIR/mcp/mcp.json" ]]; then
  mkdir -p "$DST_DIR/mcp"
  cp "$SRC_DIR/mcp/mcp.json" "$DST_DIR/mcp/mcp.json"
fi

if [[ -f "$SRC_DIR/config/runtime-config.json" ]]; then
  mkdir -p "$DST_DIR/config"
  cp "$SRC_DIR/config/runtime-config.json" "$DST_DIR/config/runtime-config.json"
fi

if [[ -d "$SRC_DIR/certs" ]]; then
  rm -rf "$DST_DIR/certs"
  mkdir -p "$DST_DIR/certs"
  rsync -a --delete --exclude ".DS_Store" "$SRC_DIR/certs/" "$DST_DIR/certs/"
fi

echo "Synced OpenClaw resources to $DST_DIR"
