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

product_name() {
  node -e "const fs=require('fs'); const path=require('path'); const config=JSON.parse(fs.readFileSync(path.join(process.argv[1], 'tauri.generated.conf.json'), 'utf8')); process.stdout.write(config.productName);" \
    "$DESKTOP_DIR/src-tauri"
}

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

  NODE_ENV="$node_env" bash "$ROOT_DIR/scripts/env.sh"

  (
    cd "$DESKTOP_DIR"
    NODE_ENV="$node_env" \
    bash "$ROOT_DIR/scripts/build-desktop-dmg.sh" --target "$target"
  )

  local dmg_dir="$DESKTOP_DIR/src-tauri/target/$target/release/bundle/dmg"
  local current_product_name
  current_product_name="$(product_name)"
  local dmg_path="$dmg_dir/${current_product_name}_${APP_VERSION}_${arch_label}.dmg"
  if [[ ! -f "$dmg_path" ]]; then
    echo "Expected DMG not found under: $dmg_dir (appVersion=$APP_VERSION arch=$arch_label)" >&2
    exit 1
  fi

  local out_file="$OUT_DIR/${current_product_name}_${RELEASE_VERSION}_${arch_label}_${channel}.dmg"
  cp "$dmg_path" "$out_file"
  echo "saved: $out_file"

  local updater_dir="$DESKTOP_DIR/src-tauri/target/$target/release/bundle/macos"
  local updater_archive="$updater_dir/${current_product_name}.app.tar.gz"
  local updater_signature="${updater_archive}.sig"
  if [[ -f "$updater_archive" && -f "$updater_signature" ]]; then
    local updater_out_file="$OUT_DIR/${current_product_name}_${RELEASE_VERSION}_${arch_label}_${channel}.app.tar.gz"
    local updater_sig_out_file="${updater_out_file}.sig"
    cp "$updater_archive" "$updater_out_file"
    cp "$updater_signature" "$updater_sig_out_file"
    echo "saved: $updater_out_file"
    echo "saved: $updater_sig_out_file"
  fi
}

for target in "${TARGETS[@]}"; do
  for channel in "${CHANNELS[@]}"; do
    build_one "$target" "$channel"
  done
done

echo "All done. output => $OUT_DIR"
