#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
OUT_DIR="$ROOT_DIR/dist/releases"
VERSION="${1:-$(node -p "require('$ROOT_DIR/package.json').version")}"

TARGETS=(
  "aarch64-apple-darwin"
  "x86_64-apple-darwin"
)

CHANNELS=("dev" "prod")

mkdir -p "$OUT_DIR"

build_one() {
  local target="$1"
  local channel="$2"
  local api_base_url
  local arch_label

  if [[ "$channel" == "dev" ]]; then
    api_base_url="http://127.0.0.1:2126"
  else
    api_base_url="https://openalpha.aiyuanxi.com"
  fi

  if [[ "$target" == "aarch64-apple-darwin" ]]; then
    arch_label="aarch64"
  else
    arch_label="x64"
  fi

  echo "==> building: target=$target channel=$channel"

  # Ensure target-specific sidecar name exists before tauri bundles externalBin.
  bash "$ROOT_DIR/scripts/build-openclaw.sh" "$target"

  (
    cd "$DESKTOP_DIR"
    VITE_BUILD_CHANNEL="$channel" \
    VITE_API_BASE_URL="$api_base_url" \
    pnpm tauri build --target "$target"
  )

  local dmg_path="$DESKTOP_DIR/src-tauri/target/$target/release/bundle/dmg/iClaw_${VERSION}_${arch_label}.dmg"
  if [[ ! -f "$dmg_path" ]]; then
    echo "Expected DMG not found: $dmg_path" >&2
    exit 1
  fi

  local out_file="$OUT_DIR/iClaw_${VERSION}_${arch_label}_${channel}.dmg"
  cp "$dmg_path" "$out_file"
  echo "saved: $out_file"
}

for target in "${TARGETS[@]}"; do
  for channel in "${CHANNELS[@]}"; do
    build_one "$target" "$channel"
  done
done

echo "All done. output => $OUT_DIR"
