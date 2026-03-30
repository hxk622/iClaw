#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DESKTOP_DIR="$ROOT_DIR/apps/desktop"
TAURI_DIR="$DESKTOP_DIR/src-tauri"

target=""
profile="release"
channel="${ICLAW_ENV_NAME:-${NODE_ENV:-}}"

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
artifact_base_name="$(
  node -e "const fs=require('fs'); const path=require('path'); const config=JSON.parse(fs.readFileSync(path.join(process.argv[1], 'brand.generated.json'), 'utf8')); process.stdout.write(config.artifactBaseName || config.productName);" \
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
installer_assets_dir="$TAURI_DIR/installer-generated"
dmg_background_path="$installer_assets_dir/dmg-background.png"
dmg_volume_icon_path="$installer_assets_dir/dmg-volume.icns"

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

normalize_channel() {
  case "${1:-}" in
    dev|development|local)
      echo "dev"
      ;;
    prod|production|release)
      echo "prod"
      ;;
    *)
      echo ""
      ;;
  esac
}

mkdir -p "$dmg_dir"

stage_dir="$(mktemp -d "${TMPDIR:-/tmp}/iclaw-dmg-stage.XXXXXX")"
rw_dmg_path="$(mktemp "${TMPDIR:-/tmp}/iclaw-dmg-rw.XXXXXX.dmg")"
mount_dir="$(mktemp -d "${TMPDIR:-/tmp}/iclaw-dmg-mount.XXXXXX")"
cleanup() {
  if mount | grep -q "$mount_dir"; then
    hdiutil detach "$mount_dir" -force >/dev/null 2>&1 || true
  fi
  rm -f "$rw_dmg_path"
  rm -rf "$mount_dir"
  rm -rf "$stage_dir"
}
trap cleanup EXIT

cp -R "$app_bundle_path" "$stage_dir/"
ln -s /Applications "$stage_dir/Applications"
channel_suffix="$(normalize_channel "$channel")"
if [[ -n "$channel_suffix" ]]; then
  dmg_name="${artifact_base_name}_${app_version}_$(arch_label "$target")_${channel_suffix}.dmg"
else
  dmg_name="${artifact_base_name}_${app_version}_$(arch_label "$target").dmg"
fi
dmg_path="$dmg_dir/$dmg_name"
rm -f "$dmg_path"

echo "Creating DMG: $dmg_path"

hdiutil create \
  -srcfolder "$stage_dir" \
  -volname "$product_name" \
  -fs HFS+ \
  -format UDRW \
  -ov \
  "$rw_dmg_path" >/dev/null

hdiutil attach "$rw_dmg_path" \
  -mountpoint "$mount_dir" \
  -noverify \
  -nobrowse \
  -quiet

mkdir -p "$mount_dir/.background"
if [[ -f "$dmg_background_path" ]]; then
  cp "$dmg_background_path" "$mount_dir/.background/background.png"
fi

if [[ -f "$dmg_volume_icon_path" ]]; then
  cp "$dmg_volume_icon_path" "$mount_dir/.VolumeIcon.icns"
  if command -v SetFile >/dev/null 2>&1; then
    SetFile -a C "$mount_dir" || true
  fi
fi

if ! osascript <<EOF >/dev/null
tell application "Finder"
  tell disk "$product_name"
    open
    tell container window
      set current view to icon view
      set toolbar visible to false
      set statusbar visible to false
      set bounds to {120, 120, 860, 600}
      set theViewOptions to the icon view options
      set arrangement of theViewOptions to not arranged
      set icon size of theViewOptions to 128
      if exists file ".background:background.png" then
        set background picture of theViewOptions to file ".background:background.png"
      end if
    end tell
    set position of item "$product_name.app" of container window to {190, 250}
    set position of item "Applications" of container window to {545, 250}
    update without registering applications
    delay 1
    close
  end tell
end tell
EOF
then
  echo "[dmg] warning: Finder layout customization failed for $product_name; continuing with default DMG layout" >&2
fi

hdiutil detach "$mount_dir" -quiet

hdiutil convert "$rw_dmg_path" \
  -format UDZO \
  -imagekey zlib-level=9 \
  -ov \
  -o "$dmg_path" >/dev/null

echo "Created DMG: $dmg_path"
