#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
WORKSPACE_DIR="${OPENCLAW_WORKSPACE_DIR:-$HOME/.openclaw/openclaw-workspace}"

mkdir -p "$WORKSPACE_DIR"
rm -f "$WORKSPACE_DIR/BOOTSTRAP.md"

if [[ ! -f "$WORKSPACE_DIR/IDENTITY.md" ]]; then
  cat > "$WORKSPACE_DIR/IDENTITY.md" <<'EOF'
# IDENTITY.md
- Name: iClaw
- Theme: Calm
- Emoji: 🦀
EOF
fi

if [[ ! -f "$WORKSPACE_DIR/USER.md" ]]; then
  cat > "$WORKSPACE_DIR/USER.md" <<'EOF'
# USER.md
- Preferred language: zh-CN
- Timezone: Asia/Shanghai
- Notes:
EOF
fi

if [[ ! -f "$WORKSPACE_DIR/SOUL.md" ]]; then
  cat > "$WORKSPACE_DIR/SOUL.md" <<'EOF'
# SOUL.md
- Be concise and direct.
- Ask clarifying questions when needed.
- Refuse unsafe or illegal requests.
EOF
fi

if [[ ! -f "$WORKSPACE_DIR/AGENTS.md" ]]; then
  cat > "$WORKSPACE_DIR/AGENTS.md" <<'EOF'
# AGENTS.md
This workspace is pre-seeded by iClaw.
Identity/User/Soul are managed by Settings and local defaults.
EOF
fi

echo "[openclaw-workspace] ready: $WORKSPACE_DIR"
