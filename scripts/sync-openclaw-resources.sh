#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SRC_DIR="$ROOT_DIR/services/openclaw/resources"
SKILLS_SRC_DIR="$ROOT_DIR/skills"
MCP_PRESET_DIR="$ROOT_DIR/mcp"
SERVERS_SRC_DIR="$ROOT_DIR/servers"
DST_DIR="$ROOT_DIR/apps/desktop/src-tauri/resources"

mkdir -p "$DST_DIR/skills" "$DST_DIR/mcp" "$DST_DIR/config" "$DST_DIR/certs" "$DST_DIR/servers"

if [[ -d "$SKILLS_SRC_DIR" ]]; then
  rm -rf "$DST_DIR/skills"
  mkdir -p "$DST_DIR/skills"
  rsync -a --delete --exclude ".DS_Store" "$SKILLS_SRC_DIR/" "$DST_DIR/skills/"
fi

if [[ -d "$SERVERS_SRC_DIR" ]]; then
  rm -rf "$DST_DIR/servers"
  mkdir -p "$DST_DIR/servers"
  rsync -a --delete --exclude ".DS_Store" "$SERVERS_SRC_DIR/" "$DST_DIR/servers/"
fi

if [[ -f "$SRC_DIR/mcp/mcp.json" || -f "$MCP_PRESET_DIR/mcp.json" ]]; then
  mkdir -p "$DST_DIR/mcp"
  if [[ -f "$SRC_DIR/mcp/mcp.json" && -f "$MCP_PRESET_DIR/mcp.json" ]]; then
    node - "$SRC_DIR/mcp/mcp.json" "$MCP_PRESET_DIR/mcp.json" "$DST_DIR/mcp/mcp.json" <<'EOF'
const fs = require('fs');

const [basePath, overlayPath, outputPath] = process.argv.slice(2);

function loadJson(path) {
  return JSON.parse(fs.readFileSync(path, 'utf8'));
}

const base = loadJson(basePath);
const overlay = loadJson(overlayPath);
const merged = {
  ...base,
  ...overlay,
  mcpServers: {
    ...(base.mcpServers ?? {}),
    ...(overlay.mcpServers ?? {}),
  },
};

fs.writeFileSync(outputPath, `${JSON.stringify(merged, null, 2)}\n`);
EOF
  elif [[ -f "$MCP_PRESET_DIR/mcp.json" ]]; then
    cp "$MCP_PRESET_DIR/mcp.json" "$DST_DIR/mcp/mcp.json"
  else
    cp "$SRC_DIR/mcp/mcp.json" "$DST_DIR/mcp/mcp.json"
  fi
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
