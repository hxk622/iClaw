#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
source "$ROOT_DIR/scripts/lib/openclaw-package.sh"
source "$ROOT_DIR/scripts/lib/openclaw-launcher.sh"

SOURCE_DIR="${OPENCLAW_SOURCE_DIR:-}"
TMP_ROOT=""
SOURCE_KIND="source_dir"
PREPARED_PACKAGE_TGZ=""
NPM_SPEC="${OPENCLAW_NPM_SPEC:-}"
PACKAGE_TGZ="${OPENCLAW_PACKAGE_TGZ:-}"

cleanup() {
  if [[ -n "$TMP_ROOT" && -d "$TMP_ROOT" ]]; then
    rm -rf "$TMP_ROOT"
  fi
}

trap cleanup EXIT

infer_target_triple() {
  local os arch
  os="$(uname -s)"
  arch="$(uname -m)"

  case "$os" in
    Darwin)
      case "$arch" in
        arm64|aarch64) echo "aarch64-apple-darwin" ;;
        x86_64) echo "x86_64-apple-darwin" ;;
        *) return 1 ;;
      esac
      ;;
    Linux)
      case "$arch" in
        x86_64|amd64) echo "x86_64-unknown-linux-gnu" ;;
        arm64|aarch64) echo "aarch64-unknown-linux-gnu" ;;
        *) return 1 ;;
      esac
      ;;
    MINGW*|MSYS*|CYGWIN*|Windows_NT)
      case "$arch" in
        x86_64|amd64) echo "x86_64-pc-windows-msvc" ;;
        arm64|aarch64) echo "aarch64-pc-windows-msvc" ;;
        *) return 1 ;;
      esac
      ;;
    *)
      return 1
      ;;
  esac
}

copy_runtime_path() {
  local source_root="$1"
  local path="$2"
  local dest_root="$3"

  if [[ ! -e "$source_root/$path" ]]; then
    return 0
  fi

  if [[ -d "$source_root/$path" ]]; then
    rsync -a --delete "$source_root/$path/" "$dest_root/$path/"
    return 0
  fi

  mkdir -p "$(dirname "$dest_root/$path")"
  cp "$source_root/$path" "$dest_root/$path"
}

ensure_runtime_dependencies() {
  if [[ "$SOURCE_KIND" != "npm_package" ]]; then
    return 0
  fi
  openclaw_ensure_package_runtime_deps "$SOURCE_DIR"
}

TARGET_TRIPLE="${1:-}"
if [[ -z "$TARGET_TRIPLE" ]] && command -v rustc >/dev/null 2>&1; then
  TARGET_TRIPLE="$(rustc -vV 2>/dev/null | sed -n 's/^host: //p')"
fi
if [[ -z "$TARGET_TRIPLE" ]]; then
  TARGET_TRIPLE="$(infer_target_triple || true)"
fi

if [[ -z "$TARGET_TRIPLE" ]]; then
  echo "Cannot determine target triple." >&2
  exit 1
fi

if [[ -z "$SOURCE_DIR" && -z "$PACKAGE_TGZ" && -z "$NPM_SPEC" ]]; then
  NPM_SPEC="$(openclaw_default_npm_spec "$ROOT_DIR" || true)"
fi

if [[ -n "$PACKAGE_TGZ" || -n "$NPM_SPEC" ]]; then
  export OPENCLAW_NPM_SPEC="$NPM_SPEC"
  export OPENCLAW_PACKAGE_TGZ="$PACKAGE_TGZ"
  openclaw_prepare_package_tgz "$ROOT_DIR"
  PREPARED_PACKAGE_TGZ="$OPENCLAW_PREPARED_PACKAGE_TGZ"
  TMP_ROOT="$(mktemp -d /tmp/openclaw-server-runtime-src.XXXXXX)"
  SOURCE_DIR="$TMP_ROOT/package"
  openclaw_extract_package_tgz "$PREPARED_PACKAGE_TGZ" "$SOURCE_DIR"
  SOURCE_KIND="npm_package"
fi

if [[ ! -f "$SOURCE_DIR/package.json" || ! -f "$SOURCE_DIR/openclaw.mjs" ]]; then
  echo "OpenClaw source not found: $SOURCE_DIR" >&2
  echo "Set OPENCLAW_PACKAGE_TGZ=/abs/path/to/openclaw.tgz, OPENCLAW_NPM_SPEC=openclaw@<version>, or OPENCLAW_SOURCE_DIR=/abs/path/to/openclaw-source" >&2
  exit 1
fi

echo "[openclaw-runtime] source: $SOURCE_DIR"
echo "[openclaw-runtime] target: $TARGET_TRIPLE"
echo "[openclaw-runtime] source kind: $SOURCE_KIND"
if [[ -n "$PREPARED_PACKAGE_TGZ" ]]; then
  echo "[openclaw-runtime] package tgz: $PREPARED_PACKAGE_TGZ"
fi

if [[ "$SOURCE_KIND" == "source_dir" ]]; then
  (
    cd "$SOURCE_DIR"
    if [[ ! -f "dist/entry.js" && ! -f "dist/entry.mjs" ]]; then
      echo "[openclaw-runtime] dist missing, running pnpm install + pnpm build"
      pnpm install
      pnpm build
    fi
  )
else
  ensure_runtime_dependencies
fi

openclaw_patch_package_runtime_http_cors "$SOURCE_DIR"
openclaw_patch_package_runtime_openai_usage "$SOURCE_DIR"

RUNTIME_DIR="$ROOT_DIR/services/openclaw/runtime/openclaw"
NODE_DIR="$ROOT_DIR/services/openclaw/runtime/node"
BIN_DIR="$ROOT_DIR/services/openclaw/bin"
mkdir -p "$RUNTIME_DIR" "$NODE_DIR" "$BIN_DIR"

for path in dist docs extensions skills assets node_modules; do
  copy_runtime_path "$SOURCE_DIR" "$path" "$RUNTIME_DIR"
done
copy_runtime_path "$SOURCE_DIR" "openclaw.mjs" "$RUNTIME_DIR"
copy_runtime_path "$SOURCE_DIR" "package.json" "$RUNTIME_DIR"
copy_runtime_path "$SOURCE_DIR" "README.md" "$RUNTIME_DIR"
copy_runtime_path "$SOURCE_DIR" "LICENSE" "$RUNTIME_DIR"

NODE_BIN="$(command -v node)"
rm -f "$NODE_DIR/node"
cp "$NODE_BIN" "$NODE_DIR/node"
chmod +x "$NODE_DIR/node"

SERVER_BIN="$BIN_DIR/openclaw-server"
openclaw_write_gateway_launcher \
  "$SERVER_BIN" \
  '$(cd "$SCRIPT_DIR/../runtime/openclaw" && pwd)' \
  '$(cd "$SCRIPT_DIR/../runtime/node" && pwd)/node'

DEST_NAME="openclaw-$TARGET_TRIPLE"
if [[ "$TARGET_TRIPLE" == *"windows"* ]]; then
  DEST_NAME="${DEST_NAME}.exe"
fi

mkdir -p "$ROOT_DIR/apps/desktop/src-tauri/binaries"
cp "$SERVER_BIN" "$ROOT_DIR/apps/desktop/src-tauri/binaries/$DEST_NAME"
chmod +x "$ROOT_DIR/apps/desktop/src-tauri/binaries/$DEST_NAME" 2>/dev/null || true

echo "[openclaw-runtime] prepared: $SERVER_BIN"
echo "[openclaw-runtime] runtime dir: $RUNTIME_DIR"
du -sh "$RUNTIME_DIR" "$NODE_DIR" 2>/dev/null || true
