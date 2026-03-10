#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$HOME/.openclaw/workspace}"
DEFAULTS_DIR="$ROOT_DIR/services/openclaw/resources"

mkdir -p "$WORKSPACE_DIR"
rm -f "$WORKSPACE_DIR/BOOTSTRAP.md"

if [[ ! -f "$WORKSPACE_DIR/IDENTITY.md" ]]; then
  cp "$DEFAULTS_DIR/IDENTITY.md" "$WORKSPACE_DIR/IDENTITY.md"
fi

if [[ ! -f "$WORKSPACE_DIR/USER.md" ]]; then
  cp "$DEFAULTS_DIR/USER.md" "$WORKSPACE_DIR/USER.md"
fi

if [[ ! -f "$WORKSPACE_DIR/SOUL.md" ]]; then
  cp "$DEFAULTS_DIR/SOUL.md" "$WORKSPACE_DIR/SOUL.md"
fi

if [[ ! -f "$WORKSPACE_DIR/AGENTS.md" ]]; then
  cp "$DEFAULTS_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"
fi

if [[ ! -f "$WORKSPACE_DIR/FINANCE_DECISION_FRAMEWORK.md" ]]; then
  cp "$DEFAULTS_DIR/FINANCE_DECISION_FRAMEWORK.md" \
    "$WORKSPACE_DIR/FINANCE_DECISION_FRAMEWORK.md"
fi

echo "[openclaw-workspace] ready: $WORKSPACE_DIR"
