#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$HOME/.openclaw/workspace}"
SETTINGS_DIR="${ICLAW_SETTINGS_DIR:-$HOME/.openclaw/iclaw-settings}"

mkdir -p "$SETTINGS_DIR"

mkdir -p "$WORKSPACE_DIR"
rm -f "$WORKSPACE_DIR/BOOTSTRAP.md"

if [[ ! -f "$SETTINGS_DIR/IDENTITY.md" ]]; then
  cat > "$SETTINGS_DIR/IDENTITY.md" <<'EOF'
# IDENTITY.md
- Name: iClaw
- Theme: Calm
- Emoji: 🦀
EOF
fi

if [[ ! -f "$SETTINGS_DIR/USER.md" ]]; then
  cat > "$SETTINGS_DIR/USER.md" <<'EOF'
# USER.md
- Preferred language: zh-CN
- Timezone: Asia/Shanghai
- Notes:
EOF
fi

if [[ ! -f "$SETTINGS_DIR/SOUL.md" ]]; then
  cat > "$SETTINGS_DIR/SOUL.md" <<'EOF'
# SOUL.md
- Be concise and direct.
- Ask clarifying questions when needed.
- Refuse unsafe or illegal requests.
EOF
fi

if [[ ! -f "$SETTINGS_DIR/AGENTS.md" ]]; then
  cat > "$SETTINGS_DIR/AGENTS.md" <<'EOF'
# AGENTS.md
This workspace is pre-seeded by iClaw.
Identity/User/Soul are managed by iClaw settings source.
EOF
fi

cp "$SETTINGS_DIR/IDENTITY.md" "$WORKSPACE_DIR/IDENTITY.md"
cp "$SETTINGS_DIR/USER.md" "$WORKSPACE_DIR/USER.md"
cp "$SETTINGS_DIR/SOUL.md" "$WORKSPACE_DIR/SOUL.md"
cp "$SETTINGS_DIR/AGENTS.md" "$WORKSPACE_DIR/AGENTS.md"

echo "[openclaw-workspace] ready: $WORKSPACE_DIR"
echo "[openclaw-workspace] source: $SETTINGS_DIR"
