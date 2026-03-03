#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
SOURCE_LOGO="$ROOT_DIR/brand/logo.master.png"
ICONS_DIR="$ROOT_DIR/apps/desktop/src-tauri/icons"
TMP_DIR="/tmp/iclaw-iconset"

if [[ ! -f "$SOURCE_LOGO" ]]; then
  echo "Missing source logo: $SOURCE_LOGO"
  exit 1
fi

mkdir -p "$ICONS_DIR"
rm -rf "$TMP_DIR"
mkdir -p "$TMP_DIR/iClaw.iconset"

# Keep visual balance for Dock/app list: ~84% content + ~16% transparent margin.
sips -z 860 860 "$SOURCE_LOGO" --out "$TMP_DIR/master-860.png" >/dev/null
sips --padToHeightWidth 1024 1024 "$TMP_DIR/master-860.png" --out "$TMP_DIR/master-1024.png" >/dev/null

cp "$TMP_DIR/master-1024.png" "$TMP_DIR/iClaw.iconset/icon_512x512@2x.png"
sips -z 512 512 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_512x512.png" >/dev/null
sips -z 512 512 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_256x256@2x.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_256x256.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_128x128@2x.png" >/dev/null
sips -z 128 128 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_128x128.png" >/dev/null
sips -z 64 64 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_32x32@2x.png" >/dev/null
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_32x32.png" >/dev/null
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_16x16@2x.png" >/dev/null
sips -z 16 16 "$TMP_DIR/master-1024.png" --out "$TMP_DIR/iClaw.iconset/icon_16x16.png" >/dev/null

iconutil -c icns "$TMP_DIR/iClaw.iconset" -o "$ICONS_DIR/icon.icns"
cp "$TMP_DIR/master-1024.png" "$ICONS_DIR/icon.png"
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/32x32.png" >/dev/null
sips -z 128 128 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/128x128.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/128x128@2x.png" >/dev/null

# Keep current icon.ico if conversion fails (sips can be flaky on some systems).
if ! sips -s format ico "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/icon.ico" >/dev/null 2>&1; then
  echo "Warning: icon.ico generation failed, keeping existing icon.ico"
fi

echo "Generated icons from $SOURCE_LOGO -> $ICONS_DIR"
