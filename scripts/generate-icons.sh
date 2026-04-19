#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BRAND_ID="${1:-${APP_NAME:-${ICLAW_PORTAL_APP_NAME:-${ICLAW_BRAND:-}}}}"
RGBA_HELPER="$ROOT_DIR/scripts/ensure-rgba-png.swift"
ICO_HELPER="$ROOT_DIR/scripts/build-ico.py"
DESKTOP_VARIANT_HELPER="$ROOT_DIR/scripts/generate-desktop-icon-variants.sh"
SWIFT_MODULE_CACHE_DIR="${TMPDIR:-/tmp}/swift-module-cache"
CLANG_MODULE_CACHE_DIR="${TMPDIR:-/tmp}/clang-module-cache"

if [[ -z "${BRAND_ID:-}" ]]; then
  echo "Missing OEM brand id. Pass it as the first arg or set APP_NAME / ICLAW_PORTAL_APP_NAME / ICLAW_BRAND." >&2
  exit 1
fi

BRAND_PATHS="$(
  node --input-type=module -e "
    import path from 'node:path';
    import {loadBrandProfile} from './scripts/lib/brand-profile.mjs';

    const rootDir = process.argv[1];
    const brandId = process.argv[2];
    const {brandDir, profile} = await loadBrandProfile({rootDir, brandId});
    const desktopLogo = profile.assets.desktopLogo;
    console.log(path.resolve(brandDir, desktopLogo));
    console.log(path.resolve(brandDir, profile.assets.tauriIconsDir));
  " "$ROOT_DIR" "$BRAND_ID"
)"

SOURCE_LOGO="$(printf '%s\n' "$BRAND_PATHS" | sed -n '1p')"
ICONS_DIR="$(printf '%s\n' "$BRAND_PATHS" | sed -n '2p')"
ASSETS_DIR="$(dirname "$ICONS_DIR")"

if [[ -f "$SOURCE_LOGO" ]]; then
  bash "$DESKTOP_VARIANT_HELPER" "$BRAND_ID" >/dev/null
fi

MAC_SOURCE_LOGO="$SOURCE_LOGO"
WINDOWS_SOURCE_LOGO="$SOURCE_LOGO"

if [[ -f "$ASSETS_DIR/desktop-icon-macos.png" ]]; then
  MAC_SOURCE_LOGO="$ASSETS_DIR/desktop-icon-macos.png"
fi
if [[ -f "$ASSETS_DIR/desktop-icon-windows.png" ]]; then
  WINDOWS_SOURCE_LOGO="$ASSETS_DIR/desktop-icon-windows.png"
fi

if [[ ! -f "$MAC_SOURCE_LOGO" ]]; then
  echo "Missing source logo: $MAC_SOURCE_LOGO"
  exit 1
fi
if [[ ! -f "$WINDOWS_SOURCE_LOGO" ]]; then
  echo "Missing windows source logo: $WINDOWS_SOURCE_LOGO"
  exit 1
fi

TMP_DIR="$(mktemp -d /tmp/iclaw-iconset.XXXXXX)"
ICONSET_DIR="$TMP_DIR/icon.iconset"
cleanup() {
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

normalize_png_rgba() {
  local input_path="$1"
  local tmp_output="$TMP_DIR/rgba-$(basename "$input_path")"
  env \
    SWIFTC_MODULECACHE_PATH="$SWIFT_MODULE_CACHE_DIR" \
    CLANG_MODULE_CACHE_PATH="$CLANG_MODULE_CACHE_DIR" \
    swift "$RGBA_HELPER" "$input_path" "$tmp_output"
  mv "$tmp_output" "$input_path"
}

mkdir -p "$ICONS_DIR"
mkdir -p "$ICONSET_DIR"
mkdir -p "$SWIFT_MODULE_CACHE_DIR" "$CLANG_MODULE_CACHE_DIR"

# Keep the icon visually full while preserving a slim safe area for the macOS
# Dock mask and the rounded-square silhouette in the artwork.
# Re-encode first; some legacy PNGs trip iconutil even when dimensions are valid.
sips -s format png "$MAC_SOURCE_LOGO" --out "$TMP_DIR/source.png" >/dev/null
sips -z 960 960 "$TMP_DIR/source.png" --out "$TMP_DIR/master-960.png" >/dev/null
sips --padToHeightWidth 1024 1024 "$TMP_DIR/master-960.png" --out "$TMP_DIR/master-1024.png" >/dev/null

sips -s format png "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_512x512@2x.png" >/dev/null
sips -z 512 512 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_512x512.png" >/dev/null
sips -z 512 512 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_256x256@2x.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_256x256.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_128x128@2x.png" >/dev/null
sips -z 128 128 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_128x128.png" >/dev/null
sips -z 64 64 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_32x32@2x.png" >/dev/null
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_32x32.png" >/dev/null
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_16x16@2x.png" >/dev/null
sips -z 16 16 "$TMP_DIR/master-1024.png" --out "$ICONSET_DIR/icon_16x16.png" >/dev/null

for icon_png in \
  "$ICONSET_DIR/icon_16x16.png" \
  "$ICONSET_DIR/icon_16x16@2x.png" \
  "$ICONSET_DIR/icon_32x32.png" \
  "$ICONSET_DIR/icon_32x32@2x.png" \
  "$ICONSET_DIR/icon_128x128.png" \
  "$ICONSET_DIR/icon_128x128@2x.png" \
  "$ICONSET_DIR/icon_256x256.png" \
  "$ICONSET_DIR/icon_256x256@2x.png" \
  "$ICONSET_DIR/icon_512x512.png" \
  "$ICONSET_DIR/icon_512x512@2x.png"; do
  normalize_png_rgba "$icon_png"
done

for required in \
  icon_16x16.png \
  icon_16x16@2x.png \
  icon_32x32.png \
  icon_32x32@2x.png \
  icon_128x128.png \
  icon_128x128@2x.png \
  icon_256x256.png \
  icon_256x256@2x.png \
  icon_512x512.png \
  icon_512x512@2x.png; do
  if [[ ! -f "$ICONSET_DIR/$required" ]]; then
    echo "Missing generated iconset asset: $ICONSET_DIR/$required"
    exit 1
  fi
done

tmp_icns="$TMP_DIR/generated.icns"
icns_generated=""
for attempt in 1 2 3 4 5; do
  sleep 0.2
  if iconutil -c icns "$ICONSET_DIR" -o "$tmp_icns" >/dev/null 2>&1; then
    icns_generated="1"
    break
  fi
done

if [[ -n "$icns_generated" ]]; then
  mv "$tmp_icns" "$ICONS_DIR/icon.icns"
else
  echo "Warning: icon.icns generation failed after retries, keeping existing icon.icns"
fi

cp "$TMP_DIR/master-1024.png" "$ICONS_DIR/icon.png"
sips -z 32 32 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/32x32.png" >/dev/null
sips -z 128 128 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/128x128.png" >/dev/null
sips -z 256 256 "$TMP_DIR/master-1024.png" --out "$ICONS_DIR/128x128@2x.png" >/dev/null

for icon_png in \
  "$ICONS_DIR/icon.png" \
  "$ICONS_DIR/32x32.png" \
  "$ICONS_DIR/128x128.png" \
  "$ICONS_DIR/128x128@2x.png"; do
  normalize_png_rgba "$icon_png"
done

cp "$WINDOWS_SOURCE_LOGO" "$TMP_DIR/windows-master-1024.png"
sips -z 256 256 "$TMP_DIR/windows-master-1024.png" --out "$TMP_DIR/windows-256.png" >/dev/null
sips -z 128 128 "$TMP_DIR/windows-master-1024.png" --out "$TMP_DIR/windows-128.png" >/dev/null
sips -z 64 64 "$TMP_DIR/windows-master-1024.png" --out "$TMP_DIR/windows-64.png" >/dev/null
sips -z 48 48 "$TMP_DIR/windows-master-1024.png" --out "$TMP_DIR/windows-48.png" >/dev/null
sips -z 32 32 "$TMP_DIR/windows-master-1024.png" --out "$TMP_DIR/windows-32.png" >/dev/null
for icon_png in \
  "$TMP_DIR/windows-256.png" \
  "$TMP_DIR/windows-128.png" \
  "$TMP_DIR/windows-64.png" \
  "$TMP_DIR/windows-48.png" \
  "$TMP_DIR/windows-32.png"; do
  normalize_png_rgba "$icon_png"
done
python3 "$ICO_HELPER" "$ICONS_DIR/icon.ico" \
  "$TMP_DIR/windows-256.png" \
  "$TMP_DIR/windows-128.png" \
  "$TMP_DIR/windows-64.png" \
  "$TMP_DIR/windows-48.png" \
  "$TMP_DIR/windows-32.png"

echo "Generated icons for brand '$BRAND_ID' from $MAC_SOURCE_LOGO (mac) / $WINDOWS_SOURCE_LOGO (windows) -> $ICONS_DIR"
