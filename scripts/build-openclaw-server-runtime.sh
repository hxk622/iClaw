#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_DIR="${OPENCLAW_SOURCE_DIR:-$ROOT_DIR/../GitCode/clawdbot-main}"
TARGET_TRIPLE="${1:-$(rustc -vV | sed -n 's/^host: //p')}"

if [[ -z "$TARGET_TRIPLE" ]]; then
  echo "Cannot determine target triple." >&2
  exit 1
fi

if [[ ! -f "$SOURCE_DIR/package.json" || ! -f "$SOURCE_DIR/openclaw.mjs" ]]; then
  echo "OpenClaw source not found: $SOURCE_DIR" >&2
  echo "Set OPENCLAW_SOURCE_DIR=/abs/path/to/openclaw-source" >&2
  exit 1
fi

echo "[openclaw-runtime] source: $SOURCE_DIR"
echo "[openclaw-runtime] target: $TARGET_TRIPLE"

(
  cd "$SOURCE_DIR"
  if [[ ! -f "dist/entry.js" && ! -f "dist/entry.mjs" ]]; then
    echo "[openclaw-runtime] dist missing, running pnpm install + pnpm build"
    pnpm install
    pnpm build
  fi
)

RUNTIME_DIR="$ROOT_DIR/services/openclaw/runtime/openclaw"
NODE_DIR="$ROOT_DIR/services/openclaw/runtime/node"
BIN_DIR="$ROOT_DIR/services/openclaw/bin"
mkdir -p "$RUNTIME_DIR" "$NODE_DIR" "$BIN_DIR"

rsync -a --delete "$SOURCE_DIR/dist/" "$RUNTIME_DIR/dist/"
cp "$SOURCE_DIR/openclaw.mjs" "$RUNTIME_DIR/openclaw.mjs"
cp "$SOURCE_DIR/package.json" "$RUNTIME_DIR/package.json"

# Bundle plugin sources + node modules so runtime can resolve built-in plugins/deps.
rsync -a --delete "$SOURCE_DIR/extensions/" "$RUNTIME_DIR/extensions/"
rsync -a --delete "$SOURCE_DIR/node_modules/" "$RUNTIME_DIR/node_modules/"

NODE_BIN="$(command -v node)"
cp "$NODE_BIN" "$NODE_DIR/node"
chmod +x "$NODE_DIR/node"

SERVER_BIN="$BIN_DIR/openclaw-server"
cat >"$SERVER_BIN" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RUNTIME_ROOT="$(cd "$SCRIPT_DIR/../runtime/openclaw" && pwd)"
NODE_BIN="$(cd "$SCRIPT_DIR/../runtime/node" && pwd)/node"

export OPENCLAW_BUNDLED_PLUGINS_DIR="${OPENCLAW_BUNDLED_PLUGINS_DIR:-$RUNTIME_ROOT/extensions}"
exec "$NODE_BIN" "$RUNTIME_ROOT/openclaw.mjs" gateway --allow-unconfigured "$@"
EOF
chmod +x "$SERVER_BIN"

DEST_NAME="openclaw-$TARGET_TRIPLE"
if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
  DEST_NAME="${DEST_NAME}.exe"
fi

cp "$SERVER_BIN" "$ROOT_DIR/apps/desktop/src-tauri/binaries/$DEST_NAME"
chmod +x "$ROOT_DIR/apps/desktop/src-tauri/binaries/$DEST_NAME" 2>/dev/null || true

echo "[openclaw-runtime] prepared: $SERVER_BIN"
echo "[openclaw-runtime] runtime dir: $RUNTIME_DIR"
du -sh "$RUNTIME_DIR" "$NODE_DIR" 2>/dev/null || true
