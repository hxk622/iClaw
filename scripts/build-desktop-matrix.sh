#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
OUT_DIR="$ROOT_DIR/dist/releases"
APP_VERSION="$(node -p "require('$ROOT_DIR/package.json').version")"
timestamp="$(date +%Y%m%d%H%M)"
RELEASE_VERSION="${1:-${APP_VERSION}.${timestamp}}"

TARGETS=(
  "aarch64-apple-darwin"
  "x86_64-apple-darwin"
)

CHANNELS=("dev" "prod")

mkdir -p "$OUT_DIR"

build_one() {
  local target="$1"
  local channel="$2"
  local node_env
  local arch_label

  if [[ "$channel" == "dev" ]]; then
    node_env="dev"
  elif [[ "$channel" == "prod" ]]; then
    node_env="prod"
  else
    echo "Unsupported channel: $channel" >&2
    exit 1
  fi

  if [[ "$target" == "aarch64-apple-darwin" ]]; then
    arch_label="aarch64"
  else
    arch_label="x64"
  fi

  echo "==> building: target=$target channel=$channel"

  # Ensure target-specific sidecar name exists before tauri bundles externalBin.
  bash "$ROOT_DIR/scripts/build-openclaw.sh" "$target"
  NODE_ENV="$node_env" bash "$ROOT_DIR/scripts/env.sh"

  (
    cd "$DESKTOP_DIR"
    NODE_ENV="$node_env" \
    pnpm tauri build --target "$target"
  )

  local dmg_dir="$DESKTOP_DIR/src-tauri/target/$target/release/bundle/dmg"
  local dmg_path="$dmg_dir/iClaw_${APP_VERSION}_${arch_label}.dmg"
  if [[ ! -f "$dmg_path" ]]; then
    dmg_path="$dmg_dir/iClaw-理财客_${APP_VERSION}_${arch_label}.dmg"
  fi
  if [[ ! -f "$dmg_path" ]]; then
    echo "Expected DMG not found under: $dmg_dir (appVersion=$APP_VERSION arch=$arch_label)" >&2
    exit 1
  fi

  local out_file="$OUT_DIR/iClaw_${RELEASE_VERSION}_${arch_label}_${channel}.dmg"
  cp "$dmg_path" "$out_file"
  echo "saved: $out_file"
}

for target in "${TARGETS[@]}"; do
  for channel in "${CHANNELS[@]}"; do
    build_one "$target" "$channel"
  done
done

echo "All done. output => $OUT_DIR"
