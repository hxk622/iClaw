#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
TAURI_DIR="$DESKTOP_DIR/src-tauri"

target=""
profile="release"

while [[ $# -gt 0 ]]; do
  case "$1" in
    -t|--target)
      target="${2:-}"
      shift 2
      ;;
    --target=*)
      target="${1#*=}"
      shift
      ;;
    -d|--debug)
      profile="debug"
      shift
      ;;
    *)
      shift
      ;;
  esac
done

product_name="$(
  node -e "const fs=require('fs'); const path=require('path'); const config=JSON.parse(fs.readFileSync(path.join(process.argv[1], 'tauri.generated.conf.json'), 'utf8')); process.stdout.write(config.productName);" \
  "$TAURI_DIR"
)"
app_version="$(
  node -e "const fs=require('fs'); const path=require('path'); const pkg=JSON.parse(fs.readFileSync(path.join(process.argv[1], 'package.json'), 'utf8')); process.stdout.write(pkg.version);" \
  "$ROOT_DIR"
)"

target_dir="$TAURI_DIR/target"
if [[ -n "$target" ]]; then
  target_dir="$target_dir/$target"
fi
target_dir="$target_dir/$profile"

bundle_dir="$target_dir/bundle"
macos_dir="$bundle_dir/macos"
dmg_dir="$bundle_dir/dmg"
app_bundle_path="$macos_dir/$product_name.app"

if [[ ! -d "$app_bundle_path" ]]; then
  echo "Missing app bundle: $app_bundle_path" >&2
  exit 1
fi

arch_label() {
  case "${1:-}" in
    aarch64-apple-darwin)
      echo "aarch64"
      ;;
    x86_64-apple-darwin)
      echo "x64"
      ;;
    universal-apple-darwin)
      echo "universal"
      ;;
    "")
      case "$(uname -m)" in
        arm64|aarch64)
          echo "aarch64"
          ;;
        x86_64)
          echo "x64"
          ;;
        *)
          uname -m
          ;;
      esac
      ;;
    *)
      echo "$1"
      ;;
  esac
}

mkdir -p "$dmg_dir"

stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/iclaw-dmg-stage.XXXXXX")"
cleanup() {
  rm -rf "$stage_dir"
}
trap cleanup EXIT

cp -R "$app_bundle_path" "$stage_dir/"
ln -s /Applications "$stage_dir/Applications"

dmg_name="${product_name}_${app_version}_$(arch_label "$target").dmg"
dmg_path="$dmg_dir/$dmg_name"
rm -f "$dmg_path"

echo "Creating DMG: $dmg_path"
hdiutil create \
  -volname "$product_name" \
  -srcfolder "$stage_dir" \
  -ov \
  -format UDZO \
  "$dmg_path"

echo "Created DMG: $dmg_path"
